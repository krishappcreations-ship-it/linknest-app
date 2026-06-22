import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createPreviewWorker } from "@/store/preview-worker";
import { useStore } from "@/store";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import {
  asBookmarkId,
  buildBookmark,
  type Bookmark,
  type BookmarkId,
  type PreviewResponse,
} from "@/types";

function bookmark(id: string, urlSuffix = id): Bookmark {
  return buildBookmark(
    { url: `https://example.com/${urlSuffix}` },
    { now: () => 1700000000000, id: () => asBookmarkId(`bk_${id}`) }
  );
}

function seedStore(
  rows: Bookmark[],
  cacheAdapter = memoryPreviewCacheAdapter()
) {
  const byId: Record<string, Bookmark> = {};
  const order: BookmarkId[] = [];
  for (const b of rows) {
    byId[b.id] = b;
    order.push(b.id);
  }
  useStore.setState({
    bookmarks: { byId, order },
    bookmarksAdapter: memoryBookmarksAdapter(),
    previewCacheAdapter: cacheAdapter,
    hydrated: true,
  });
  // Mirror rows into the bookmark adapter so apply* writes succeed.
  for (const b of rows) {
    void useStore.getState().bookmarksAdapter.put(b);
  }
  return cacheAdapter;
}

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    previewCacheAdapter: memoryPreviewCacheAdapter(),
    hydrated: false,
  });
});
afterEach(() => {
  vi.useRealTimers();
});

const okResponse: PreviewResponse = {
  ok: true,
  title: "T",
  description: "D",
  ogImage: "https://i.test/og.png",
  favicon: "https://i.test/favicon.ico",
  fetchedAt: 1700000001000,
};

describe("previewWorker sweep + concurrency", () => {
  it("kick on empty store is a noop", () => {
    const w = createPreviewWorker({ fetchPreview: vi.fn() });
    w.kick();
    expect(w.inflight()).toBe(0);
    expect(w.pending()).toBe(0);
  });

  it("kick with one pending bookmark drives it to ready", async () => {
    const b = bookmark("a");
    seedStore([b]);
    const fetchPreview = vi.fn(async () => okResponse);
    const w = createPreviewWorker({ fetchPreview });
    w.kick();
    // Drain microtasks until worker settles
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    expect(fetchPreview).toHaveBeenCalledTimes(1);
    expect(useStore.getState().bookmarks.byId[b.id]!.previewStatus).toBe(
      "ready"
    );
  });

  it("respects concurrency cap of 3 with 5 pending", async () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) => bookmark(id));
    seedStore(rows);
    let resolve!: (v: PreviewResponse) => void;
    const release = new Promise<PreviewResponse>((r) => (resolve = r));
    const fetchPreview = vi.fn(async () => release);
    const w = createPreviewWorker({ fetchPreview, concurrency: 3 });
    w.kick();
    // After kick, 3 are in-flight, 2 are queued.
    await vi.waitFor(() => expect(w.inflight()).toBe(3));
    expect(w.pending()).toBe(2);
    resolve(okResponse);
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    expect(fetchPreview).toHaveBeenCalledTimes(5);
  });

  it("only enqueues bookmarks with previewStatus pending", async () => {
    const pending = bookmark("p");
    const ready: Bookmark = { ...bookmark("r"), previewStatus: "ready" };
    const failed: Bookmark = {
      ...bookmark("f"),
      previewStatus: "failed",
      previewFailureKind: "permanent",
    };
    seedStore([pending, ready, failed]);
    const fetchPreview = vi.fn(async () => okResponse);
    const w = createPreviewWorker({ fetchPreview });
    w.kick();
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    expect(fetchPreview).toHaveBeenCalledTimes(1);
  });

  it("skips tombstoned bookmarks", async () => {
    const tomb: Bookmark = { ...bookmark("t"), deletedAt: 5 };
    seedStore([tomb]);
    const fetchPreview = vi.fn(async () => okResponse);
    const w = createPreviewWorker({ fetchPreview });
    w.kick();
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    expect(fetchPreview).not.toHaveBeenCalled();
  });

  it("enqueue on same id while in-flight is a noop", async () => {
    const b = bookmark("a");
    seedStore([b]);
    let resolve!: (v: PreviewResponse) => void;
    const release = new Promise<PreviewResponse>((r) => (resolve = r));
    const fetchPreview = vi.fn(async () => release);
    const w = createPreviewWorker({ fetchPreview });
    w.enqueue(b.id);
    w.enqueue(b.id);
    await vi.waitFor(() => expect(w.inflight()).toBe(1));
    expect(fetchPreview).toHaveBeenCalledTimes(1);
    resolve(okResponse);
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
  });
});

describe("previewWorker cache integration", () => {
  it("cache hit (fresh) bypasses fetch and marks ready", async () => {
    const b = bookmark("a");
    const cache = memoryPreviewCacheAdapter();
    await cache.put({
      url: b.url,
      title: "Cached",
      description: "From cache",
      imageUrl: "https://i.test/cached-og.png",
      faviconUrl: "https://i.test/cached-fav.ico",
      domain: b.domain,
      fetchedAt: 1700000000000,
    });
    seedStore([b], cache);
    const fetchPreview = vi.fn(async () => okResponse);
    const w = createPreviewWorker({
      fetchPreview,
      now: () => 1700000000000 + 1000, // 1s after cache write
    });
    w.kick();
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    expect(fetchPreview).not.toHaveBeenCalled();
    const out = useStore.getState().bookmarks.byId[b.id]!;
    expect(out.previewStatus).toBe("ready");
    expect(out.previewImageUrl).toBe("https://i.test/cached-og.png");
    expect(out.title).toBe("Cached");
  });

  it("cache hit (stale > 30d) refetches", async () => {
    const b = bookmark("a");
    const cache = memoryPreviewCacheAdapter();
    const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60 * 1000;
    await cache.put({
      url: b.url,
      title: "Stale",
      description: null,
      imageUrl: null,
      faviconUrl: null,
      domain: b.domain,
      fetchedAt: 1700000000000,
    });
    seedStore([b], cache);
    const fetchPreview = vi.fn(async () => okResponse);
    const w = createPreviewWorker({
      fetchPreview,
      now: () => 1700000000000 + THIRTY_ONE_DAYS,
    });
    w.kick();
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    expect(fetchPreview).toHaveBeenCalledTimes(1);
  });

  it("cache miss writes back to cache on success", async () => {
    const b = bookmark("a");
    const cache = memoryPreviewCacheAdapter();
    seedStore([b], cache);
    const fetchPreview = vi.fn(async () => okResponse);
    const w = createPreviewWorker({ fetchPreview });
    w.kick();
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    const cached = await cache.get(b.url);
    expect(cached).not.toBeNull();
    expect(cached!.title).toBe("T");
    expect(cached!.imageUrl).toBe("https://i.test/og.png");
  });

  it("does not write cache on failure", async () => {
    const b = bookmark("a");
    const cache = memoryPreviewCacheAdapter();
    seedStore([b], cache);
    const fetchPreview = vi.fn(
      async (): Promise<PreviewResponse> => ({
        ok: false,
        kind: "http_error",
        retriable: false,
      })
    );
    const w = createPreviewWorker({ fetchPreview });
    w.kick();
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    expect(await cache.get(b.url)).toBeNull();
    expect(useStore.getState().bookmarks.byId[b.id]!.previewStatus).toBe(
      "failed"
    );
  });
});

describe("previewWorker retry policy", () => {
  it("transient failure → schedules 30s retry → second success → ready", async () => {
    vi.useFakeTimers();
    const b = bookmark("a");
    seedStore([b]);
    let calls = 0;
    const fetchPreview = vi.fn(async (): Promise<PreviewResponse> => {
      calls++;
      if (calls === 1) {
        return { ok: false, kind: "timeout", retriable: true };
      }
      return okResponse;
    });
    const w = createPreviewWorker({ fetchPreview, retryDelayMs: 30_000 });
    w.kick();
    await vi.waitFor(() =>
      expect(useStore.getState().bookmarks.byId[b.id]!.previewStatus).toBe(
        "failed"
      )
    );
    expect(useStore.getState().bookmarks.byId[b.id]!.previewFailureKind).toBe(
      "transient"
    );
    // Fast-forward through the retry timer.
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() =>
      expect(useStore.getState().bookmarks.byId[b.id]!.previewStatus).toBe(
        "ready"
      )
    );
    expect(fetchPreview).toHaveBeenCalledTimes(2);
  });

  it("transient failure → retry → second failure → permanent", async () => {
    vi.useFakeTimers();
    const b = bookmark("a");
    seedStore([b]);
    const fetchPreview = vi.fn(
      async (): Promise<PreviewResponse> => ({
        ok: false,
        kind: "network",
        retriable: true,
      })
    );
    const w = createPreviewWorker({ fetchPreview, retryDelayMs: 30_000 });
    w.kick();
    await vi.waitFor(() =>
      expect(useStore.getState().bookmarks.byId[b.id]!.previewFailureKind).toBe(
        "transient"
      )
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.waitFor(() =>
      expect(useStore.getState().bookmarks.byId[b.id]!.previewFailureKind).toBe(
        "permanent"
      )
    );
    expect(fetchPreview).toHaveBeenCalledTimes(2);
  });

  it("permanent failure → no retry", async () => {
    vi.useFakeTimers();
    const b = bookmark("a");
    seedStore([b]);
    const fetchPreview = vi.fn(
      async (): Promise<PreviewResponse> => ({
        ok: false,
        kind: "blocked",
        retriable: false,
      })
    );
    const w = createPreviewWorker({ fetchPreview, retryDelayMs: 30_000 });
    w.kick();
    await vi.waitFor(() =>
      expect(useStore.getState().bookmarks.byId[b.id]!.previewFailureKind).toBe(
        "permanent"
      )
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchPreview).toHaveBeenCalledTimes(1);
  });

  it("refresh increments attempt — in-flight result is discarded", async () => {
    const b = bookmark("a");
    seedStore([b]);
    let resolve!: (v: PreviewResponse) => void;
    const first = new Promise<PreviewResponse>((r) => (resolve = r));
    let calls = 0;
    const fetchPreview = vi.fn(async (): Promise<PreviewResponse> => {
      calls++;
      if (calls === 1) return first;
      return okResponse;
    });
    const w = createPreviewWorker({ fetchPreview });
    w.kick();
    await vi.waitFor(() => expect(w.inflight()).toBe(1));
    // Simulate the user clicking refresh while the first fetch is in flight:
    useStore.setState((s) => ({
      bookmarks: {
        byId: {
          ...s.bookmarks.byId,
          [b.id]: {
            ...s.bookmarks.byId[b.id]!,
            previewAttempt: 1,
            previewStatus: "pending",
            previewFailureKind: null,
          },
        },
        order: s.bookmarks.order,
      },
    }));
    w.enqueue(b.id);
    // Now release the first fetch — its expectedAttempt was 0, but the
    // bookmark is now at attempt 1. Slice ghost-write guard discards it.
    resolve(okResponse);
    await vi.waitFor(() => expect(w.inflight() + w.pending()).toBe(0));
    expect(fetchPreview).toHaveBeenCalledTimes(2);
    expect(useStore.getState().bookmarks.byId[b.id]!.previewStatus).toBe(
      "ready"
    );
  });

  it("clear() cancels queued + in-flight + retry timers", async () => {
    vi.useFakeTimers();
    const rows = ["a", "b", "c", "d"].map((id) => bookmark(id));
    seedStore(rows);
    let resolve!: (v: PreviewResponse) => void;
    const release = new Promise<PreviewResponse>((r) => (resolve = r));
    const fetchPreview = vi.fn(async () => release);
    const w = createPreviewWorker({
      fetchPreview,
      concurrency: 2,
      retryDelayMs: 30_000,
    });
    w.kick();
    await vi.waitFor(() => expect(w.inflight()).toBe(2));
    w.clear();
    expect(w.inflight()).toBe(0);
    expect(w.pending()).toBe(0);
    resolve(okResponse); // settle any dangling promises
    await vi.advanceTimersByTimeAsync(60_000);
    // No additional fetches after clear.
  });
});
