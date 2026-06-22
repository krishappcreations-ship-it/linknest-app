import { describe, it, expect } from "vitest";
import {
  initialBookmarksState,
  addBookmark,
  removeBookmark,
  updateBookmark,
  softRemoveBookmark,
  restoreBookmark,
  findBookmarkByUrl,
  applyAddBookmark,
  applyRemoveBookmark,
  applyUpdateBookmark,
  applySoftRemoveBookmark,
  applyRestoreBookmark,
  applyEvictBookmark,
  selectVisibleBookmarks,
  selectBookmarkById,
  selectVisibleCount,
  selectBrokenCount,
  bumpPreviewAttempt,
  applyUpdatePreviewSuccess,
  applyUpdatePreviewFailure,
  reorderBookmark,
  moveBookmarkToFolder,
  applyReorderBookmark,
  applyMoveBookmarkToFolder,
  upsertFromSync,
  setReadState,
  applySetReadState,
  bumpCaptureAttempt,
  applyUpdateCaptureSuccess,
  applyUpdateCaptureFailure,
  type BookmarksState,
} from "./bookmarks-slice";
import {
  memoryBookmarksAdapter,
  type BookmarksAdapter,
} from "@/lib/db/bookmarks-adapter";
import {
  BookmarkInputSchema,
  asBookmarkId,
  asFolderId,
  asTagId,
  buildBookmark,
  type Bookmark,
  type BookmarkInput,
} from "@/types";

/* ============================================================
 * Phase 3 prototype: optimistic-update + inverse-mutation rollback.
 *
 * Tests the SLICE contract — not Dexie. The adapter seam isolates the
 * pure reducer logic so we can prove the pattern before any IndexedDB
 * code runs in the browser.
 * ============================================================ */

function mkBookmark(id: string, overrides?: Partial<Bookmark>): Bookmark {
  return {
    id: asBookmarkId(id),
    url: `https://example.com/${id}`,
    title: `Bookmark ${id}`,
    description: null,
    previewImageUrl: null,
    faviconUrl: null,
    domain: "example.com",
    previewStatus: "pending",
    folderId: null,
    tagIds: [],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
    readState: "inbox",
    captureStatus: "pending",
    captureFailureKind: null,
    captureAttempt: 0,
    readProgress: 0,
    ...overrides,
  };
}

describe("bookmarks-slice — pure reducers", () => {
  it("addBookmark inserts new entry at head of order", () => {
    const a = mkBookmark("a");
    const b = mkBookmark("b");
    const s1 = addBookmark(initialBookmarksState, a).next;
    const s2 = addBookmark(s1, b).next;
    expect(s2.order).toEqual([asBookmarkId("b"), asBookmarkId("a")]);
    expect(s2.byId[asBookmarkId("a")]).toEqual(a);
  });

  it("addBookmark with existing id replaces in place and inverse restores", () => {
    const v1 = mkBookmark("a", { title: "v1" });
    const v2 = mkBookmark("a", { title: "v2" });
    const s1 = addBookmark(initialBookmarksState, v1).next;
    const { next: s2, inverse } = addBookmark(s1, v2);
    expect(s2.byId[asBookmarkId("a")].title).toBe("v2");
    expect(s2.order).toEqual([asBookmarkId("a")]); // no duplicate
    const restored = inverse(s2);
    expect(restored.byId[asBookmarkId("a")].title).toBe("v1");
  });

  it("removeBookmark inverse restores both byId and original order index", () => {
    const a = mkBookmark("a");
    const b = mkBookmark("b");
    const c = mkBookmark("c");
    let s = initialBookmarksState;
    s = addBookmark(s, a).next;
    s = addBookmark(s, b).next;
    s = addBookmark(s, c).next;
    // order is [c, b, a]
    const { next: removed, inverse } = removeBookmark(s, asBookmarkId("b"));
    expect(removed.order).toEqual([asBookmarkId("c"), asBookmarkId("a")]);
    const restored = inverse(removed);
    expect(restored.order).toEqual([
      asBookmarkId("c"),
      asBookmarkId("b"),
      asBookmarkId("a"),
    ]);
    expect(restored.byId[asBookmarkId("b")]).toEqual(b);
  });

  it("removeBookmark is a no-op for unknown ids", () => {
    const s = addBookmark(initialBookmarksState, mkBookmark("a")).next;
    const { next, inverse } = removeBookmark(s, asBookmarkId("ghost"));
    expect(next).toBe(s);
    expect(inverse(next)).toBe(next);
  });

  it("updateBookmark merges patch, bumps updatedAt, and inverse restores previous", () => {
    const a = mkBookmark("a", { title: "old", updatedAt: 1 });
    const s = addBookmark(initialBookmarksState, a).next;
    const { next, inverse } = updateBookmark(
      s,
      asBookmarkId("a"),
      { title: "new", folderId: asFolderId("f1") },
      9999
    );
    expect(next.byId[asBookmarkId("a")].title).toBe("new");
    expect(next.byId[asBookmarkId("a")].folderId).toBe(asFolderId("f1"));
    expect(next.byId[asBookmarkId("a")].updatedAt).toBe(9999);
    expect(inverse(next).byId[asBookmarkId("a")].title).toBe("old");
    expect(inverse(next).byId[asBookmarkId("a")].folderId).toBe(null);
    expect(inverse(next).byId[asBookmarkId("a")].updatedAt).toBe(1);
  });
});

describe("bookmarks-slice — soft delete tombstones", () => {
  it("softRemoveBookmark sets deletedAt and bumps updatedAt", () => {
    const a = mkBookmark("a", { updatedAt: 1 });
    const s = addBookmark(initialBookmarksState, a).next;
    const { next } = softRemoveBookmark(s, asBookmarkId("a"), 2000);
    expect(next.byId[asBookmarkId("a")].deletedAt).toBe(2000);
    expect(next.byId[asBookmarkId("a")].updatedAt).toBe(2000);
    expect(next.order).toEqual([asBookmarkId("a")]);
  });
  it("softRemoveBookmark inverse restores prior state", () => {
    const a = mkBookmark("a", { updatedAt: 1 });
    const s = addBookmark(initialBookmarksState, a).next;
    const { next, inverse } = softRemoveBookmark(s, asBookmarkId("a"), 2000);
    expect(inverse(next).byId[asBookmarkId("a")].deletedAt).toBeNull();
    expect(inverse(next).byId[asBookmarkId("a")].updatedAt).toBe(1);
  });
  it("softRemoveBookmark is a no-op on unknown id", () => {
    const { next } = softRemoveBookmark(
      initialBookmarksState,
      asBookmarkId("ghost"),
      2000
    );
    expect(next).toBe(initialBookmarksState);
  });
  it("softRemoveBookmark is a no-op on already-tombstoned row", () => {
    const a = mkBookmark("a", { deletedAt: 1500 });
    const s = addBookmark(initialBookmarksState, a).next;
    const { next } = softRemoveBookmark(s, asBookmarkId("a"), 2000);
    expect(next).toBe(s);
  });
  it("restoreBookmark clears deletedAt and bumps updatedAt", () => {
    const a = mkBookmark("a", { deletedAt: 1500, updatedAt: 1500 });
    const s = addBookmark(initialBookmarksState, a).next;
    const { next } = restoreBookmark(s, asBookmarkId("a"), 3000);
    expect(next.byId[asBookmarkId("a")].deletedAt).toBeNull();
    expect(next.byId[asBookmarkId("a")].updatedAt).toBe(3000);
  });
  it("restoreBookmark inverse restores tombstone", () => {
    const a = mkBookmark("a", { deletedAt: 1500, updatedAt: 1500 });
    const s = addBookmark(initialBookmarksState, a).next;
    const { next, inverse } = restoreBookmark(s, asBookmarkId("a"), 3000);
    expect(inverse(next).byId[asBookmarkId("a")].deletedAt).toBe(1500);
  });
  it("restoreBookmark is a no-op on non-tombstoned row", () => {
    const a = mkBookmark("a", { deletedAt: null });
    const s = addBookmark(initialBookmarksState, a).next;
    const { next } = restoreBookmark(s, asBookmarkId("a"), 3000);
    expect(next).toBe(s);
  });
});

describe("bookmarks-slice — findBookmarkByUrl", () => {
  it("matches by normalized URL (case, trailing slash, default port)", () => {
    const a = mkBookmark("a", { url: "https://Example.com:443/path/" });
    const s = addBookmark(initialBookmarksState, a).next;
    const found = findBookmarkByUrl(s, "HTTPS://example.com/path");
    expect(found).not.toBeNull();
    expect(found?.id).toBe(asBookmarkId("a"));
  });
  it("ignores tombstoned rows", () => {
    const a = mkBookmark("a", { url: "https://x.com/", deletedAt: 1 });
    const s = addBookmark(initialBookmarksState, a).next;
    expect(findBookmarkByUrl(s, "https://x.com")).toBeNull();
  });
  it("returns null for unknown urls", () => {
    expect(
      findBookmarkByUrl(initialBookmarksState, "https://x.com")
    ).toBeNull();
  });
  it("returns null for malformed query url without throwing", () => {
    const a = mkBookmark("a", { url: "https://x.com/" });
    const s = addBookmark(initialBookmarksState, a).next;
    expect(findBookmarkByUrl(s, "not a url")).toBeNull();
  });

  // F29 — canonical (tracking-param + fragment) matching.
  it("matches a utm-only variant of an existing url", () => {
    const a = mkBookmark("a", { url: "https://ex.com/post" });
    const s = addBookmark(initialBookmarksState, a).next;
    expect(findBookmarkByUrl(s, "https://ex.com/post?utm_source=tw")?.id).toBe(
      asBookmarkId("a")
    );
  });
  it("matches a fragment-only variant", () => {
    const a = mkBookmark("a", { url: "https://ex.com/post" });
    const s = addBookmark(initialBookmarksState, a).next;
    expect(findBookmarkByUrl(s, "https://ex.com/post#intro")?.id).toBe(
      asBookmarkId("a")
    );
  });
  it("does NOT match a genuinely different param", () => {
    const a = mkBookmark("a", { url: "https://ex.com/s?q=cats" });
    const s = addBookmark(initialBookmarksState, a).next;
    expect(findBookmarkByUrl(s, "https://ex.com/s?q=dogs")).toBeNull();
  });
});

describe("bookmarks-slice — applyAddBookmark tagged outcome", () => {
  it("returns kind='added' on success with the built bookmark", async () => {
    const adapter = memoryBookmarksAdapter();
    const input: BookmarkInput = BookmarkInputSchema.parse({
      url: "https://figma.com/blog",
    });
    const r = await applyAddBookmark(initialBookmarksState, input, {
      adapter,
      now: () => 1700000000000,
      id: () => asBookmarkId("bk_1"),
    });
    expect(r.kind).toBe("added");
    if (r.kind !== "added") throw new Error("narrow");
    expect(r.bookmark.id).toBe(asBookmarkId("bk_1"));
    expect(r.bookmark.domain).toBe("figma.com");
    expect(r.state.byId[asBookmarkId("bk_1")]).toEqual(r.bookmark);
    expect(await adapter.list()).toHaveLength(1);
  });

  it("returns kind='duplicate' with existing bookmark when URL matches", async () => {
    const adapter = memoryBookmarksAdapter();
    const first: BookmarkInput = BookmarkInputSchema.parse({
      url: "https://x.com/path/",
    });
    const r1 = await applyAddBookmark(initialBookmarksState, first, {
      adapter,
      now: () => 1,
      id: () => asBookmarkId("bk_1"),
    });
    if (r1.kind !== "added") throw new Error("seed failed");

    const dup: BookmarkInput = BookmarkInputSchema.parse({
      url: "HTTPS://x.com/path",
    });
    const r2 = await applyAddBookmark(r1.state, dup, {
      adapter,
      now: () => 2,
      id: () => asBookmarkId("bk_2"),
    });
    expect(r2.kind).toBe("duplicate");
    if (r2.kind !== "duplicate") throw new Error("narrow");
    expect(r2.existing.id).toBe(asBookmarkId("bk_1"));
    expect(r2.state).toBe(r1.state);
    expect(await adapter.list()).toHaveLength(1);
  });

  it("returns kind='error' and rolls back state when adapter throws", async () => {
    const failing: BookmarksAdapter = {
      list: async () => [],
      put: async () => {
        throw new Error("disk full");
      },
      remove: async () => {},
      get: async () => null,
    };
    const input: BookmarkInput = BookmarkInputSchema.parse({
      url: "https://x.com",
    });
    const r = await applyAddBookmark(initialBookmarksState, input, {
      adapter: failing,
      now: () => 1,
      id: () => asBookmarkId("bk_1"),
    });
    expect(r.kind).toBe("error");
    if (r.kind !== "error") throw new Error("narrow");
    expect(r.error.message).toBe("disk full");
    expect(r.state).toEqual(initialBookmarksState);
  });

  it("preserves order across sequential adds (newest first)", async () => {
    const adapter = memoryBookmarksAdapter();
    let state = initialBookmarksState;
    let ts = 1700000000000;
    for (const slug of ["a", "b", "c"]) {
      ts += 1000;
      const input = BookmarkInputSchema.parse({
        url: `https://example.com/${slug}`,
      });
      const r = await applyAddBookmark(state, input, {
        adapter,
        now: () => ts,
        id: () => asBookmarkId(`bk_${slug}`),
      });
      if (r.kind !== "added") throw new Error("expected added");
      state = r.state;
    }
    expect(state.order).toEqual([
      asBookmarkId("bk_c"),
      asBookmarkId("bk_b"),
      asBookmarkId("bk_a"),
    ]);
    expect((await adapter.list()).map((b) => b.id)).toEqual([
      asBookmarkId("bk_c"),
      asBookmarkId("bk_b"),
      asBookmarkId("bk_a"),
    ]);
  });
});

describe("bookmarks-slice — applyRemoveBookmark (legacy hard remove)", () => {
  it("rolls back state when adapter throws", async () => {
    const adapter = memoryBookmarksAdapter();
    const input = BookmarkInputSchema.parse({ url: "https://example.com/a" });
    const seeded = await applyAddBookmark(initialBookmarksState, input, {
      adapter,
      now: () => 1,
      id: () => asBookmarkId("bk_a"),
    });
    if (seeded.kind !== "added") throw new Error("seed failed");
    const failing: BookmarksAdapter = {
      ...adapter,
      remove: async () => {
        throw new Error("not allowed");
      },
    };
    const r = await applyRemoveBookmark(seeded.state, asBookmarkId("bk_a"), {
      adapter: failing,
    });
    expect(r.rolledBack).toBe(true);
    expect(r.state.byId[asBookmarkId("bk_a")]).toBeDefined();
  });
});

describe("bookmarks-slice — applyUpdateBookmark", () => {
  it("persists patch on success and bumps updatedAt", async () => {
    const adapter = memoryBookmarksAdapter();
    const a = mkBookmark("a", { updatedAt: 1 });
    const state = addBookmark(initialBookmarksState, a).next;
    await adapter.put(a);
    const r = await applyUpdateBookmark(
      state,
      asBookmarkId("a"),
      { title: "renamed" },
      { adapter, now: () => 5000 }
    );
    expect(r.rolledBack).toBe(false);
    expect(r.state.byId[asBookmarkId("a")].title).toBe("renamed");
    expect(r.state.byId[asBookmarkId("a")].updatedAt).toBe(5000);
    const persisted = await adapter.get(asBookmarkId("a"));
    expect(persisted?.title).toBe("renamed");
  });

  it("persists a note patch (F30)", async () => {
    const adapter = memoryBookmarksAdapter();
    const a = mkBookmark("a", { updatedAt: 1 });
    const state = addBookmark(initialBookmarksState, a).next;
    await adapter.put(a);
    const r = await applyUpdateBookmark(
      state,
      asBookmarkId("a"),
      { note: "remember this" },
      { adapter, now: () => 5000 }
    );
    expect(r.rolledBack).toBe(false);
    expect(r.state.byId[asBookmarkId("a")].note).toBe("remember this");
    const persisted = await adapter.get(asBookmarkId("a"));
    expect(persisted?.note).toBe("remember this");
  });

  it("rolls back on adapter throw", async () => {
    const adapter = memoryBookmarksAdapter();
    const a = mkBookmark("a", { title: "orig", updatedAt: 1 });
    const state = addBookmark(initialBookmarksState, a).next;
    await adapter.put(a);
    const failing: BookmarksAdapter = {
      ...adapter,
      put: async () => {
        throw new Error("nope");
      },
    };
    const r = await applyUpdateBookmark(
      state,
      asBookmarkId("a"),
      { title: "renamed" },
      { adapter: failing, now: () => 5000 }
    );
    expect(r.rolledBack).toBe(true);
    expect(r.state.byId[asBookmarkId("a")].title).toBe("orig");
  });

  it("is a no-op on unknown id", async () => {
    const adapter = memoryBookmarksAdapter();
    const r = await applyUpdateBookmark(
      initialBookmarksState,
      asBookmarkId("ghost"),
      { title: "x" },
      { adapter, now: () => 1 }
    );
    expect(r.rolledBack).toBe(false);
    expect(r.state).toBe(initialBookmarksState);
  });
});

describe("bookmarks-slice — applySoftRemoveBookmark", () => {
  it("tombstones in store + adapter", async () => {
    const adapter = memoryBookmarksAdapter();
    const a = mkBookmark("a");
    const state = addBookmark(initialBookmarksState, a).next;
    await adapter.put(a);
    const r = await applySoftRemoveBookmark(state, asBookmarkId("a"), {
      adapter,
      now: () => 2000,
    });
    expect(r.rolledBack).toBe(false);
    expect(r.state.byId[asBookmarkId("a")].deletedAt).toBe(2000);
    const persisted = await adapter.get(asBookmarkId("a"));
    expect(persisted?.deletedAt).toBe(2000);
  });

  it("rolls back on adapter throw", async () => {
    const adapter = memoryBookmarksAdapter();
    const a = mkBookmark("a");
    const state = addBookmark(initialBookmarksState, a).next;
    await adapter.put(a);
    const failing: BookmarksAdapter = {
      ...adapter,
      put: async () => {
        throw new Error("nope");
      },
    };
    const r = await applySoftRemoveBookmark(state, asBookmarkId("a"), {
      adapter: failing,
      now: () => 2000,
    });
    expect(r.rolledBack).toBe(true);
    expect(r.state.byId[asBookmarkId("a")].deletedAt).toBeNull();
  });
});

describe("bookmarks-slice — applyRestoreBookmark", () => {
  it("clears tombstone in store + adapter", async () => {
    const adapter = memoryBookmarksAdapter();
    const a = mkBookmark("a", { deletedAt: 1000 });
    const state = addBookmark(initialBookmarksState, a).next;
    await adapter.put(a);
    const r = await applyRestoreBookmark(state, asBookmarkId("a"), {
      adapter,
      now: () => 3000,
    });
    expect(r.rolledBack).toBe(false);
    expect(r.state.byId[asBookmarkId("a")].deletedAt).toBeNull();
    const persisted = await adapter.get(asBookmarkId("a"));
    expect(persisted?.deletedAt).toBeNull();
  });
});

describe("bookmarks-slice — applyEvictBookmark", () => {
  it("hard-removes from store + adapter", async () => {
    const adapter = memoryBookmarksAdapter();
    const a = mkBookmark("a", { deletedAt: 1000 });
    const state = addBookmark(initialBookmarksState, a).next;
    await adapter.put(a);
    const r = await applyEvictBookmark(state, asBookmarkId("a"), { adapter });
    expect(r.rolledBack).toBe(false);
    expect(r.state.byId[asBookmarkId("a")]).toBeUndefined();
    expect(r.state.order).toEqual([]);
    expect(await adapter.get(asBookmarkId("a"))).toBeNull();
  });
});

describe("bookmarks-slice — selectors", () => {
  it("selectVisibleBookmarks filters tombstones and preserves order", () => {
    const a = mkBookmark("a");
    const b = mkBookmark("b", { deletedAt: 1500 });
    const c = mkBookmark("c");
    let state = initialBookmarksState;
    state = addBookmark(state, a).next;
    state = addBookmark(state, b).next;
    state = addBookmark(state, c).next;
    expect(selectVisibleBookmarks(state).map((x) => x.id)).toEqual([
      asBookmarkId("c"),
      asBookmarkId("a"),
    ]);
  });
  it("selectBookmarkById returns null for unknown id, even for tombstones", () => {
    const a = mkBookmark("a", { deletedAt: 1500 });
    const state = addBookmark(initialBookmarksState, a).next;
    expect(selectBookmarkById(state, asBookmarkId("a"))?.id).toBe(
      asBookmarkId("a")
    );
    expect(selectBookmarkById(state, asBookmarkId("ghost"))).toBeNull();
  });
  it("selectVisibleCount excludes tombstones", () => {
    const a = mkBookmark("a");
    const b = mkBookmark("b", { deletedAt: 1500 });
    let state = initialBookmarksState;
    state = addBookmark(state, a).next;
    state = addBookmark(state, b).next;
    expect(selectVisibleCount(state)).toBe(1);
  });
});

/* ============================================================
 * Feature 02 — preview pipeline helpers.
 *
 * bumpPreviewAttempt is a pure reducer; the two apply* helpers are
 * async because they call adapter.put after the ghost-write guards.
 * ============================================================ */

function seed(b: Bookmark): BookmarksState {
  return { byId: { [b.id]: b }, order: [b.id] };
}

function makeBookmark(over: Partial<Bookmark> = {}): Bookmark {
  const base = buildBookmark(
    { url: "https://example.com/" },
    { now: () => 1700000000000, id: () => asBookmarkId("bk_test") }
  );
  return { ...base, ...over };
}

describe("bumpPreviewAttempt", () => {
  it("increments previewAttempt + sets pending + clears failureKind", () => {
    const b = makeBookmark({
      previewStatus: "failed",
      previewFailureKind: "permanent",
      previewAttempt: 1,
    });
    const s = seed(b);
    const { next } = bumpPreviewAttempt(s, b.id, 1700000001000);
    const out = next.byId[b.id]!;
    expect(out.previewAttempt).toBe(2);
    expect(out.previewStatus).toBe("pending");
    expect(out.previewFailureKind).toBeNull();
    expect(out.updatedAt).toBe(1700000001000);
  });
  it("is a noop for unknown id", () => {
    const s: BookmarksState = { byId: {}, order: [] };
    const { next } = bumpPreviewAttempt(s, asBookmarkId("ghost"), 1);
    expect(next).toBe(s);
  });
});

describe("applyUpdatePreviewSuccess", () => {
  it("writes ready + metadata when attempt matches", async () => {
    const b = makeBookmark({ previewAttempt: 0 });
    const r = await applyUpdatePreviewSuccess(
      seed(b),
      {
        id: b.id,
        title: "T",
        description: "D",
        imageUrl: "https://i.test/og.png",
        faviconUrl: "https://i.test/favicon.ico",
        expectedAttempt: 0,
      },
      { adapter: memoryBookmarksAdapter(), now: () => 1700000002000 }
    );
    expect(r.wrote).toBe(true);
    const out = r.state.byId[b.id]!;
    expect(out.previewStatus).toBe("ready");
    expect(out.previewImageUrl).toBe("https://i.test/og.png");
    expect(out.faviconUrl).toBe("https://i.test/favicon.ico");
    expect(out.title).toBe("T");
    expect(out.description).toBe("D");
    expect(out.previewFailureKind).toBeNull();
  });
  it("discards write when attempt mismatches (stale result)", async () => {
    const b = makeBookmark({ previewAttempt: 2 });
    const r = await applyUpdatePreviewSuccess(
      seed(b),
      {
        id: b.id,
        title: null,
        description: null,
        imageUrl: null,
        faviconUrl: null,
        expectedAttempt: 1,
      },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.wrote).toBe(false);
    expect(r.state.byId[b.id]!.previewStatus).toBe("pending");
  });
  it("discards write when bookmark is tombstoned", async () => {
    const b = makeBookmark({ deletedAt: 5 });
    const r = await applyUpdatePreviewSuccess(
      seed(b),
      {
        id: b.id,
        title: null,
        description: null,
        imageUrl: null,
        faviconUrl: null,
        expectedAttempt: 0,
      },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.wrote).toBe(false);
  });
  it("discards write when bookmark is gone", async () => {
    const r = await applyUpdatePreviewSuccess(
      { byId: {}, order: [] },
      {
        id: asBookmarkId("missing"),
        title: null,
        description: null,
        imageUrl: null,
        faviconUrl: null,
        expectedAttempt: 0,
      },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.wrote).toBe(false);
  });
  it("rolls back when adapter throws", async () => {
    const b = makeBookmark();
    const throwing: BookmarksAdapter = {
      list: async () => [],
      put: async () => {
        throw new Error("disk full");
      },
      remove: async () => {},
      get: async () => null,
    };
    const r = await applyUpdatePreviewSuccess(
      seed(b),
      {
        id: b.id,
        title: "T",
        description: null,
        imageUrl: null,
        faviconUrl: null,
        expectedAttempt: 0,
      },
      { adapter: throwing }
    );
    expect(r.wrote).toBe(false);
    expect(r.state.byId[b.id]!.previewStatus).toBe("pending");
  });
});

describe("applyUpdatePreviewFailure", () => {
  it("writes failed + transient kind", async () => {
    const b = makeBookmark();
    const r = await applyUpdatePreviewFailure(
      seed(b),
      { id: b.id, kind: "transient", expectedAttempt: 0 },
      { adapter: memoryBookmarksAdapter(), now: () => 1700000003000 }
    );
    expect(r.wrote).toBe(true);
    const out = r.state.byId[b.id]!;
    expect(out.previewStatus).toBe("failed");
    expect(out.previewFailureKind).toBe("transient");
    expect(out.updatedAt).toBe(1700000003000);
  });
  it("writes failed + permanent kind", async () => {
    const b = makeBookmark();
    const r = await applyUpdatePreviewFailure(
      seed(b),
      { id: b.id, kind: "permanent", expectedAttempt: 0 },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.wrote).toBe(true);
    expect(r.state.byId[b.id]!.previewFailureKind).toBe("permanent");
  });
  it("discards on attempt mismatch", async () => {
    const b = makeBookmark({ previewAttempt: 1 });
    const r = await applyUpdatePreviewFailure(
      seed(b),
      { id: b.id, kind: "permanent", expectedAttempt: 0 },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.wrote).toBe(false);
  });
  it("discards on tombstoned bookmark", async () => {
    const b = makeBookmark({ deletedAt: 5 });
    const r = await applyUpdatePreviewFailure(
      seed(b),
      { id: b.id, kind: "permanent", expectedAttempt: 0 },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.wrote).toBe(false);
  });
});

import {
  selectFilteredBookmarks,
  effectiveContentKind,
} from "@/store/slices/bookmarks-slice";
import { initialFoldersState, addFolder } from "@/store/slices/folders-slice";
import { buildFolder } from "@/types";

describe("selectFilteredBookmarks", () => {
  function setup() {
    const tools = buildFolder(
      { name: "Tools", parentId: null },
      { now: () => 1, id: () => asFolderId("fld_Tools") }
    );
    const ai = buildFolder(
      { name: "AI", parentId: asFolderId("fld_Tools") },
      { now: () => 2, id: () => asFolderId("fld_AI") }
    );
    const foldersState = [tools, ai].reduce(
      (s, fldr) => addFolder(s, fldr).next,
      initialFoldersState
    );

    const b1 = mkBookmark("b1", { folderId: asFolderId("fld_Tools") });
    const b2 = mkBookmark("b2", { folderId: asFolderId("fld_AI") });
    const b3 = mkBookmark("b3", { folderId: null });
    const b4 = mkBookmark("b4", { folderId: null, deletedAt: 999 });
    const bookmarksState = [b1, b2, b3, b4].reduce(
      (s, b) => addBookmark(s, b).next,
      initialBookmarksState
    );

    return { foldersState, bookmarksState };
  }

  it("kind:all returns visible bookmarks (no tombstones)", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
    });
    expect(out.map((b) => b.id).sort()).toEqual(
      [asBookmarkId("b1"), asBookmarkId("b2"), asBookmarkId("b3")].sort()
    );
  });

  it("kind:unfiled returns folderId=null only", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "unfiled" },
    });
    expect(out.map((b) => b.id)).toEqual([asBookmarkId("b3")]);
  });

  it("kind:subtree includes self + descendants", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "subtree", id: asFolderId("fld_Tools") },
    });
    expect(out.map((b) => b.id).sort()).toEqual(
      [asBookmarkId("b1"), asBookmarkId("b2")].sort()
    );
  });

  it("kind:subtree on leaf returns only direct bookmarks", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "subtree", id: asFolderId("fld_AI") },
    });
    expect(out.map((b) => b.id)).toEqual([asBookmarkId("b2")]);
  });

  it("all kinds exclude tombstoned bookmarks", () => {
    const { foldersState, bookmarksState } = setup();
    const all = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
    });
    expect(all.find((b) => b.id === asBookmarkId("b4"))).toBeUndefined();
  });
});

import { setBookmarkTags } from "@/store/slices/bookmarks-slice";
import type { TagId } from "@/types";

describe("setBookmarkTags reducer", () => {
  it("replaces tagIds + bumps updatedAt", () => {
    const s = initialBookmarksState;
    const s1 = addBookmark(s, mkBookmark("a")).next;
    const tagIds = [asTagId("tag_AI"), asTagId("tag_ML")] as TagId[];
    const { next } = setBookmarkTags(s1, asBookmarkId("a"), tagIds, 99);
    expect(next.byId[asBookmarkId("a")]!.tagIds).toEqual(tagIds);
    expect(next.byId[asBookmarkId("a")]!.updatedAt).toBe(99);
  });
  it("inverse restores prior tagIds", () => {
    const s = initialBookmarksState;
    const s1 = addBookmark(
      s,
      mkBookmark("a", { tagIds: [asTagId("tag_X")] as TagId[] })
    ).next;
    const { next, inverse } = setBookmarkTags(
      s1,
      asBookmarkId("a"),
      [asTagId("tag_Y")] as TagId[],
      99
    );
    expect(inverse(next).byId[asBookmarkId("a")]!.tagIds).toEqual([
      asTagId("tag_X"),
    ]);
  });
  it("no-ops on unknown id", () => {
    const s = initialBookmarksState;
    const { next } = setBookmarkTags(
      s,
      asBookmarkId("missing"),
      [asTagId("tag_X")] as TagId[],
      99
    );
    expect(next).toBe(s);
  });
});

describe("selectFilteredBookmarks readStateFilter (feature 22)", () => {
  function setup() {
    const inbox = mkBookmark("i", { readState: "inbox" });
    const arch = mkBookmark("a", { readState: "archived" });
    const bookmarksState = [inbox, arch].reduce(
      (s, b) => addBookmark(s, b).next,
      initialBookmarksState
    );
    return { bookmarksState, folders: initialFoldersState };
  }

  it("null filter excludes archived", () => {
    const { bookmarksState, folders } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders,
      filter: { kind: "all" },
      readStateFilter: null,
    });
    expect(out.map((b) => b.id)).toEqual([asBookmarkId("i")]);
  });

  it("explicit filter matches exactly, including archived", () => {
    const { bookmarksState, folders } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders,
      filter: { kind: "all" },
      readStateFilter: "archived",
    });
    expect(out.map((b) => b.id)).toEqual([asBookmarkId("a")]);
  });
});

describe("setReadState + applySetReadState (feature 22)", () => {
  function seed(overrides?: Partial<Bookmark>): BookmarksState {
    return [mkBookmark("a", overrides)].reduce(
      (s, b) => addBookmark(s, b).next,
      initialBookmarksState
    );
  }

  it("setReadState updates readState + updatedAt; inverse restores", () => {
    const s0 = seed({ readState: "inbox", updatedAt: 1 });
    const { next, inverse } = setReadState(
      s0,
      asBookmarkId("a"),
      "reading",
      99
    );
    expect(next.byId[asBookmarkId("a")]!.readState).toBe("reading");
    expect(next.byId[asBookmarkId("a")]!.updatedAt).toBe(99);
    expect(inverse(next).byId[asBookmarkId("a")]!.readState).toBe("inbox");
  });

  it("applySetReadState persists + returns next", async () => {
    const s0 = seed({ readState: "inbox" });
    const adapter = memoryBookmarksAdapter();
    const r = await applySetReadState(
      s0,
      { id: asBookmarkId("a"), readState: "finished" },
      { adapter, now: () => 7 }
    );
    expect(r.rolledBack).toBe(false);
    expect(r.state.byId[asBookmarkId("a")]!.readState).toBe("finished");
    expect((await adapter.get(asBookmarkId("a")))!.readState).toBe("finished");
  });

  it("applySetReadState rolls back on adapter throw", async () => {
    const s0 = seed({ readState: "inbox" });
    const adapter: BookmarksAdapter = {
      ...memoryBookmarksAdapter(),
      put: async () => {
        throw new Error("boom");
      },
    };
    const r = await applySetReadState(
      s0,
      { id: asBookmarkId("a"), readState: "finished" },
      { adapter }
    );
    expect(r.rolledBack).toBe(true);
    expect(r.state.byId[asBookmarkId("a")]!.readState).toBe("inbox");
  });

  it("applySetReadState no-ops when already in the target state", async () => {
    const s0 = seed({ readState: "reading" });
    const r = await applySetReadState(
      s0,
      { id: asBookmarkId("a"), readState: "reading" },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.state).toBe(s0);
    expect(r.rolledBack).toBe(false);
  });
});

describe("selectFilteredBookmarks with tagFilter", () => {
  function setup() {
    const tagAI = asTagId("tag_AI");
    const tagML = asTagId("tag_ML");
    const b1 = mkBookmark("b1", { tagIds: [tagAI] });
    const b2 = mkBookmark("b2", { tagIds: [tagAI, tagML] });
    const b3 = mkBookmark("b3", { tagIds: [tagML] });
    const b4 = mkBookmark("b4", { tagIds: [] });
    const bookmarksState = [b1, b2, b3, b4].reduce(
      (s, b) => addBookmark(s, b).next,
      initialBookmarksState
    );
    const foldersState = initialFoldersState;
    return { bookmarksState, foldersState, tagAI, tagML };
  }

  it("tagFilter:null is identity", () => {
    const { bookmarksState, foldersState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
      tagFilter: null,
    });
    expect(out.map((b) => b.id).sort()).toEqual(
      [
        asBookmarkId("b1"),
        asBookmarkId("b2"),
        asBookmarkId("b3"),
        asBookmarkId("b4"),
      ].sort()
    );
  });
  it("tagFilter narrows to bookmarks containing the tag", () => {
    const { bookmarksState, foldersState, tagAI } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
      tagFilter: tagAI,
    });
    expect(out.map((b) => b.id).sort()).toEqual(
      [asBookmarkId("b1"), asBookmarkId("b2")].sort()
    );
  });
  it("tagFilter composes with folder filter (AND)", () => {
    const { bookmarksState, foldersState, tagAI } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "unfiled" },
      tagFilter: tagAI,
    });
    expect(out.map((b) => b.id).sort()).toEqual(
      [asBookmarkId("b1"), asBookmarkId("b2")].sort()
    );
  });
});

describe("reorderBookmark", () => {
  function mkBookmark(id: string): Bookmark {
    return buildBookmark(
      { url: `https://${id}.test` },
      { now: () => 1, id: () => asBookmarkId(id) }
    );
  }

  it("moves an item from one index to another and returns inverse", () => {
    const s0: BookmarksState = {
      byId: {
        a: mkBookmark("a"),
        b: mkBookmark("b"),
        c: mkBookmark("c"),
      },
      order: [asBookmarkId("a"), asBookmarkId("b"), asBookmarkId("c")],
    };
    const { next, inverse } = reorderBookmark(s0, { fromIdx: 0, toIdx: 2 });
    expect(next.order).toEqual([
      asBookmarkId("b"),
      asBookmarkId("c"),
      asBookmarkId("a"),
    ]);
    expect(inverse(next).order).toEqual(s0.order);
  });

  it("no-ops when fromIdx === toIdx", () => {
    const s0: BookmarksState = {
      byId: { a: mkBookmark("a") },
      order: [asBookmarkId("a")],
    };
    const { next } = reorderBookmark(s0, { fromIdx: 0, toIdx: 0 });
    expect(next).toBe(s0);
  });

  it("no-ops when fromIdx is out of range", () => {
    const s0: BookmarksState = {
      byId: { a: mkBookmark("a") },
      order: [asBookmarkId("a")],
    };
    const { next } = reorderBookmark(s0, { fromIdx: 5, toIdx: 0 });
    expect(next).toBe(s0);
  });
});

describe("moveBookmarkToFolder", () => {
  function fixture(): BookmarksState {
    const mk = (id: string, folderId: string | null) => {
      const base = buildBookmark(
        { url: `https://${id}.test` },
        { now: () => 1, id: () => asBookmarkId(id) }
      );
      return { ...base, folderId: folderId as never };
    };
    return {
      byId: {
        a: mk("a", null),
        b: mk("b", "fld_x"),
        c: mk("c", null),
        d: mk("d", "fld_x"),
      },
      order: [
        asBookmarkId("a"),
        asBookmarkId("b"),
        asBookmarkId("c"),
        asBookmarkId("d"),
      ],
    };
  }

  it("updates folderId and splices order to head of target folder when insertAfterId is null", () => {
    const s0 = fixture();
    const { next, inverse } = moveBookmarkToFolder(s0, {
      id: asBookmarkId("a"),
      folderId: asFolderId("fld_x"),
      insertAfterId: null,
    });
    expect(next.byId[asBookmarkId("a")]!.folderId).toBe(asFolderId("fld_x"));
    const aIdx = next.order.indexOf(asBookmarkId("a"));
    const bIdx = next.order.indexOf(asBookmarkId("b"));
    expect(aIdx).toBeLessThan(bIdx);
    expect(inverse(next)).toEqual(s0);
  });

  it("inserts immediately after insertAfterId when supplied", () => {
    const s0 = fixture();
    const { next } = moveBookmarkToFolder(s0, {
      id: asBookmarkId("a"),
      folderId: asFolderId("fld_x"),
      insertAfterId: asBookmarkId("b"),
    });
    const orderIds = next.order.map((x) => String(x));
    const bIdx = orderIds.indexOf("b");
    expect(orderIds[bIdx + 1]).toBe("a");
  });

  it("no-ops when bookmark id does not exist", () => {
    const s0 = fixture();
    const { next } = moveBookmarkToFolder(s0, {
      id: asBookmarkId("missing"),
      folderId: asFolderId("fld_x"),
      insertAfterId: null,
    });
    expect(next).toBe(s0);
  });
});

describe("applyReorderBookmark", () => {
  function mk(id: string): Bookmark {
    return buildBookmark(
      { url: `https://${id}.test` },
      { now: () => 1, id: () => asBookmarkId(id) }
    );
  }

  it("persists touched row + returns state on success", async () => {
    const adapter = memoryBookmarksAdapter();
    const s0: BookmarksState = {
      byId: { a: mk("a"), b: mk("b") },
      order: [asBookmarkId("a"), asBookmarkId("b")],
    };
    await adapter.put(mk("a"));
    await adapter.put(mk("b"));
    const r = await applyReorderBookmark(
      s0,
      { fromIdx: 0, toIdx: 1 },
      { adapter }
    );
    expect(r.rolledBack).toBe(false);
    expect(r.state.order).toEqual([asBookmarkId("b"), asBookmarkId("a")]);
  });

  it("rolls back on adapter throw", async () => {
    const throwing = {
      put: () => Promise.reject(new Error("boom")),
      get: () => Promise.resolve(null),
      list: () => Promise.resolve([]),
      remove: () => Promise.resolve(),
    } as unknown as BookmarksAdapter;
    const s0: BookmarksState = {
      byId: { a: mk("a"), b: mk("b") },
      order: [asBookmarkId("a"), asBookmarkId("b")],
    };
    const r = await applyReorderBookmark(
      s0,
      { fromIdx: 0, toIdx: 1 },
      { adapter: throwing }
    );
    expect(r.rolledBack).toBe(true);
    expect(r.state.order).toEqual(s0.order);
  });
});

describe("applyMoveBookmarkToFolder", () => {
  it("persists folderId via adapter.put", async () => {
    const adapter = memoryBookmarksAdapter();
    const mk = (id: string, folderId: string | null = null) => {
      const base = buildBookmark(
        { url: `https://${id}.test` },
        { now: () => 1, id: () => asBookmarkId(id) }
      );
      return { ...base, folderId: folderId as never };
    };
    const s0: BookmarksState = {
      byId: { a: mk("a"), b: mk("b", "fld_x") },
      order: [asBookmarkId("a"), asBookmarkId("b")],
    };
    await adapter.put(mk("a"));
    await adapter.put(mk("b", "fld_x"));
    const r = await applyMoveBookmarkToFolder(
      s0,
      {
        id: asBookmarkId("a"),
        folderId: asFolderId("fld_x"),
        insertAfterId: null,
      },
      { adapter }
    );
    expect(r.rolledBack).toBe(false);
    const persisted = await adapter.get(asBookmarkId("a"));
    expect(persisted?.folderId).toBe(asFolderId("fld_x"));
  });

  it("rolls back state if adapter.put throws", async () => {
    const throwing = {
      put: () => Promise.reject(new Error("disk full")),
      get: () => Promise.resolve(null),
      list: () => Promise.resolve([]),
      remove: () => Promise.resolve(),
    } as unknown as BookmarksAdapter;
    const mk = (id: string) =>
      buildBookmark(
        { url: `https://${id}.test` },
        { now: () => 1, id: () => asBookmarkId(id) }
      );
    const s0: BookmarksState = {
      byId: { a: mk("a") },
      order: [asBookmarkId("a")],
    };
    const r = await applyMoveBookmarkToFolder(
      s0,
      {
        id: asBookmarkId("a"),
        folderId: asFolderId("fld_y"),
        insertAfterId: null,
      },
      { adapter: throwing }
    );
    expect(r.rolledBack).toBe(true);
    expect(r.state).toEqual(s0);
  });
});

describe("upsertFromSync LWW guard (F13)", () => {
  function mk(id: string, ts: number) {
    return buildBookmark(
      { url: `https://${id}.test/` },
      { now: () => ts, id: () => asBookmarkId(id) }
    );
  }

  it("skips when existing.updatedAt > incoming.updatedAt (returns same ref)", () => {
    const newer = mk("a", 2000);
    const older = { ...newer, updatedAt: 1000 };
    const state: BookmarksState = {
      byId: { [newer.id]: newer },
      order: [newer.id],
    };
    const next = upsertFromSync(state, older);
    expect(next).toBe(state);
  });

  it("skips when existing.updatedAt === incoming.updatedAt (echo no-op)", () => {
    const b = mk("b", 2000);
    const state: BookmarksState = { byId: { [b.id]: b }, order: [b.id] };
    const next = upsertFromSync(state, b);
    expect(next).toBe(state);
  });

  it("applies when existing.updatedAt < incoming.updatedAt", () => {
    const older = mk("c", 1000);
    const updated = { ...older, updatedAt: 2000, title: "Updated" };
    const state: BookmarksState = {
      byId: { [older.id]: older },
      order: [older.id],
    };
    const next = upsertFromSync(state, updated);
    expect(next).not.toBe(state);
    expect(next.byId[updated.id].title).toBe("Updated");
    expect(next.byId[updated.id].updatedAt).toBe(2000);
  });

  it("inserts when row is new (no existing)", () => {
    const b = mk("d", 2000);
    const state: BookmarksState = { byId: {}, order: [] };
    const next = upsertFromSync(state, b);
    expect(next.byId[b.id]).toEqual(b);
    expect(next.order).toEqual([b.id]);
  });
});

describe("capture helpers (feature 23)", () => {
  function seed(overrides?: Partial<Bookmark>): BookmarksState {
    return [mkBookmark("a", overrides)].reduce(
      (s, b) => addBookmark(s, b).next,
      initialBookmarksState
    );
  }

  it("bumpCaptureAttempt resets to pending + increments + clears failure", () => {
    const s0 = seed({
      captureStatus: "failed",
      captureFailureKind: "transient",
      captureAttempt: 1,
    });
    const { next, inverse } = bumpCaptureAttempt(s0, asBookmarkId("a"), 50);
    const b = next.byId[asBookmarkId("a")]!;
    expect(b.captureStatus).toBe("pending");
    expect(b.captureFailureKind).toBeNull();
    expect(b.captureAttempt).toBe(2);
    expect(inverse(next).byId[asBookmarkId("a")]!.captureStatus).toBe("failed");
  });

  it("applyUpdateCaptureSuccess flips to ready when attempt matches", async () => {
    const s0 = seed({ captureStatus: "pending", captureAttempt: 0 });
    const r = await applyUpdateCaptureSuccess(
      s0,
      { id: asBookmarkId("a"), expectedAttempt: 0 },
      { adapter: memoryBookmarksAdapter(), now: () => 9 }
    );
    expect(r.wrote).toBe(true);
    expect(r.state.byId[asBookmarkId("a")]!.captureStatus).toBe("ready");
  });

  it("applyUpdateCaptureSuccess discards a stale attempt (ghost-write guard)", async () => {
    const s0 = seed({ captureStatus: "pending", captureAttempt: 2 });
    const r = await applyUpdateCaptureSuccess(
      s0,
      { id: asBookmarkId("a"), expectedAttempt: 0 },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.wrote).toBe(false);
    expect(r.state.byId[asBookmarkId("a")]!.captureStatus).toBe("pending");
  });

  it("applyUpdateCaptureFailure flips to failed with kind", async () => {
    const s0 = seed({ captureStatus: "pending", captureAttempt: 0 });
    const r = await applyUpdateCaptureFailure(
      s0,
      { id: asBookmarkId("a"), kind: "permanent", expectedAttempt: 0 },
      { adapter: memoryBookmarksAdapter() }
    );
    expect(r.wrote).toBe(true);
    expect(r.state.byId[asBookmarkId("a")]!.captureStatus).toBe("failed");
    expect(r.state.byId[asBookmarkId("a")]!.captureFailureKind).toBe(
      "permanent"
    );
  });
});

describe("bookmarks-slice — selectBrokenCount (feature 34)", () => {
  it("counts non-tombstoned broken bookmarks", () => {
    let s = initialBookmarksState;
    s = addBookmark(s, mkBookmark("a", { linkStatus: "broken" })).next;
    s = addBookmark(s, mkBookmark("b", { linkStatus: "ok" })).next;
    s = addBookmark(s, mkBookmark("c", { linkStatus: "broken" })).next;
    expect(selectBrokenCount(s)).toBe(2);
  });
});

describe("selectFilteredBookmarks prompts (kindFilter)", () => {
  function setup() {
    const link = mkBookmark("lk", { folderId: null });
    const p1 = mkBookmark("p1", {
      folderId: null,
      kind: "prompt",
      promptCategory: "Coding",
    });
    const p2 = mkBookmark("p2", {
      folderId: null,
      kind: "prompt",
      promptCategory: "Marketing",
    });
    const bookmarksState = [link, p1, p2].reduce(
      (s, b) => addBookmark(s, b).next,
      initialBookmarksState
    );
    return { foldersState: initialFoldersState, bookmarksState };
  }

  it("excludes prompts from default views", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
    });
    expect(out.map((b) => b.id)).toEqual([asBookmarkId("lk")]);
  });

  it("returns only prompts when kindFilter=prompt", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
      kindFilter: "prompt",
    });
    expect(out.map((b) => b.id).sort()).toEqual(
      [asBookmarkId("p1"), asBookmarkId("p2")].sort()
    );
  });

  it("narrows prompts by category", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
      kindFilter: "prompt",
      promptCategory: "Coding",
    });
    expect(out.map((b) => b.id)).toEqual([asBookmarkId("p1")]);
  });
});

describe("selectFilteredBookmarks contentType (links/images/pdfs)", () => {
  function setup() {
    const link = mkBookmark("lk", { folderId: null });
    const legacy = mkBookmark("lg", { folderId: null, kind: undefined });
    const img = mkBookmark("im", { folderId: null, kind: "image" });
    const pdf = mkBookmark("pd", { folderId: null, kind: "pdf" });
    const prompt = mkBookmark("pr", { folderId: null, kind: "prompt" });
    const bookmarksState = [link, legacy, img, pdf, prompt].reduce(
      (s, b) => addBookmark(s, b).next,
      initialBookmarksState
    );
    return { foldersState: initialFoldersState, bookmarksState };
  }

  it("effectiveContentKind maps undefined/link to 'link'", () => {
    expect(effectiveContentKind(mkBookmark("a"))).toBe("link");
    expect(effectiveContentKind(mkBookmark("b", { kind: undefined }))).toBe(
      "link"
    );
    expect(effectiveContentKind(mkBookmark("c", { kind: "image" }))).toBe(
      "image"
    );
    expect(effectiveContentKind(mkBookmark("d", { kind: "pdf" }))).toBe("pdf");
  });

  it("null contentType returns all non-prompt bookmarks", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
      contentType: null,
    });
    expect(out.map((b) => b.id).sort()).toEqual(
      [
        asBookmarkId("lk"),
        asBookmarkId("lg"),
        asBookmarkId("im"),
        asBookmarkId("pd"),
      ].sort()
    );
  });

  it("contentType=link includes legacy (undefined kind) links", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
      contentType: "link",
    });
    expect(out.map((b) => b.id).sort()).toEqual(
      [asBookmarkId("lk"), asBookmarkId("lg")].sort()
    );
  });

  it("contentType=image returns only images", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
      contentType: "image",
    });
    expect(out.map((b) => b.id)).toEqual([asBookmarkId("im")]);
  });

  it("contentType=pdf returns only pdfs", () => {
    const { foldersState, bookmarksState } = setup();
    const out = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter: { kind: "all" },
      contentType: "pdf",
    });
    expect(out.map((b) => b.id)).toEqual([asBookmarkId("pd")]);
  });
});
