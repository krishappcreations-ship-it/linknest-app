import { describe, it, expect } from "vitest";
import { cosineSim, cosineTopK } from "@/lib/search/cosine";

describe("cosineSim", () => {
  it("identical normalized vectors → 1", () => {
    expect(cosineSim([1, 0], [1, 0])).toBeCloseTo(1);
  });
  it("orthogonal → 0", () => {
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("cosineTopK", () => {
  it("returns top-k sorted desc, capped at k", () => {
    const out = cosineTopK([1, 0], { a: [1, 0], b: [0, 1], c: [0.9, 0.1] }, 2);
    expect(out.map((r) => r.id)).toEqual(["a", "c"]);
    expect(out).toHaveLength(2);
  });
  it("empty corpus → empty", () => {
    expect(cosineTopK([1, 0], {}, 5)).toEqual([]);
  });
});
