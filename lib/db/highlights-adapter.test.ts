import { describe, it, expect } from "vitest";
import { memoryHighlightsAdapter } from "@/lib/db/highlights-adapter";
import { asHighlightId, asBookmarkId, type Highlight } from "@/types";

const h = (id: string, bk: string): Highlight =>
  ({
    id: asHighlightId(id),
    bookmarkId: asBookmarkId(bk),
    quote: "q",
    prefix: "",
    suffix: "",
    color: "yellow",
    annotation: null,
    createdAt: 1,
  }) as Highlight;

describe("highlightsAdapter (memory)", () => {
  it("puts, lists, removes, and removes by bookmark", async () => {
    const a = memoryHighlightsAdapter();
    await a.put(h("hl_1", "bk_1"));
    await a.put(h("hl_2", "bk_1"));
    await a.put(h("hl_3", "bk_2"));
    expect((await a.list()).length).toBe(3);
    await a.remove(asHighlightId("hl_1"));
    expect((await a.list()).length).toBe(2);
    await a.removeByBookmark(asBookmarkId("bk_1"));
    expect((await a.list()).map((x) => x.id)).toEqual([asHighlightId("hl_3")]);
  });
});
