import { describe, it, expect, vi } from "vitest";
import { semanticSearch } from "@/lib/search/semantic";

const corpus = {
  a: [1, 0, 0],
  b: [0, 1, 0],
  c: [0.9, 0.1, 0],
};

describe("semanticSearch", () => {
  it("ranks by cosine similarity to the embedded query", async () => {
    const embed = vi.fn(async () => [1, 0, 0]);
    const hits = await semanticSearch("apple", corpus, 3, embed, 0);
    expect(hits.map((h) => h.id)).toEqual(["a", "c", "b"]);
    expect(embed).toHaveBeenCalledWith("apple");
  });

  it("respects k", async () => {
    const hits = await semanticSearch("x", corpus, 2, async () => [1, 0, 0], 0);
    expect(hits.length).toBe(2);
  });

  it("filters below minScore", async () => {
    const hits = await semanticSearch("x", corpus, 3, async () => [1, 0, 0]);
    // default minScore 0.2 drops b (score 0)
    expect(hits.map((h) => h.id)).toEqual(["a", "c"]);
  });

  it("empty query → [] and never embeds", async () => {
    const embed = vi.fn(async () => [1, 0, 0]);
    expect(await semanticSearch("   ", corpus, 3, embed)).toEqual([]);
    expect(embed).not.toHaveBeenCalled();
  });

  it("empty corpus → []", async () => {
    expect(await semanticSearch("x", {}, 3, async () => [1, 0, 0])).toEqual([]);
  });
});
