import { describe, expect, it } from "vitest";
import { createMemorySyncStore, memorySyncAdapter } from "./memory-sync";
import type { Bookmark, BookmarkId } from "@/types";

function mkBookmark(id: string, updatedAt: number): Bookmark {
  return {
    id: id as BookmarkId,
    url: `https://x/${id}`,
    title: id,
    description: null,
    previewImageUrl: null,
    faviconUrl: null,
    domain: "x",
    previewStatus: "pending",
    folderId: null,
    tagIds: [],
    createdAt: 0,
    updatedAt,
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
    readState: "inbox",
    captureStatus: "pending",
    captureFailureKind: null,
    captureAttempt: 0,
    readProgress: 0,
  };
}

describe("memorySyncAdapter", () => {
  it("uploadAll then fetchAll round-trips", async () => {
    const store = createMemorySyncStore();
    const adapter = memorySyncAdapter(store);
    await adapter.uploadAll("u1", {
      bookmarks: [mkBookmark("b1", 100)],
      folders: [],
      tags: [],
      preferences: null,
    });
    const out = await adapter.fetchAll("u1");
    expect(out.bookmarks).toHaveLength(1);
    expect(out.bookmarks[0].id).toBe("b1");
  });

  it("LWW: newer updatedAt wins on putBookmark", async () => {
    const store = createMemorySyncStore();
    const adapter = memorySyncAdapter(store);
    await adapter.putBookmark("u1", mkBookmark("b1", 100));
    await adapter.putBookmark("u1", mkBookmark("b1", 50)); // older, must lose
    const out = await adapter.fetchAll("u1");
    expect(out.bookmarks[0].updatedAt).toBe(100);
  });

  it("LWW: equal updatedAt — incoming wins (>= comparison)", async () => {
    const store = createMemorySyncStore();
    const adapter = memorySyncAdapter(store);
    const a = mkBookmark("b1", 100);
    a.title = "first";
    const b = mkBookmark("b1", 100);
    b.title = "second";
    await adapter.putBookmark("u1", a);
    await adapter.putBookmark("u1", b);
    const out = await adapter.fetchAll("u1");
    expect(out.bookmarks[0].title).toBe("second");
  });

  it("failNext triggers single rejection then clears", async () => {
    const store = createMemorySyncStore();
    const adapter = memorySyncAdapter(store);
    store.failNext = new Error("boom");
    await expect(
      adapter.putBookmark("u1", mkBookmark("b1", 1))
    ).rejects.toThrow("boom");
    // next call succeeds
    await adapter.putBookmark("u1", mkBookmark("b1", 1));
    const out = await adapter.fetchAll("u1");
    expect(out.bookmarks).toHaveLength(1);
  });
});
