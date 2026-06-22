import { describe, expect, it, beforeEach, vi } from "vitest";
import { useStore, hydrateFromDexie } from "@/store";
import { previewWorker, mountPreviewWorker } from "@/store/preview-worker";
import { mountEmbedWorker } from "@/store/embed-worker";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryArticlesAdapter } from "@/lib/db/articles-adapter";
import { memoryEmbeddingsAdapter } from "@/lib/db/embeddings-adapter";
import { memoryHighlightsAdapter } from "@/lib/db/highlights-adapter";
import { memorySnapshotsAdapter } from "@/lib/db/snapshots-adapter";
import { memorySmartCollectionsAdapter } from "@/lib/db/smart-collections-adapter";
import { initialSmartCollectionsState } from "@/store/slices/smart-collections-slice";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { initialFoldersState } from "@/store/slices/folders-slice";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { initialTagsState } from "@/store/slices/tags-slice";
import { memoryPreferencesAdapter } from "@/lib/db/preferences-adapter";
import { initialPreferencesState } from "@/store/slices/preferences-slice";
import { buildTag, asTagId } from "@/types";
import { buildBookmark, asBookmarkId } from "@/types";

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    folders: initialFoldersState,
    tags: initialTagsState,
    preferences: initialPreferencesState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    previewCacheAdapter: memoryPreviewCacheAdapter(),
    articlesAdapter: memoryArticlesAdapter(),
    foldersAdapter: memoryFoldersAdapter(),
    tagsAdapter: memoryTagsAdapter(),
    preferencesAdapter: memoryPreferencesAdapter(),
    articleText: {},
    articleReadingMinutes: {},
    smartCollections: initialSmartCollectionsState,
    smartCollectionsAdapter: memorySmartCollectionsAdapter(),
    embeddingById: {},
    embeddingsAdapter: memoryEmbeddingsAdapter(),
    highlights: { byId: {} },
    highlightsAdapter: memoryHighlightsAdapter(),
    snapshotByBookmarkId: {},
    snapshotsAdapter: memorySnapshotsAdapter(),
    hydrated: false,
  });
  // Pre-mount a stub embed worker so hydrate's kick never loads the real
  // Transformers.js model in jsdom (mirrors the preview/capture stubs).
  mountEmbedWorker({ embed: async () => [] });
});

describe("hydrateFromDexie + worker mount", () => {
  it("hydrates without blasting previews (viewport-first); enqueue still fetches", async () => {
    const adapter = memoryBookmarksAdapter();
    const b = buildBookmark(
      { url: "https://x.test/" },
      { now: () => 1, id: () => asBookmarkId("bk_x") }
    );
    await adapter.put(b);
    useStore.setState({ bookmarksAdapter: adapter });

    const fetchPreview = vi.fn(async () => ({
      ok: true as const,
      title: "T",
      description: null,
      ogImage: null,
      favicon: null,
      fetchedAt: 1,
    }));
    mountPreviewWorker({ fetchPreview });

    await hydrateFromDexie();
    expect(useStore.getState().hydrated).toBe(true);
    expect(useStore.getState().bookmarks.byId[b.id]).toBeDefined();
    // Hydration must NOT auto-fetch all pending previews — cards enqueue
    // themselves as they scroll into view (viewport-first).
    expect(fetchPreview).not.toHaveBeenCalled();
    expect(useStore.getState().bookmarks.byId[b.id]!.previewStatus).toBe(
      "pending"
    );

    // The viewport observer enqueues a visible card → it heads to ready.
    previewWorker().enqueue(b.id);
    await vi.waitFor(() =>
      expect(useStore.getState().bookmarks.byId[b.id]!.previewStatus).toBe(
        "ready"
      )
    );
    expect(fetchPreview).toHaveBeenCalledTimes(1);
  });

  it("hydrateFromDexie is idempotent (second call is a no-op)", async () => {
    await hydrateFromDexie();
    const fetchPreview = vi.fn();
    mountPreviewWorker({ fetchPreview });
    await hydrateFromDexie();
    expect(fetchPreview).not.toHaveBeenCalled();
  });
});

import { buildFolder, asFolderId } from "@/types";

describe("hydrateFromDexie folders", () => {
  it("loads folders from adapter and indexes byId + rootIds", async () => {
    useStore.setState({
      bookmarks: initialBookmarksState,
      folders: initialFoldersState,
      bookmarksAdapter: memoryBookmarksAdapter(),
      previewCacheAdapter: memoryPreviewCacheAdapter(),
      foldersAdapter: memoryFoldersAdapter(),
      hydrated: false,
    });

    const adapter = memoryFoldersAdapter();
    const tools = buildFolder(
      { name: "Tools", parentId: null },
      { now: () => 1, id: () => asFolderId("fld_Tools") }
    );
    await adapter.put(tools);
    useStore.setState({ foldersAdapter: adapter });

    await hydrateFromDexie();

    const state = useStore.getState();
    expect(state.folders.byId[asFolderId("fld_Tools")]).toEqual(tools);
    expect(state.folders.rootIds).toEqual([asFolderId("fld_Tools")]);
    expect(state.hydrated).toBe(true);
  });

  it("hydrates folders alongside bookmarks (both populated, no cross-contamination)", async () => {
    const bAdapter = memoryBookmarksAdapter();
    const fAdapter = memoryFoldersAdapter();
    const b = buildBookmark(
      { url: "https://x.test" },
      { now: () => 1, id: () => asBookmarkId("bk_x") }
    );
    const f = buildFolder(
      { name: "T", parentId: null },
      { now: () => 1, id: () => asFolderId("fld_T") }
    );
    await bAdapter.put(b);
    await fAdapter.put(f);
    useStore.setState({
      bookmarks: initialBookmarksState,
      folders: initialFoldersState,
      bookmarksAdapter: bAdapter,
      previewCacheAdapter: memoryPreviewCacheAdapter(),
      foldersAdapter: fAdapter,
      hydrated: false,
    });
    await hydrateFromDexie();

    const state = useStore.getState();
    expect(state.bookmarks.byId[asBookmarkId("bk_x")]).toBeDefined();
    expect(state.folders.byId[asFolderId("fld_T")]).toBeDefined();
  });
});

describe("hydrateFromDexie tags", () => {
  it("loads tags from adapter and indexes byId + order", async () => {
    const adapter = memoryTagsAdapter();
    const ai = buildTag(
      { name: "AI" },
      { now: () => 1, id: () => asTagId("tag_AI") }
    );
    const ml = buildTag(
      { name: "ML" },
      { now: () => 2, id: () => asTagId("tag_ML") }
    );
    await adapter.put(ai);
    await adapter.put(ml);
    useStore.setState({ tagsAdapter: adapter });

    await hydrateFromDexie();

    const state = useStore.getState();
    expect(state.tags.byId[asTagId("tag_AI")]).toEqual(ai);
    expect(state.tags.order).toEqual([asTagId("tag_AI"), asTagId("tag_ML")]);
  });
});

describe("hydrateFromDexie + preferences", () => {
  it("hydrates preferences from Dexie adapter", async () => {
    const prefsAdapter = memoryPreferencesAdapter();
    await prefsAdapter.set({
      layout: "list",
      pinnedFolderIds: [],
      theme: "dark",
      readerFontSize: "m",
      readerFontFamily: "serif",
      readerWidth: "normal",
    });
    useStore.setState({
      preferencesAdapter: prefsAdapter,
      hydrated: false,
    });
    await hydrateFromDexie();
    expect(useStore.getState().preferences.prefs.layout).toBe("list");
  });
});

describe("hydrateFromDexie + articleText (feature 26)", () => {
  it("hydrates the full-text corpus from the articles adapter", async () => {
    const bAdapter = memoryBookmarksAdapter();
    const aAdapter = memoryArticlesAdapter();
    const b = buildBookmark(
      { url: "https://ft.test/" },
      { now: () => 1, id: () => asBookmarkId("bk_ft") }
    );
    await bAdapter.put(b);
    await aAdapter.put({
      bookmarkId: asBookmarkId("bk_ft"),
      html: "<p>x</p>",
      textContent: "Zero Trust BODY text",
      title: "T",
      byline: null,
      excerpt: null,
      siteName: null,
      publishedTime: null,
      readingMinutes: 1,
      heroImageUrl: null,
      capturedAt: 1,
      summary: null,
    });
    useStore.setState({
      bookmarksAdapter: bAdapter,
      articlesAdapter: aAdapter,
    });
    await hydrateFromDexie();
    expect(useStore.getState().articleText[asBookmarkId("bk_ft")]).toBe(
      "zero trust body text"
    );
  });
});
