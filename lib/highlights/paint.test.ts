import { describe, it, expect } from "vitest";
import { paintHighlights, clearHighlights } from "@/lib/highlights/paint";
import { asHighlightId, asBookmarkId, type Highlight } from "@/types";

function root(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}
const h = (
  quote: string,
  prefix = "",
  suffix = "",
  color = "yellow",
  annotation: string | null = null
): Highlight =>
  ({
    id: asHighlightId("hl_" + quote),
    bookmarkId: asBookmarkId("bk_1"),
    quote,
    prefix,
    suffix,
    color,
    annotation,
    createdAt: 1,
  }) as Highlight;

describe("paint", () => {
  it("wraps a resolved quote in a mark and reports unresolved", () => {
    const r = root("<p>the quick brown fox</p>");
    const unresolved = paintHighlights(r, [h("quick"), h("missing")]);
    const marks = r.querySelectorAll("mark[data-hl-id]");
    expect(marks.length).toBe(1);
    expect(marks[0]!.getAttribute("data-color")).toBe("yellow");
    expect(unresolved.map((u) => u.quote)).toEqual(["missing"]);
  });

  it("marks annotated highlights with data-annotated", () => {
    const r = root("<p>the quick brown fox</p>");
    paintHighlights(r, [h("brown", "quick ", " fox", "green", "a note")]);
    const mark = r.querySelector("mark[data-hl-id]")!;
    expect(mark.getAttribute("data-annotated")).toBe("true");
  });

  it("clear removes marks and restores text", () => {
    const r = root("<p>the quick brown fox</p>");
    paintHighlights(r, [h("quick")]);
    clearHighlights(r);
    expect(r.querySelectorAll("mark[data-hl-id]").length).toBe(0);
    expect(r.textContent).toBe("the quick brown fox");
  });

  it("repaint is idempotent (no nested marks)", () => {
    const r = root("<p>the quick brown fox</p>");
    paintHighlights(r, [h("quick")]);
    paintHighlights(r, [h("quick")]);
    expect(r.querySelectorAll("mark[data-hl-id]").length).toBe(1);
  });
});
