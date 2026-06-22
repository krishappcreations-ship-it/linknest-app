import { describe, it, expect } from "vitest";
import { findSimilar } from "@/lib/dedupe/similar";

const byId = {
  a: [1, 0, 0],
  b: [0.95, 0.05, 0],
  c: [0.9, 0.1, 0],
  d: [0, 1, 0],
};

describe("findSimilar", () => {
  it("ranks others by cosine to the source, descending", () => {
    const hits = findSimilar("a", byId, { minScore: 0 });
    expect(hits.map((h) => h.id)).toEqual(["b", "c", "d"]);
  });

  it("excludes the source id itself", () => {
    expect(
      findSimilar("a", byId, { minScore: 0 }).map((h) => h.id)
    ).not.toContain("a");
  });

  it("applies the minScore floor (default 0.8)", () => {
    expect(findSimilar("a", byId).map((h) => h.id)).toEqual(["b", "c"]);
  });

  it("respects k", () => {
    expect(findSimilar("a", byId, { k: 1, minScore: 0 }).length).toBe(1);
  });

  it("returns [] when the source has no vector", () => {
    expect(findSimilar("missing", byId)).toEqual([]);
  });
});
