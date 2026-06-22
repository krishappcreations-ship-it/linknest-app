/**
 * Preview worker — feature 02.
 *
 * Singleton (in production) that drains `previewStatus: "pending"` rows
 * from the Zustand store. Event-driven — kick()/enqueue() are the only
 * triggers; no polling. Concurrency cap defaults to 3.
 *
 * Task 8 layers transient retry at 30s + permanent failure path on top of
 * the Task 7 cache-first skeleton.
 */

import { useStore } from "@/store";
import type { PreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import {
  applyUpdatePreviewSuccess,
  applyUpdatePreviewFailure,
  selectBookmarkById,
} from "@/store/slices/bookmarks-slice";
import type { Bookmark, BookmarkId, PreviewResponse } from "@/types";

/**
 * Merge ONLY the preview-owned fields of `updated` onto the latest store copy
 * of the bookmark. Functional setState avoids clobbering a concurrent
 * capture-worker write to the same bookmark (both apply* helpers build their
 * result from a pre-await snapshot; writing it whole would revert
 * captureStatus). See store/capture-worker.ts mergeCaptureFields.
 */
function mergePreviewFields(id: BookmarkId, updated: Bookmark): void {
  useStore.setState((s) => {
    const cur = s.bookmarks.byId[id];
    if (!cur) return {};
    return {
      bookmarks: {
        byId: {
          ...s.bookmarks.byId,
          [id]: {
            ...cur,
            title: updated.title,
            description: updated.description,
            previewImageUrl: updated.previewImageUrl,
            faviconUrl: updated.faviconUrl,
            previewStatus: updated.previewStatus,
            previewFailureKind: updated.previewFailureKind,
            updatedAt: updated.updatedAt,
          },
        },
        order: s.bookmarks.order,
      },
    };
  });
}

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 30_000;

export interface PreviewWorker {
  kick(): void;
  enqueue(id: BookmarkId): void;
  inflight(): number;
  pending(): number;
  clear(): void;
}

export interface PreviewWorkerCtx {
  fetchPreview: (url: string) => Promise<PreviewResponse>;
  now?: () => number;
  concurrency?: number;
  cacheTtlMs?: number;
  retryDelayMs?: number;
}

export function createPreviewWorker(ctx: PreviewWorkerCtx): PreviewWorker {
  const concurrency = ctx.concurrency ?? DEFAULT_CONCURRENCY;
  const cacheTtlMs = ctx.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const retryDelayMs = ctx.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const now = ctx.now ?? Date.now;
  const queue: BookmarkId[] = [];
  const inflight = new Set<BookmarkId>();
  const retryTimers = new Map<BookmarkId, ReturnType<typeof setTimeout>>();
  // Track which ids have already consumed their single retry budget.
  const retryAttempted = new Set<BookmarkId>();
  // Deviation from plan: ids that called enqueue() while in-flight after an
  // attempt bump (manual refresh path). The current process() finally re-
  // enqueues them after the stale result settles, so the fresh attempt runs.
  const pendingReEnqueue = new Set<BookmarkId>();

  function clearRetry(id: BookmarkId): void {
    const t = retryTimers.get(id);
    if (t) {
      clearTimeout(t);
      retryTimers.delete(id);
    }
  }

  function kick(): void {
    const state = useStore.getState();
    for (const id of state.bookmarks.order) {
      const b = state.bookmarks.byId[id];
      if (!b || b.deletedAt !== null) continue;
      if (b.previewStatus !== "pending") continue;
      enqueue(id);
    }
  }

  function enqueue(id: BookmarkId): void {
    // If a manual refresh has bumped the attempt counter, reset retry state
    // so the fresh attempt gets its own retry budget.
    const b = selectBookmarkById(useStore.getState().bookmarks, id);
    const refreshed = !!b && b.previewAttempt > 0;
    if (refreshed) {
      retryAttempted.delete(id);
      clearRetry(id);
    }
    if (inflight.has(id) || queue.includes(id)) {
      // Refresh case: in-flight call's result will be discarded by the slice
      // guard, so defer re-enqueue until the current process() settles.
      if (refreshed && inflight.has(id)) pendingReEnqueue.add(id);
      return;
    }
    queue.push(id);
    pump();
  }

  function pump(): void {
    while (queue.length > 0 && inflight.size < concurrency) {
      const id = queue.shift()!;
      inflight.add(id);
      // Fire-and-forget; the promise body owns its own cleanup.
      void process(id);
    }
  }

  async function process(id: BookmarkId): Promise<void> {
    try {
      const bookmark = selectBookmarkById(useStore.getState().bookmarks, id);
      if (!bookmark || bookmark.deletedAt !== null) return;
      if (bookmark.previewStatus !== "pending") return;
      const expectedAttempt = bookmark.previewAttempt;

      // Cache-first: skip the network if a fresh entry exists.
      const cache = useStore.getState().previewCacheAdapter;
      const cached = await cache.get(bookmark.url);
      if (cached && now() - cached.fetchedAt < cacheTtlMs) {
        await commitCacheHit(id, expectedAttempt, cached);
        return;
      }

      const res = await ctx.fetchPreview(bookmark.url);
      await commitResult(id, bookmark.url, expectedAttempt, res, cache);
    } catch {
      // Defensive: never throw out of the queue loop. A failed callback
      // is logged via the slice helpers' rolled-back path.
    } finally {
      inflight.delete(id);
      if (pendingReEnqueue.has(id)) {
        pendingReEnqueue.delete(id);
        enqueue(id);
      }
      pump();
    }
  }

  async function commitCacheHit(
    id: BookmarkId,
    expectedAttempt: number,
    cached: {
      title: string | null;
      description: string | null;
      imageUrl: string | null;
      faviconUrl: string | null;
    }
  ): Promise<void> {
    const adapter = useStore.getState().bookmarksAdapter;
    const r = await applyUpdatePreviewSuccess(
      useStore.getState().bookmarks,
      {
        id,
        title: cached.title,
        description: cached.description,
        imageUrl: cached.imageUrl,
        faviconUrl: cached.faviconUrl,
        expectedAttempt,
      },
      { adapter, now }
    );
    if (r.wrote) mergePreviewFields(id, r.state.byId[id]!);
  }

  async function commitResult(
    id: BookmarkId,
    url: string,
    expectedAttempt: number,
    res: PreviewResponse,
    cache: PreviewCacheAdapter
  ): Promise<void> {
    const adapter = useStore.getState().bookmarksAdapter;
    if (res.ok) {
      const bookmark = selectBookmarkById(useStore.getState().bookmarks, id);
      // Write cache regardless of subsequent slice guards — cache row is
      // keyed by url, not id, so a stale-attempt write that drops on the
      // bookmark side is still useful for future re-adds.
      try {
        await cache.put({
          url,
          title: res.title,
          description: res.description,
          imageUrl: res.ogImage,
          faviconUrl: res.favicon,
          domain: bookmark?.domain ?? new URL(url).hostname,
          fetchedAt: res.fetchedAt,
        });
      } catch {
        // Non-fatal — proceed to apply the success to the bookmark.
      }
      const r = await applyUpdatePreviewSuccess(
        useStore.getState().bookmarks,
        {
          id,
          title: res.title,
          description: res.description,
          imageUrl: res.ogImage,
          faviconUrl: res.favicon,
          expectedAttempt,
        },
        { adapter, now }
      );
      if (r.wrote) mergePreviewFields(id, r.state.byId[id]!);
    } else {
      // Retry policy:
      //   first failure + retriable → transient + 30s timer
      //   second failure (any kind) → permanent
      //   first failure + !retriable → permanent (no retry budget consumed)
      const isFirstAttempt = !retryAttempted.has(id);
      const finalKind: "transient" | "permanent" =
        res.retriable && isFirstAttempt ? "transient" : "permanent";
      const r = await applyUpdatePreviewFailure(
        useStore.getState().bookmarks,
        { id, kind: finalKind, expectedAttempt },
        { adapter, now }
      );
      if (r.wrote) mergePreviewFields(id, r.state.byId[id]!);

      if (finalKind === "transient") {
        retryAttempted.add(id);
        clearRetry(id);
        const timer = setTimeout(() => {
          retryTimers.delete(id);
          // Re-mark bookmark as pending so the pump picks it up. Guarded by
          // attempt + tombstone to avoid clobbering a fresh manual refresh.
          useStore.setState((s) => {
            const prev = s.bookmarks.byId[id];
            if (!prev || prev.deletedAt !== null) return {};
            if (prev.previewAttempt !== expectedAttempt) return {};
            return {
              bookmarks: {
                byId: {
                  ...s.bookmarks.byId,
                  [id]: {
                    ...prev,
                    previewStatus: "pending",
                    previewFailureKind: null,
                  },
                },
                order: s.bookmarks.order,
              },
            };
          });
          enqueue(id);
        }, retryDelayMs);
        retryTimers.set(id, timer);
      } else {
        // Permanent — reset retry tracking so a manual refresh starts fresh.
        retryAttempted.delete(id);
      }
    }
  }

  return {
    kick,
    enqueue,
    inflight: () => inflight.size,
    pending: () => queue.length,
    clear: () => {
      for (const t of retryTimers.values()) clearTimeout(t);
      retryTimers.clear();
      retryAttempted.clear();
      pendingReEnqueue.clear();
      queue.length = 0;
      inflight.clear();
    },
  };
}

/** Production singleton handle — mounted by store/index.ts after hydrate. */
let singleton: PreviewWorker | null = null;
export function mountPreviewWorker(ctx: PreviewWorkerCtx): PreviewWorker {
  if (singleton) singleton.clear();
  singleton = createPreviewWorker(ctx);
  return singleton;
}
export function previewWorker(): PreviewWorker {
  if (!singleton) {
    // No-op stub until mounted (SSR / tests that don't mount).
    return {
      kick: () => {},
      enqueue: () => {},
      inflight: () => 0,
      pending: () => 0,
      clear: () => {},
    };
  }
  return singleton;
}

/**
 * Whether a singleton worker has been mounted. Used by `hydrateFromDexie`
 * to avoid clobbering a test-pre-mounted worker with the production fetcher.
 */
export function previewWorkerMounted(): boolean {
  return singleton !== null;
}
