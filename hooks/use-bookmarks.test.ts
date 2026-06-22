/**
 * Hook tests run under jsdom but drive the hook by reading/writing the live
 * store directly. We don't render React — we exercise the boundary that
 * matters: the API components see.
 *
 * The production adapter is replaced with memoryBookmarksAdapter() via
 * useStore.setState before each test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useStore } from "@/store";
import { evictionQueue } from "@/store/eviction-queue";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { initialUiState } from "@/store/slices/ui-slice";
import { previewWorker, mountPreviewWorker } from "@/store/preview-worker";
import { captureWorker, mountCaptureWorker } from "@/store/capture-worker";
import { memoryArticlesAdapter } from "@/lib/db/articles-adapter";
import { memoryEmbeddingsAdapter } from "@/lib/db/embeddings-adapter";
import { memoryHighlightsAdapter } from "@/lib/db/highlights-adapter";
import { memorySnapshotsAdapter } from "@/lib/db/snapshots-adapter";
import { asBookmarkId, buildBookmark, type Article } from "@/types";
import { getUseBookmarksApi } from "./use-bookmarks";

function resetStore() {
  useStore.setState({
    bookmarks: initialBookmarksState,
    ui: initialUiState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    articlesAdapter: memoryArticlesAdapter(),
    embeddingsAdapter: memoryEmbeddingsAdapter(),
    embeddingById: {},
    highlights: { byId: {} },
    highlightsAdapter: memoryHighlightsAdapter(),
    snapshotByBookmarkId: {},
    snapshotsAdapter: memorySnapshotsAdapter(),
    hydrated: true,
  });
  evictionQueue.clear();
}

describe("useBookmarks — add", () => {
  beforeEach(resetStore);

  it("returns ok=true and commits bookmark on success", async () => {
    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_1"),
    });
    const r = await api.add({ url: "https://figma.com" });
    expect(r.ok).toBe(true);
    expect(
      useStore.getState().bookmarks.byId[asBookmarkId("bk_1")]
    ).toBeDefined();
  });

  it("returns ok=false reason='duplicate' and emits info toast + focus on duplicate", async () => {
    const api1 = getUseBookmarksApi({
      now: () => 1,
      id: () => asBookmarkId("bk_1"),
    });
    await api1.add({ url: "https://x.com" });

    const api2 = getUseBookmarksApi({
      now: () => 2,
      id: () => asBookmarkId("bk_2"),
    });
    const r = await api2.add({ url: "HTTPS://x.com/" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("duplicate");
    expect(r.existing?.id).toBe(asBookmarkId("bk_1"));
    const ui = useStore.getState().ui;
    expect(ui.toasts).toHaveLength(1);
    expect(ui.toasts[0]?.tone).toBe("info");
    expect(ui.focusBookmarkId).toBe(asBookmarkId("bk_1"));
  });

  it("returns ok=false reason='error' and emits error toast on adapter throw", async () => {
    useStore.setState({
      bookmarksAdapter: {
        list: async () => [],
        put: async () => {
          throw new Error("disk full");
        },
        remove: async () => {},
        get: async () => null,
      },
    });
    const api = getUseBookmarksApi({
      now: () => 1,
      id: () => asBookmarkId("bk_1"),
    });
    const r = await api.add({ url: "https://x.com" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("error");
    expect(useStore.getState().ui.toasts[0]?.tone).toBe("error");
  });
});

describe("useBookmarks — remove + restore + eviction", () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("remove() soft-deletes, emits undo toast, schedules eviction", async () => {
    vi.setSystemTime(1700000000000);
    const api = getUseBookmarksApi({
      now: () => Date.now(),
      id: () => asBookmarkId("bk_1"),
    });
    await api.add({ url: "https://x.com" });
    await api.remove(asBookmarkId("bk_1"));

    const s = useStore.getState();
    expect(s.bookmarks.byId[asBookmarkId("bk_1")]?.deletedAt).not.toBeNull();
    expect(s.ui.toasts[0]?.action?.intent).toBe("undo");
    expect(evictionQueue.has(asBookmarkId("bk_1"))).toBe(true);
  });

  it("restore() cancels eviction and clears tombstone", async () => {
    vi.setSystemTime(1700000000000);
    const api = getUseBookmarksApi({
      now: () => Date.now(),
      id: () => asBookmarkId("bk_1"),
    });
    await api.add({ url: "https://x.com" });
    await api.remove(asBookmarkId("bk_1"));
    expect(evictionQueue.has(asBookmarkId("bk_1"))).toBe(true);
    await api.restore(asBookmarkId("bk_1"));
    expect(evictionQueue.has(asBookmarkId("bk_1"))).toBe(false);
    expect(
      useStore.getState().bookmarks.byId[asBookmarkId("bk_1")]?.deletedAt
    ).toBeNull();
  });

  it("eviction timer hard-removes after 5000ms", async () => {
    vi.setSystemTime(1700000000000);
    const api = getUseBookmarksApi({
      now: () => Date.now(),
      id: () => asBookmarkId("bk_1"),
    });
    await api.add({ url: "https://x.com" });
    await api.remove(asBookmarkId("bk_1"));
    await vi.advanceTimersByTimeAsync(5000);
    await vi.runAllTimersAsync();
    expect(
      useStore.getState().bookmarks.byId[asBookmarkId("bk_1")]
    ).toBeUndefined();
  });
});

describe("useBookmarks — removeMany (bulk)", () => {
  beforeEach(resetStore);
  it("hard-removes all without scheduling eviction or undo toast", async () => {
    let n = 0;
    const api = getUseBookmarksApi({
      now: () => ++n,
      id: () => asBookmarkId(`bk_${n}`),
    });
    await api.add({ url: "https://a.com" });
    await api.add({ url: "https://b.com" });
    await api.add({ url: "https://c.com" });
    const order = useStore.getState().bookmarks.order;
    await api.removeMany(order);
    expect(useStore.getState().bookmarks.order).toHaveLength(0);
    expect(evictionQueue.size()).toBe(0);
    // bulk path should NOT emit per-item undo toasts
    expect(useStore.getState().ui.toasts).toHaveLength(0);
  });
});

describe("useBookmarks — selection", () => {
  beforeEach(resetStore);
  it("toggle('single') flips id", async () => {
    let n = 0;
    const api = getUseBookmarksApi({
      now: () => ++n,
      id: () => asBookmarkId(`bk_${n}`),
    });
    await api.add({ url: "https://a.com" });
    api.toggle(asBookmarkId("bk_1"), "single");
    expect(useStore.getState().ui.selection.has(asBookmarkId("bk_1"))).toBe(
      true
    );
    api.toggle(asBookmarkId("bk_1"), "single");
    expect(useStore.getState().ui.selection.has(asBookmarkId("bk_1"))).toBe(
      false
    );
  });

  it("toggle('range') picks order-slice between anchor and id", async () => {
    let n = 0;
    const api = getUseBookmarksApi({
      now: () => ++n,
      id: () => asBookmarkId(`bk_${n}`),
    });
    await api.add({ url: "https://a.com" });
    await api.add({ url: "https://b.com" });
    await api.add({ url: "https://c.com" });
    // newest first → order is [bk_3, bk_2, bk_1]
    api.toggle(asBookmarkId("bk_3"), "single"); // anchor
    api.toggle(asBookmarkId("bk_1"), "range");
    expect(useStore.getState().ui.selection.size).toBe(3);
  });
});

describe("useBookmarks.refreshPreview", () => {
  beforeEach(resetStore);

  it("bumps attempt, marks pending, deletes cache row, enqueues worker", async () => {
    const cache = memoryPreviewCacheAdapter();
    const enqueueSpy = vi.fn();
    // Pre-mount a stub worker that records enqueue calls.
    mountPreviewWorker({
      fetchPreview: async () => ({
        ok: true as const,
        title: null,
        description: null,
        ogImage: null,
        favicon: null,
        fetchedAt: 1,
      }),
    });
    // Intercept enqueue via direct singleton swap — simplest seam:
    const w = previewWorker();
    const origEnqueue = w.enqueue;
    w.enqueue = (id) => {
      enqueueSpy(id);
      origEnqueue(id);
    };

    const b = buildBookmark(
      { url: "https://r.test/" },
      { now: () => 1, id: () => asBookmarkId("bk_r") }
    );
    useStore.setState((s) => ({
      bookmarks: { byId: { [b.id]: b }, order: [b.id] },
      previewCacheAdapter: cache,
    }));
    await cache.put({
      url: b.url,
      title: "Cached",
      description: null,
      imageUrl: null,
      faviconUrl: null,
      domain: b.domain,
      fetchedAt: 1,
    });

    const api = getUseBookmarksApi();
    await api.refreshPreview(b.id);

    const out = useStore.getState().bookmarks.byId[b.id]!;
    expect(out.previewStatus).toBe("pending");
    expect(out.previewAttempt).toBe(1);
    expect(out.previewFailureKind).toBeNull();
    expect(await cache.get(b.url)).toBeNull();
    expect(enqueueSpy).toHaveBeenCalledWith(b.id);

    // Light toast was emitted.
    const toasts = useStore.getState().ui.toasts;
    expect(toasts.some((t) => t.title === "Refreshing preview…")).toBe(true);
  });

  it("refreshPreview on tombstoned bookmark is a noop", async () => {
    const b = {
      ...buildBookmark(
        { url: "https://t.test/" },
        { now: () => 1, id: () => asBookmarkId("bk_t") }
      ),
      deletedAt: 99,
    };
    useStore.setState({ bookmarks: { byId: { [b.id]: b }, order: [b.id] } });
    const api = getUseBookmarksApi();
    await api.refreshPreview(b.id);
    expect(useStore.getState().bookmarks.byId[b.id]!.previewAttempt).toBe(0);
  });

  it("refreshPreview on unknown id is a noop", async () => {
    const api = getUseBookmarksApi();
    await api.refreshPreview(asBookmarkId("bk_missing"));
    // No crash; nothing else to assert.
  });

  it("add enqueues the worker on { kind: 'added' }", async () => {
    const enqueueSpy = vi.fn();
    mountPreviewWorker({
      fetchPreview: async () => ({
        ok: true as const,
        title: null,
        description: null,
        ogImage: null,
        favicon: null,
        fetchedAt: 1,
      }),
    });
    const w = previewWorker();
    w.enqueue = (id) => enqueueSpy(id);

    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_new"),
    });
    const r = await api.add({ url: "https://new.test/" });
    expect(r.ok).toBe(true);
    expect(enqueueSpy).toHaveBeenCalledWith(asBookmarkId("bk_new"));
  });
});

describe("useBookmarks.refreshMissingPreviews", () => {
  beforeEach(resetStore);

  it("re-enqueues only bookmarks with no preview image + drops their cache", async () => {
    const cache = memoryPreviewCacheAdapter();
    const enqueueSpy = vi.fn();
    mountPreviewWorker({
      fetchPreview: async () => ({
        ok: true as const,
        title: null,
        description: null,
        ogImage: null,
        favicon: null,
        fetchedAt: 1,
      }),
    });
    const w = previewWorker();
    const orig = w.enqueue;
    w.enqueue = (id) => {
      enqueueSpy(id);
      orig(id);
    };

    const blank = {
      ...buildBookmark(
        { url: "https://blank.test/" },
        { now: () => 1, id: () => asBookmarkId("bk_blank") }
      ),
      previewStatus: "ready" as const,
      previewImageUrl: null,
    };
    const withImg = {
      ...buildBookmark(
        { url: "https://img.test/" },
        { now: () => 1, id: () => asBookmarkId("bk_img") }
      ),
      previewStatus: "ready" as const,
      previewImageUrl: "https://img.test/og.png",
    };
    useStore.setState(() => ({
      bookmarks: {
        byId: { [blank.id]: blank, [withImg.id]: withImg },
        order: [blank.id, withImg.id],
      },
      previewCacheAdapter: cache,
    }));
    await cache.put({
      url: blank.url,
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
      domain: blank.domain,
      fetchedAt: 1,
    });

    const api = getUseBookmarksApi();
    const n = await api.refreshMissingPreviews();

    expect(n).toBe(1);
    expect(enqueueSpy).toHaveBeenCalledWith(blank.id);
    expect(enqueueSpy).not.toHaveBeenCalledWith(withImg.id);
    expect(useStore.getState().bookmarks.byId[blank.id]!.previewStatus).toBe(
      "pending"
    );
    expect(useStore.getState().bookmarks.byId[blank.id]!.previewAttempt).toBe(
      1
    );
    expect(await cache.get(blank.url)).toBeNull();
  });

  it("returns 0 when nothing is missing a preview", async () => {
    const withImg = {
      ...buildBookmark(
        { url: "https://img.test/" },
        { now: () => 1, id: () => asBookmarkId("bk_img2") }
      ),
      previewStatus: "ready" as const,
      previewImageUrl: "https://img.test/og.png",
    };
    useStore.setState({
      bookmarks: { byId: { [withImg.id]: withImg }, order: [withImg.id] },
    });
    const api = getUseBookmarksApi();
    expect(await api.refreshMissingPreviews()).toBe(0);
  });
});

describe("useBookmarks — setReadState (feature 22)", () => {
  beforeEach(resetStore);

  it("persists new readState, updates store, emits info toast", async () => {
    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_rs"),
    });
    await api.add({ url: "https://rs.test/" });
    await api.setReadState(asBookmarkId("bk_rs"), "reading");
    const s = useStore.getState();
    expect(s.bookmarks.byId[asBookmarkId("bk_rs")]!.readState).toBe("reading");
    expect(s.ui.toasts.some((t) => /reading/i.test(t.title))).toBe(true);
  });

  it("no-ops (no toast) when already in the target state", async () => {
    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_rs2"),
    });
    await api.add({ url: "https://rs2.test/" });
    const toastsBefore = useStore.getState().ui.toasts.length;
    await api.setReadState(asBookmarkId("bk_rs2"), "inbox");
    expect(useStore.getState().ui.toasts.length).toBe(toastsBefore);
  });
});

describe("useBookmarks — article capture (feature 23)", () => {
  beforeEach(resetStore);

  it("add enqueues the capture worker", async () => {
    const enqueueSpy = vi.fn();
    mountCaptureWorker({
      fetchArticle: async () => ({
        ok: false,
        kind: "network",
        retriable: true,
      }),
    });
    captureWorker().enqueue = (id) => enqueueSpy(id);
    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_cap"),
    });
    await api.add({ url: "https://cap.test/" });
    expect(enqueueSpy).toHaveBeenCalledWith(asBookmarkId("bk_cap"));
  });

  it("recaptureArticle bumps captureAttempt, resets to pending, toasts", async () => {
    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_rc"),
    });
    await api.add({ url: "https://rc.test/" });
    // simulate a prior failure
    useStore.setState((s) => ({
      bookmarks: {
        byId: {
          ...s.bookmarks.byId,
          [asBookmarkId("bk_rc")]: {
            ...s.bookmarks.byId[asBookmarkId("bk_rc")]!,
            captureStatus: "failed",
            captureFailureKind: "permanent",
          },
        },
        order: s.bookmarks.order,
      },
    }));
    await api.recaptureArticle(asBookmarkId("bk_rc"));
    const b = useStore.getState().bookmarks.byId[asBookmarkId("bk_rc")]!;
    expect(b.captureStatus).toBe("pending");
    expect(b.captureAttempt).toBe(1);
    expect(
      useStore.getState().ui.toasts.some((t) => /capturing/i.test(t.title))
    ).toBe(true);
  });

  it("removeMany drops the captured article row", async () => {
    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_del"),
    });
    await api.add({ url: "https://del.test/" });
    const article: Article = {
      bookmarkId: asBookmarkId("bk_del"),
      html: "<p>x</p>",
      textContent: "x",
      title: "T",
      byline: null,
      excerpt: null,
      siteName: null,
      publishedTime: null,
      readingMinutes: 1,
      heroImageUrl: null,
      capturedAt: 1,
      summary: null,
    };
    await useStore.getState().articlesAdapter.put(article);
    await api.removeMany([asBookmarkId("bk_del")]);
    expect(
      await useStore.getState().articlesAdapter.get(asBookmarkId("bk_del"))
    ).toBeNull();
  });
});

describe("useBookmarks — setReadProgress (feature 24)", () => {
  beforeEach(resetStore);

  it("writes clamped readProgress, no toast", async () => {
    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_rp"),
    });
    await api.add({ url: "https://rp.test/" });
    const toastsBefore = useStore.getState().ui.toasts.length;
    await api.setReadProgress(asBookmarkId("bk_rp"), 1.5);
    const b = useStore.getState().bookmarks.byId[asBookmarkId("bk_rp")]!;
    expect(b.readProgress).toBe(1);
    expect(useStore.getState().ui.toasts.length).toBe(toastsBefore);
  });

  it("no-ops on missing id", async () => {
    const api = getUseBookmarksApi();
    await api.setReadProgress(asBookmarkId("bk_missing"), 0.5);
    // no throw, nothing to assert
  });
});

describe("useBookmarks — full-text corpus cleanup (feature 26)", () => {
  beforeEach(resetStore);
  it("removeMany drops the bookmark's articleText entry", async () => {
    const api = getUseBookmarksApi({
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_ftc"),
    });
    await api.add({ url: "https://ftc.test/" });
    useStore.setState((s) => ({
      articleText: {
        ...s.articleText,
        [asBookmarkId("bk_ftc")]: "indexed body",
      },
    }));
    await api.removeMany([asBookmarkId("bk_ftc")]);
    expect(
      useStore.getState().articleText[asBookmarkId("bk_ftc")]
    ).toBeUndefined();
  });
});
