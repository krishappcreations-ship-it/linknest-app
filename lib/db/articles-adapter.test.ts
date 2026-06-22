import { describe, it, expect } from "vitest";
import { memoryArticlesAdapter } from "@/lib/db/articles-adapter";
import { asBookmarkId, type Article } from "@/types";

function art(id: string): Article {
  return {
    bookmarkId: asBookmarkId(id),
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
}

describe("memoryArticlesAdapter", () => {
  it("put + get round-trips by bookmarkId", async () => {
    const a = memoryArticlesAdapter();
    await a.put(art("bk_1"));
    expect((await a.get(asBookmarkId("bk_1")))!.textContent).toBe("x");
  });
  it("get returns null when absent", async () => {
    const a = memoryArticlesAdapter();
    expect(await a.get(asBookmarkId("ghost"))).toBeNull();
  });
  it("remove deletes; get returns null after", async () => {
    const a = memoryArticlesAdapter();
    await a.put(art("bk_1"));
    await a.remove(asBookmarkId("bk_1"));
    expect(await a.get(asBookmarkId("bk_1"))).toBeNull();
  });
  it("list returns all rows", async () => {
    const a = memoryArticlesAdapter();
    await a.put(art("bk_1"));
    await a.put(art("bk_2"));
    expect((await a.list()).length).toBe(2);
  });
});
