"use client";
import { useStore } from "@/store";
import { getSupabaseClient } from "./supabase-client";
import { removeBookmark } from "@/store/slices/bookmarks-slice";

const GC_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Phase 3 tombstone garbage collection (F15).
 *
 * Purges deleted_at rows older than 30 days from BOTH Dexie AND Postgres.
 * Runs once per bootstrap, best-effort silent — fire-and-forget from
 * sync-runtime's mountSyncRuntime after sign-in is confirmed.
 *
 * Why client-side: zero new infra (no Edge Function, no pg_cron).
 * Tombstones are idempotent so cross-device races are harmless.
 *
 * Zombie-resurrection safety: client purges Dexie + Postgres at the
 * same threshold. If a long-offline device returns >30d later with a
 * still-alive local row, it pushes the row via existing queue path which
 * carries deleted_at; cloud RPC creates a fresh tombstone (no row
 * resurrection) which is then GC'd on the next bootstrap. Self-healing.
 */
export async function purgeTombstones(userId: string): Promise<void> {
  const cutoff = Date.now() - GC_RETENTION_MS;
  await purgeBookmarks(userId, cutoff);
  await purgeFolders(userId, cutoff);
  await purgeTags(userId, cutoff);
}

async function purgeBookmarks(userId: string, cutoff: number): Promise<void> {
  const s = useStore.getState();
  const stale = Object.values(s.bookmarks.byId).filter(
    (b) => b.deletedAt !== null && b.deletedAt < cutoff
  );
  if (stale.length === 0) return;

  for (const b of stale) {
    try {
      await s.bookmarksAdapter.remove(b.id);
    } catch (err) {
      console.warn("[gc] bookmarks dexie remove failed", b.id, err);
    }
  }

  useStore.setState((cur) => {
    let bookmarks = cur.bookmarks;
    for (const b of stale) {
      bookmarks = removeBookmark(bookmarks, b.id).next;
    }
    return { bookmarks };
  });

  try {
    const sb = getSupabaseClient();
    if (!sb) return;
    await sb
      .from("bookmarks")
      .delete()
      .lt("deleted_at", cutoff)
      .eq("user_id", userId);
  } catch (err) {
    console.warn("[gc] bookmarks postgres delete failed", err);
  }
}

async function purgeFolders(userId: string, cutoff: number): Promise<void> {
  const s = useStore.getState();
  const stale = Object.values(s.folders.byId).filter(
    (f) => f.deletedAt !== null && f.deletedAt < cutoff
  );
  if (stale.length === 0) return;

  for (const f of stale) {
    try {
      await s.foldersAdapter.remove(f.id);
    } catch (err) {
      console.warn("[gc] folders dexie remove failed", f.id, err);
    }
  }

  useStore.setState((cur) => {
    const byId = { ...cur.folders.byId };
    for (const f of stale) delete byId[f.id];
    return { folders: { ...cur.folders, byId } };
  });

  try {
    const sb = getSupabaseClient();
    if (!sb) return;
    await sb
      .from("folders")
      .delete()
      .lt("deleted_at", cutoff)
      .eq("user_id", userId);
  } catch (err) {
    console.warn("[gc] folders postgres delete failed", err);
  }
}

async function purgeTags(userId: string, cutoff: number): Promise<void> {
  const s = useStore.getState();
  const stale = Object.values(s.tags.byId).filter(
    (t) => t.deletedAt !== null && t.deletedAt < cutoff
  );
  if (stale.length === 0) return;

  for (const t of stale) {
    try {
      await s.tagsAdapter.remove(t.id);
    } catch (err) {
      console.warn("[gc] tags dexie remove failed", t.id, err);
    }
  }

  useStore.setState((cur) => {
    const byId = { ...cur.tags.byId };
    for (const t of stale) delete byId[t.id];
    return { tags: { ...cur.tags, byId } };
  });

  try {
    const sb = getSupabaseClient();
    if (!sb) return;
    await sb
      .from("tags")
      .delete()
      .lt("deleted_at", cutoff)
      .eq("user_id", userId);
  } catch (err) {
    console.warn("[gc] tags postgres delete failed", err);
  }
}
