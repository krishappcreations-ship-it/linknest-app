import { describe, it, expect } from "vitest";
import {
  initialHighlightsState,
  addHighlight,
  updateHighlight,
  removeHighlight,
  removeHighlightsForBookmark,
  selectHighlightsForBookmark,
} from "@/store/slices/highlights-slice";
import { asHighlightId, asBookmarkId, type Highlight } from "@/types";

const h = (id: string, bk: string, createdAt = 1): Highlight =>
  ({
    id: asHighlightId(id),
    bookmarkId: asBookmarkId(bk),
    quote: "q",
    prefix: "",
    suffix: "",
    color: "yellow",
    annotation: null,
    createdAt,
  }) as Highlight;

describe("highlights-slice", () => {
  it("adds and selects by bookmark in createdAt order", () => {
    let s = initialHighlightsState;
    s = addHighlight(s, h("hl_2", "bk_1", 20));
    s = addHighlight(s, h("hl_1", "bk_1", 10));
    s = addHighlight(s, h("hl_3", "bk_2", 5));
    const forBk1 = selectHighlightsForBookmark(s, asBookmarkId("bk_1"));
    expect(forBk1.map((x) => x.id)).toEqual([
      asHighlightId("hl_1"),
      asHighlightId("hl_2"),
    ]);
  });

  it("updates color + annotation", () => {
    let s = addHighlight(initialHighlightsState, h("hl_1", "bk_1"));
    s = updateHighlight(s, asHighlightId("hl_1"), {
      color: "green",
      annotation: "note",
    });
    expect(s.byId[asHighlightId("hl_1")]).toMatchObject({
      color: "green",
      annotation: "note",
    });
  });

  it("removes one and removes all for a bookmark", () => {
    let s = initialHighlightsState;
    s = addHighlight(s, h("hl_1", "bk_1"));
    s = addHighlight(s, h("hl_2", "bk_1"));
    s = addHighlight(s, h("hl_3", "bk_2"));
    s = removeHighlight(s, asHighlightId("hl_1"));
    expect(Object.keys(s.byId).length).toBe(2);
    s = removeHighlightsForBookmark(s, asBookmarkId("bk_1"));
    expect(Object.keys(s.byId)).toEqual([asHighlightId("hl_3")]);
  });
});
