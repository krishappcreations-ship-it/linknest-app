"use client";
import type {
  Bookmark,
  Folder,
  Tag,
  Preferences,
  BookmarkId,
  FolderId,
  TagId,
  TagColor,
} from "@/types";
import type { SyncAdapter } from "./types";
import { getSupabaseClient } from "./supabase-client";

// ============================================================================
// Row converters — single conversion site per entity (camelCase ↔ snake_case)
// ============================================================================

function bookmarkToRow(b: Bookmark, userId: string) {
  return {
    id: b.id,
    user_id: userId,
    url: b.url,
    title: b.title,
    description: b.description,
    preview_image_url: b.previewImageUrl,
    favicon_url: b.faviconUrl,
    domain: b.domain,
    preview_status: b.previewStatus,
    folder_id: b.folderId,
    tag_ids: b.tagIds,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    deleted_at: b.deletedAt,
    preview_failure_kind: b.previewFailureKind,
    preview_attempt: b.previewAttempt,
    read_state: b.readState,
    note: b.note ?? null,
    link_status: b.linkStatus ?? "unknown",
    link_checked_at: b.linkCheckedAt ?? null,
    link_redirect_url: b.linkRedirectUrl ?? null,
    kind: b.kind,
    asset_path: b.assetPath,
    prompt_body: b.promptBody ?? null,
    prompt_category: b.promptCategory ?? null,
  };
}

export function bookmarkFromRow(r: Record<string, unknown>): Bookmark {
  return {
    id: r.id as BookmarkId,
    url: r.url as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    previewImageUrl: (r.preview_image_url as string | null) ?? null,
    faviconUrl: (r.favicon_url as string | null) ?? null,
    domain: r.domain as string,
    previewStatus: r.preview_status as Bookmark["previewStatus"],
    folderId: (r.folder_id as FolderId | null) ?? null,
    tagIds: (r.tag_ids as TagId[] | null) ?? [],
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    deletedAt: (r.deleted_at as number | null) ?? null,
    previewFailureKind:
      (r.preview_failure_kind as Bookmark["previewFailureKind"]) ?? null,
    previewAttempt: (r.preview_attempt as number) ?? 0,
    readState: (r.read_state as Bookmark["readState"]) ?? "inbox",
    kind: (r.kind as Bookmark["kind"]) ?? "link",
    assetPath: (r.asset_path as string | null) ?? null,
    promptBody: (r.prompt_body as string | null) ?? null,
    promptCategory: (r.prompt_category as string | null) ?? null,
    // F23 local-first: capture state is never synced. A link arriving from the
    // cloud defaults to "pending" so this device captures it; assets never
    // capture (no article to fetch).
    captureStatus:
      (r.kind as Bookmark["kind"]) && r.kind !== "link" ? "ready" : "pending",
    captureFailureKind:
      (r.capture_failure_kind as Bookmark["captureFailureKind"]) ?? null,
    captureAttempt: (r.capture_attempt as number) ?? 0,
    // F24 local-only: readProgress is never synced (article snapshot is local).
    readProgress: (r.read_progress as number) ?? 0,
    // F30: per-bookmark note (synced).
    note: (r.note as string | null) ?? null,
    // F34: link health (synced).
    linkStatus: (r.link_status as Bookmark["linkStatus"]) ?? "unknown",
    linkCheckedAt: (r.link_checked_at as number | null) ?? null,
    linkRedirectUrl: (r.link_redirect_url as string | null) ?? null,
  };
}

function folderToRow(f: Folder, userId: string) {
  return {
    id: f.id,
    user_id: userId,
    name: f.name,
    parent_id: f.parentId,
    order_index: f.order,
    pinned: f.pinned,
    color: f.color,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
    deleted_at: f.deletedAt ?? null,
  };
}

export function folderFromRow(r: Record<string, unknown>): Folder {
  return {
    id: r.id as FolderId,
    name: r.name as string,
    parentId: (r.parent_id as FolderId | null) ?? null,
    order: r.order_index as number,
    pinned: r.pinned as boolean,
    color: (r.color as TagColor | null) ?? null,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    deletedAt: (r.deleted_at as number | null) ?? null,
  };
}

function tagToRow(t: Tag, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    name: t.name,
    color: t.color,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    deleted_at: t.deletedAt ?? null,
  };
}

export function tagFromRow(r: Record<string, unknown>): Tag {
  return {
    id: r.id as TagId,
    name: r.name as string,
    color: r.color as TagColor,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
    deletedAt: (r.deleted_at as number | null) ?? null,
  };
}

function preferencesToRow(p: Preferences, userId: string) {
  return {
    user_id: userId,
    layout: p.layout,
    theme: p.theme,
    pinned_folder_ids: p.pinnedFolderIds,
    updated_at: Date.now(),
  };
}

function preferencesFromRow(r: Record<string, unknown>): Preferences {
  return {
    layout: r.layout as Preferences["layout"],
    theme: r.theme as Preferences["theme"],
    pinnedFolderIds: (r.pinned_folder_ids as FolderId[] | null) ?? [],
    // F24 reader typography is local-only (no cloud columns) — default here.
    readerFontSize:
      (r.reader_font_size as Preferences["readerFontSize"]) ?? "m",
    readerFontFamily:
      (r.reader_font_family as Preferences["readerFontFamily"]) ?? "serif",
    readerWidth: (r.reader_width as Preferences["readerWidth"]) ?? "normal",
  };
}

// ============================================================================
// Adapter
// ============================================================================

async function runOp(
  builder: PromiseLike<{ error: unknown | null }>
): Promise<void> {
  const { error } = await builder;
  if (error) throw error;
}

export function supabaseSyncAdapter(): SyncAdapter {
  const supabase = getSupabaseClient();
  if (!supabase)
    throw new Error("supabaseSyncAdapter requires browser + env vars");
  return {
    async uploadAll(userId, payload) {
      const ops: Promise<void>[] = [];
      if (payload.bookmarks.length) {
        ops.push(
          runOp(
            supabase.rpc("upsert_bookmarks_lww", {
              rows: payload.bookmarks.map((b) => bookmarkToRow(b, userId)),
            })
          )
        );
      }
      if (payload.folders.length) {
        ops.push(
          runOp(
            supabase.rpc("upsert_folders_lww", {
              rows: payload.folders.map((f) => folderToRow(f, userId)),
            })
          )
        );
      }
      if (payload.tags.length) {
        ops.push(
          runOp(
            supabase.rpc("upsert_tags_lww", {
              rows: payload.tags.map((t) => tagToRow(t, userId)),
            })
          )
        );
      }
      if (payload.preferences) {
        ops.push(
          runOp(
            supabase
              .from("preferences")
              .upsert(preferencesToRow(payload.preferences, userId))
          )
        );
      }
      await Promise.all(ops);
    },

    async fetchAll(userId) {
      const [b, f, t, p] = await Promise.all([
        supabase.from("bookmarks").select("*").eq("user_id", userId),
        supabase.from("folders").select("*").eq("user_id", userId),
        supabase.from("tags").select("*").eq("user_id", userId),
        supabase
          .from("preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      if (b.error) throw b.error;
      if (f.error) throw f.error;
      if (t.error) throw t.error;
      if (p.error) throw p.error;
      return {
        bookmarks: (b.data ?? []).map(bookmarkFromRow),
        folders: (f.data ?? []).map(folderFromRow),
        tags: (t.data ?? []).map(tagFromRow),
        preferences: p.data ? preferencesFromRow(p.data) : null,
      };
    },

    async putBookmark(userId, b) {
      const { error } = await supabase.rpc("upsert_bookmarks_lww", {
        rows: [bookmarkToRow(b, userId)],
      });
      if (error) throw error;
    },

    async putFolder(userId, f) {
      const { error } = await supabase.rpc("upsert_folders_lww", {
        rows: [folderToRow(f, userId)],
      });
      if (error) throw error;
    },

    async putTag(userId, t) {
      const { error } = await supabase.rpc("upsert_tags_lww", {
        rows: [tagToRow(t, userId)],
      });
      if (error) throw error;
    },

    async putPreferences(userId, p) {
      const { error } = await supabase
        .from("preferences")
        .upsert(preferencesToRow(p, userId));
      if (error) throw error;
    },
  };
}
