/**
 * Capture worker — feature 23. Clone of store/preview-worker.ts.
 *
 * Singleton (in production) that drains `captureStatus: "pending"` bookmarks
 * from the Zustand store, fetches a readable snapshot via /api/capture, and
 * writes the resulting Article to the local `articles` table. Event-driven
 * (kick/enqueue), concurrency cap 3, transient-retry-once + permanent failure,
 * attempt-counter ghost-write guard. No url cache — the articles table keyed
 * by bookmarkId is the store.
 */

import { useStore } from "@/store";
import {
  applyUpdateCaptureSuccess,
  applyUpdateCaptureFailure,
  selectBookmarkById,
} from "@/store/slices/bookmarks-slice";
import { truncateForIndex } from "@/lib/search/truncate-for-index";
import { embedWorker } from "@/store/embed-worker";
import type { Bookmark, BookmarkId, CaptureResponse } from "@/types";

/**
 * Merge ONLY the capture-owned fields of `updated` onto the latest store copy
 * of the bookmark. Functional setState reads the freshest state at write time,
 * so a concurrent preview-worker write to the same bookmark is never clobbered
 * (the apply* helper built `updated` from a pre-await snapshot — writing it
 * whole would revert previewStatus).
 */
function mergeCaptureFields(id: BookmarkId, updated: Bookmark): void {
  useStore.setState((s) => {
    const cur = s.bookmarks.byId[id];
    if (!cur) return {};
    return {
      bookmarks: {
        byId: {
          ...s.bookmarks.byId,
          [id]: {
            ...cur,
            captureStatus: updated.captureStatus,
            captureFailureKind: updated.captureFailureKind,
            updatedAt: updated.updatedAt,
          },
        },
        order: s.bookmarks.order,
      },
    };
  });
}

const DEFAULT_CONCURRENCY = 3;
const DEFAULT_RETRY_DELAY_MS = 30_000;

export interface CaptureWorker {
  kick(): void;
  enqueue(id: BookmarkId): void;
  inflight(): number;
  pending(): number;
  clear(): void;
}

export interface CaptureWorkerCtx {
  fetchArticle: (url: string) => Promise<CaptureResponse>;
  now?: () => number;
  concurrency?: number;
  retryDelayMs?: number;
}

export function createCaptureWorker(ctx: CaptureWorkerCtx): CaptureWorker {
  const concurrency = ctx.concurrency ?? DEFAULT_CONCURRENCY;
  const retryDelayMs = ctx.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const now = ctx.now ?? Date.now;
  const queue: BookmarkId[] = [];
  const inflight = new Set<BookmarkId>();
  const retryTimers = new Map<BookmarkId, ReturnType<typeof setTimeout>>();
  const retryAttempted = new Set<BookmarkId>();
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
      if (b.captureStatus !== "pending") continue;
      enqueue(id);
    }
  }

  function enqueue(id: BookmarkId): void {
    const b = selectBookmarkById(useStore.getState().bookmarks, id);
    const refreshed = !!b && b.captureAttempt > 0;
    if (refreshed) {
      retryAttempted.delete(id);
      clearRetry(id);
    }
    if (inflight.has(id) || queue.includes(id)) {
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
      void process(id);
    }
  }

  async function process(id: BookmarkId): Promise<void> {
    try {
      const bookmark = selectBookmarkById(useStore.getState().bookmarks, id);
      if (!bookmark || bookmark.deletedAt !== null) return;
      if (bookmark.captureStatus !== "pending") return;
      const expectedAttempt = bookmark.captureAttempt;
      const res = await ctx.fetchArticle(bookmark.url);
      await commitCapture(id, expectedAttempt, res);
    } catch {
      // Defensive: never throw out of the queue loop.
    } finally {
      inflight.delete(id);
      if (pendingReEnqueue.has(id)) {
        pendingReEnqueue.delete(id);
        enqueue(id);
      }
      pump();
    }
  }

  async function commitCapture(
    id: BookmarkId,
    expectedAttempt: number,
    res: CaptureResponse
  ): Promise<void> {
    const bAdapter = useStore.getState().bookmarksAdapter;
    if (res.ok) {
      // Write the article regardless of the subsequent bookmark guard — the
      // articles row is keyed by bookmarkId; a fresh re-capture overwrites it.
      try {
        await useStore.getState().articlesAdapter.put({
          bookmarkId: id,
          html: res.html,
          textContent: res.textContent,
          title: res.title,
          byline: res.byline,
          excerpt: res.excerpt,
          siteName: res.siteName,
          publishedTime: res.publishedTime,
          readingMinutes: res.readingMinutes,
          heroImageUrl: res.heroImageUrl,
          capturedAt: res.fetchedAt,
          summary: null,
        });
      } catch {
        // Non-fatal — flip status anyway; re-capture will retry the article write.
      }
      // F26/F27: fold the body + reading-minutes into the in-memory corpora.
      useStore.setState((s) => ({
        articleText: {
          ...s.articleText,
          [id]: truncateForIndex(res.textContent),
        },
        articleReadingMinutes: {
          ...s.articleReadingMinutes,
          [id]: res.readingMinutes,
        },
      }));
      const r = await applyUpdateCaptureSuccess(
        useStore.getState().bookmarks,
        { id, expectedAttempt },
        { adapter: bAdapter, now }
      );
      if (r.wrote) mergeCaptureFields(id, r.state.byId[id]!);
      // F28: re-embed now that article body is available (enqueue forces a
      // re-embed even if a title+description vector already exists).
      embedWorker().enqueue(id);
    } else {
      const isFirstAttempt = !retryAttempted.has(id);
      const finalKind: "transient" | "permanent" =
        res.retriable && isFirstAttempt ? "transient" : "permanent";
      const r = await applyUpdateCaptureFailure(
        useStore.getState().bookmarks,
        { id, kind: finalKind, expectedAttempt },
        { adapter: bAdapter, now }
      );
      if (r.wrote) mergeCaptureFields(id, r.state.byId[id]!);

      if (finalKind === "transient") {
        retryAttempted.add(id);
        clearRetry(id);
        const timer = setTimeout(() => {
          retryTimers.delete(id);
          useStore.setState((s) => {
            const prev = s.bookmarks.byId[id];
            if (!prev || prev.deletedAt !== null) return {};
            if (prev.captureAttempt !== expectedAttempt) return {};
            return {
              bookmarks: {
                byId: {
                  ...s.bookmarks.byId,
                  [id]: {
                    ...prev,
                    captureStatus: "pending",
                    captureFailureKind: null,
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
let singleton: CaptureWorker | null = null;
export function mountCaptureWorker(ctx: CaptureWorkerCtx): CaptureWorker {
  if (singleton) singleton.clear();
  singleton = createCaptureWorker(ctx);
  return singleton;
}
export function captureWorker(): CaptureWorker {
  if (!singleton) {
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

export function captureWorkerMounted(): boolean {
  return singleton !== null;
}
