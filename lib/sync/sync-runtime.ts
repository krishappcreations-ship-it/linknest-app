"use client";
import {
  useStore,
  setAuthSession,
  setAuthStatus,
  setSyncQueueSize,
  setRealtimeConnected,
} from "@/store";
import { getSession, onAuthChange } from "./auth-client";
import { supabaseSyncAdapter } from "./supabase-sync";
import {
  bootstrapOnSignIn,
  syncOnStartup,
  type BootstrapDeps,
} from "./sync-bootstrap";
import type { SyncAdapter } from "./types";
import { upsertFromSync as upsertBookmarkFromSync } from "@/store/slices/bookmarks-slice";
import { upsertFromSync as upsertFolderFromSync } from "@/store/slices/folders-slice";
import { upsertFromSync as upsertTagFromSync } from "@/store/slices/tags-slice";
import { upsertFromSync as upsertPrefsFromSync } from "@/store/slices/preferences-slice";
import { pushToast } from "@/store/slices/ui-slice";
import type { QueueEntity, QueuePayload } from "./sync-queue";
import { flushQueue } from "./queue-flush";
import type {
  Preferences,
  Bookmark,
  Folder,
  Tag,
  BookmarkId,
  FolderId,
  TagId,
} from "@/types";
import { removeBookmark } from "@/store/slices/bookmarks-slice";
import { mountRealtime, teardownRealtime } from "./realtime-runtime";
import { purgeTombstones } from "./gc-tombstones";

let mounted = false;
let lastUserId: string | null = null;
let _adapter: SyncAdapter | null = null;

function getAdapter(): SyncAdapter | null {
  if (typeof window === "undefined") return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  if (!_adapter) {
    try {
      _adapter = supabaseSyncAdapter();
    } catch {
      return null;
    }
  }
  return _adapter;
}

async function refreshQueueSize(): Promise<void> {
  const queue = useStore.getState().syncQueueAdapter;
  if (!queue) return;
  setSyncQueueSize(await queue.size());
}

const TOAST_COOLDOWN_MS = 30_000;
const recentToasts = new Map<string, number>();

function emitToast(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const truncated =
    message.length > 200 ? `${message.slice(0, 200)}…` : message;
  const now = Date.now();
  const last = recentToasts.get(truncated);
  if (last && now - last < TOAST_COOLDOWN_MS) {
    console.warn("[sync] suppressed (cooldown):", truncated);
    return;
  }
  recentToasts.set(truncated, now);
  // Lazy-prune entries older than 5×cooldown to keep map bounded.
  for (const [k, ts] of recentToasts) {
    if (now - ts > TOAST_COOLDOWN_MS * 5) recentToasts.delete(k);
  }
  console.warn("[sync] failed:", truncated);
  useStore.setState((s) => ({
    ui: pushToast(s.ui, {
      tone: "error",
      title: "Sync failed",
      description: truncated,
      ttlMs: 6000,
    }),
  }));
}

function buildDeps(): BootstrapDeps {
  const s = useStore.getState();
  const sync = getAdapter();
  if (!sync) throw new Error("sync adapter unavailable");
  return {
    sync,
    bookmarks: s.bookmarksAdapter,
    folders: s.foldersAdapter,
    tags: s.tagsAdapter,
    preferences: s.preferencesAdapter,
    setStatus: (st) => setAuthStatus(st),
    onSyncBookmark: (b) =>
      useStore.setState((cur) => ({
        bookmarks: upsertBookmarkFromSync(cur.bookmarks, b),
      })),
    onSyncFolder: (f) =>
      useStore.setState((cur) => ({
        folders: upsertFolderFromSync(cur.folders, f),
      })),
    onSyncTag: (t) =>
      useStore.setState((cur) => ({ tags: upsertTagFromSync(cur.tags, t) })),
    onSyncPreferences: (p) =>
      useStore.setState((cur) => ({
        preferences: upsertPrefsFromSync(cur.preferences, p),
      })),
  };
}

function makeQueuedPut<T extends { id: string }>(
  entity: QueueEntity,
  realPut: (uid: string, row: T) => Promise<void>
) {
  return async (uid: string, row: T) => {
    const queue = useStore.getState().syncQueueAdapter;
    if (!queue) {
      await realPut(uid, row);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queue.enqueue(entity, row.id, row as unknown as QueuePayload);
      void refreshQueueSize(); // F18
      return;
    }
    try {
      await realPut(uid, row);
      void flushOpportunistic();
      void refreshQueueSize(); // F18
    } catch (err) {
      await queue.enqueue(entity, row.id, row as unknown as QueuePayload);
      void refreshQueueSize(); // F18
      throw err;
    }
  };
}

function makePrefsQueuedPut(
  realPut: (uid: string, p: Preferences) => Promise<void>
) {
  return async (uid: string, p: Preferences) => {
    const queue = useStore.getState().syncQueueAdapter;
    if (!queue) {
      await realPut(uid, p);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queue.enqueue("preferences", "singleton", p);
      void refreshQueueSize(); // F18
      return;
    }
    try {
      await realPut(uid, p);
      void flushOpportunistic();
      void refreshQueueSize(); // F18
    } catch (err) {
      await queue.enqueue("preferences", "singleton", p);
      void refreshQueueSize(); // F18
      throw err;
    }
  };
}

export async function flushOpportunistic() {
  const userId = useStore.getState().auth.userId;
  const queue = useStore.getState().syncQueueAdapter;
  const sync = getAdapter();
  if (!userId || !queue || !sync) return;
  await flushQueue({
    queue,
    sync,
    userId,
    onDrop: emitDropToast,
  });
  setSyncQueueSize(await queue.size()); // F18
}

function emitDropToast(count: number) {
  useStore.setState((s) => ({
    ui: pushToast(s.ui, {
      tone: "warn",
      title:
        count === 1
          ? "Sync gave up on 1 change"
          : `Sync gave up on ${count} changes`,
      description: "Local data preserved; cloud not updated for these.",
      ttlMs: 8000,
    }),
  }));
}

/**
 * Sync options for apply* helpers. Returns undefined sync + userId when
 * anon (or SSR / env var absent), so the optional-chain guard in fireSync*
 * short-circuits. Safe to call from any apply* call site.
 *
 * Per spec §5.5: returned `sync` is a wrapper whose per-entity put methods
 * enqueue when offline OR on fail. uploadAll + fetchAll bypass the queue
 * (bootstrap is one-shot batch).
 */
export function getSyncOpts(): {
  sync?: SyncAdapter;
  userId?: string;
  onSyncError?: (err: unknown) => void;
} {
  const sync = getAdapter();
  if (!sync) return {};
  const userId = useStore.getState().auth.userId;
  if (!userId) return {};

  const wrappedSync: SyncAdapter = {
    uploadAll: sync.uploadAll.bind(sync),
    fetchAll: sync.fetchAll.bind(sync),
    putBookmark: makeQueuedPut("bookmark", sync.putBookmark.bind(sync)),
    putFolder: makeQueuedPut("folder", sync.putFolder.bind(sync)),
    putTag: makeQueuedPut("tag", sync.putTag.bind(sync)),
    putPreferences: makePrefsQueuedPut(sync.putPreferences.bind(sync)),
  };

  return { sync: wrappedSync, userId, onSyncError: emitToast };
}

export async function mountSyncRuntime() {
  if (mounted) return;
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  mounted = true;

  const session = await getSession();
  if (session?.user) {
    setAuthSession({
      userId: session.user.id,
      email: session.user.email ?? null,
      avatarUrl:
        (session.user.user_metadata?.avatar_url as string | null) ?? null,
    });
    lastUserId = session.user.id;
    try {
      await syncOnStartup(session.user.id, buildDeps());
      mountRealtime(session.user.id); // F13: open Realtime channels
      void purgeTombstones(session.user.id); // F15: fire-and-forget GC
      void refreshQueueSize(); // F18
    } catch (err) {
      emitToast(err);
      setAuthStatus("signed-in");
    }
  }

  // Online event listener — flushes queue when network is restored (spec §5.5 / Q3 D).
  window.addEventListener("online", () => {
    void flushOpportunistic();
  });

  // Initial mount flush if session valid + queue non-empty (spec §5.5).
  if (session?.user.id) {
    const queueSize = (await useStore.getState().syncQueueAdapter?.size()) ?? 0;
    if (queueSize > 0) void flushOpportunistic();
  }

  onAuthChange(async (user) => {
    if (user && user.id !== lastUserId) {
      setAuthStatus("signing-in");
      setAuthSession({
        userId: user.id,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
      lastUserId = user.id;
      try {
        await bootstrapOnSignIn(user.id, buildDeps());
        mountRealtime(user.id); // F13: open Realtime channels after sign-in
        void purgeTombstones(user.id); // F15: fire-and-forget GC
        void refreshQueueSize(); // F18
      } catch (err) {
        emitToast(err);
        setAuthStatus("signed-in");
      }
    } else if (!user && lastUserId) {
      teardownRealtime(); // F13: close channels before clearing session
      setSyncQueueSize(0); // F18: clear queue counter
      setRealtimeConnected(false); // F18: clear connected flag
      setAuthSession(null);
      lastUserId = null;
    }
  });
}

// ============================================================================
// Inbound apply helpers (F13 Realtime). Echo-skip-aware: returns false iff
// the LWW guard inside upsertFromSync returned the same state ref, meaning
// no Zustand or Dexie write was needed.
// ============================================================================

export async function applyInboundBookmark(b: Bookmark): Promise<boolean> {
  const prev = useStore.getState().bookmarks;
  const next = upsertBookmarkFromSync(prev, b);
  if (next === prev) return false;
  useStore.setState({ bookmarks: next });
  await useStore.getState().bookmarksAdapter.put(b);
  return true;
}

export async function applyInboundFolder(f: Folder): Promise<boolean> {
  const prev = useStore.getState().folders;
  const next = upsertFolderFromSync(prev, f);
  if (next === prev) return false;
  useStore.setState({ folders: next });
  await useStore.getState().foldersAdapter.put(f);
  return true;
}

export async function applyInboundTag(t: Tag): Promise<boolean> {
  const prev = useStore.getState().tags;
  const next = upsertTagFromSync(prev, t);
  if (next === prev) return false;
  useStore.setState({ tags: next });
  await useStore.getState().tagsAdapter.put(t);
  return true;
}

// Safety-net cloud pull after Realtime channel reconnect. Reuses existing
// buildDeps + syncOnStartup with try/catch + emitToast fallback so failures
// surface as the standard "Sync failed" toast.
export async function triggerSyncOnStartup(): Promise<void> {
  const userId = useStore.getState().auth.userId;
  if (!userId) return;
  try {
    await syncOnStartup(userId, buildDeps());
  } catch (err) {
    emitToast(err);
    setAuthStatus("signed-in");
  }
}

// Single-shot info toast emitted by realtime-runtime after MAX_RECONNECT
// failed attempts. Shares recentToasts Map + TOAST_COOLDOWN_MS with emitToast
// so re-firing within 30s is suppressed.
export function emitRealtimeDownToast(): void {
  const key = "realtime-down";
  const now = Date.now();
  const last = recentToasts.get(key);
  if (last && now - last < TOAST_COOLDOWN_MS) return;
  recentToasts.set(key, now);
  useStore.setState((s) => ({
    ui: pushToast(s.ui, {
      tone: "error",
      title: "Live sync disconnected",
      description: "Reconnecting in background. Reload if it persists.",
      ttlMs: 6000,
    }),
  }));
}

// ============================================================================
// Realtime DELETE handlers (F16). Mirror of applyInbound* but for
// cross-device tombstone purges fired by F15 GC.
//
// Defensive: only purge if local row is already tombstoned
// (deletedAt !== null). Refuses to delete a live row to protect against
// zombie-DELETE from clock-skewed devices that issued an early GC.
// Returns true iff a Dexie + store mutation occurred; false iff the
// delete was skipped (idempotent or defensive).
// ============================================================================

export async function applyDeleteBookmark(id: BookmarkId): Promise<boolean> {
  const prev = useStore.getState().bookmarks.byId[id];
  if (!prev) return false;
  if (prev.deletedAt === null) return false;

  try {
    await useStore.getState().bookmarksAdapter.remove(id);
  } catch (err) {
    console.warn("[realtime-delete] bookmarks adapter remove failed", id, err);
  }

  useStore.setState((cur) => ({
    bookmarks: removeBookmark(cur.bookmarks, id).next,
  }));
  return true;
}

export async function applyDeleteFolder(id: FolderId): Promise<boolean> {
  const prev = useStore.getState().folders.byId[id];
  if (!prev) return false;
  if (prev.deletedAt === null) return false;

  try {
    await useStore.getState().foldersAdapter.remove(id);
  } catch (err) {
    console.warn("[realtime-delete] folders adapter remove failed", id, err);
  }

  useStore.setState((cur) => {
    const byId = { ...cur.folders.byId };
    delete byId[id];
    return { folders: { ...cur.folders, byId } };
  });
  return true;
}

export async function applyDeleteTag(id: TagId): Promise<boolean> {
  const prev = useStore.getState().tags.byId[id];
  if (!prev) return false;
  if (prev.deletedAt === null) return false;

  try {
    await useStore.getState().tagsAdapter.remove(id);
  } catch (err) {
    console.warn("[realtime-delete] tags adapter remove failed", id, err);
  }

  useStore.setState((cur) => {
    const byId = { ...cur.tags.byId };
    delete byId[id];
    return { tags: { ...cur.tags, byId } };
  });
  return true;
}
