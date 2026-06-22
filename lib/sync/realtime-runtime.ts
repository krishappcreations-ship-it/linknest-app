"use client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase-client";
import { bookmarkFromRow, folderFromRow, tagFromRow } from "./supabase-sync";
import {
  applyInboundBookmark,
  applyInboundFolder,
  applyInboundTag,
  applyDeleteBookmark,
  applyDeleteFolder,
  applyDeleteTag,
  triggerSyncOnStartup,
  emitRealtimeDownToast,
} from "./sync-runtime";
import type { BookmarkId, FolderId, TagId } from "@/types";
import { setRealtimeConnected } from "@/store";

/**
 * Realtime sync runtime (F13 / F08 Phase 2d).
 *
 * Opens 3 Supabase Realtime channels (bookmarks, folders, tags) on sign-in
 * and tears them down on sign-out. Wired from sync-runtime's existing
 * onAuthChange in P5.
 *
 * Echo dedupe + reconnect safety: incoming events flow through
 * applyInbound*, which delegates to slice-level upsertFromSync. The LWW
 * guard inside each slice (added in P1) returns the same state ref when
 * incoming.updatedAt <= existing.updatedAt, so applyInbound* returns false
 * and skips Dexie write.
 *
 * Module-scoped state (matches feedback_module_state_pattern):
 *   channels — array of open RealtimeChannel refs, null when torn down
 *   reconnectAttempts — counter, resets on each successful SUBSCRIBED
 */

let channels: RealtimeChannel[] | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT = 3;

export function mountRealtime(userId: string): void {
  if (channels) return; // idempotent — double-call no-op
  const sb = getSupabaseClient();
  if (!sb) return; // env vars missing or SSR

  channels = [
    sb
      .channel(`bookmarks:${userId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${userId}`,
        },
        (p: {
          eventType: "INSERT" | "UPDATE" | "DELETE";
          new: Record<string, unknown> | null;
          old: Record<string, unknown> | null;
        }) => {
          if (p.eventType === "DELETE") {
            const id = p.old?.id;
            if (typeof id !== "string") return;
            void applyDeleteBookmark(id as BookmarkId);
            return;
          }
          if (!p.new) return;
          void applyInboundBookmark(bookmarkFromRow(p.new));
        }
      )
      .subscribe(onStatus),

    sb
      .channel(`folders:${userId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "folders",
          filter: `user_id=eq.${userId}`,
        },
        (p: {
          eventType: "INSERT" | "UPDATE" | "DELETE";
          new: Record<string, unknown> | null;
          old: Record<string, unknown> | null;
        }) => {
          if (p.eventType === "DELETE") {
            const id = p.old?.id;
            if (typeof id !== "string") return;
            void applyDeleteFolder(id as FolderId);
            return;
          }
          if (!p.new) return;
          void applyInboundFolder(folderFromRow(p.new));
        }
      )
      .subscribe(onStatus),

    sb
      .channel(`tags:${userId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "tags",
          filter: `user_id=eq.${userId}`,
        },
        (p: {
          eventType: "INSERT" | "UPDATE" | "DELETE";
          new: Record<string, unknown> | null;
          old: Record<string, unknown> | null;
        }) => {
          if (p.eventType === "DELETE") {
            const id = p.old?.id;
            if (typeof id !== "string") return;
            void applyDeleteTag(id as TagId);
            return;
          }
          if (!p.new) return;
          void applyInboundTag(tagFromRow(p.new));
        }
      )
      .subscribe(onStatus),
  ];
}

export function teardownRealtime(): void {
  if (!channels) return;
  const sb = getSupabaseClient();
  for (const ch of channels) {
    try {
      void sb?.removeChannel(ch);
    } catch {
      // fire-and-forget — orphan channel until tab close is acceptable
    }
  }
  channels = null;
  reconnectAttempts = 0;
  setRealtimeConnected(false); // F18: clear connected flag
}

function onStatus(status: string, _err?: Error): void {
  if (status === "SUBSCRIBED") {
    setRealtimeConnected(true); // F18: dot turns green
    if (reconnectAttempts > 0) {
      reconnectAttempts = 0;
      void triggerSyncOnStartup(); // safety-net pull after reconnect
    }
    return;
  }
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
    setRealtimeConnected(false); // F18: dot turns red
    reconnectAttempts++;
    if (reconnectAttempts >= MAX_RECONNECT) {
      emitRealtimeDownToast();
    }
  }
}
