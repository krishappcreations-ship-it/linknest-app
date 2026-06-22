import { describe, it, expect } from "vitest";
import { persistSummary } from "@/lib/ai/persist-summary";
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

const summary = {
  tldr: "short",
  keyPoints: ["a", "b"],
  model: "claude-haiku-4-5-20251001",
  summarizedAt: 9,
};

describe("persistSummary", () => {
  it("merges summary onto the article", async () => {
    const a = memoryArticlesAdapter();
    await a.put(art("bk_1"));
    await persistSummary(a, asBookmarkId("bk_1"), summary);
    const out = await a.get(asBookmarkId("bk_1"));
    expect(out!.summary?.tldr).toBe("short");
    expect(out!.textContent).toBe("x"); // other fields preserved
  });

  it("no-ops when the article is missing", async () => {
    const a = memoryArticlesAdapter();
    await persistSummary(a, asBookmarkId("ghost"), summary);
    expect(await a.get(asBookmarkId("ghost"))).toBeNull();
  });
});
