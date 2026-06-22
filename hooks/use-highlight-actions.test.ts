import { describe, it, expect } from "vitest";
import { buildHighlight } from "@/lib/highlights/build";
import { asBookmarkId } from "@/types";

describe("buildHighlight", () => {
  it("builds a highlight with branded ids, color, and createdAt", () => {
    const h = buildHighlight(
      {
        bookmarkId: asBookmarkId("bk_1"),
        quote: "x",
        prefix: "a",
        suffix: "b",
        color: "blue",
      },
      { now: () => 99, id: () => "hl_fixed" }
    );
    expect(h).toMatchObject({
      id: "hl_fixed",
      bookmarkId: "bk_1",
      quote: "x",
      prefix: "a",
      suffix: "b",
      color: "blue",
      annotation: null,
      createdAt: 99,
    });
  });
});
