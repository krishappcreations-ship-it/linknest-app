import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useStore } from "@/store";
import { addHighlight } from "@/store/slices/highlights-slice";
import { ReaderArticle } from "./reader-article";
import {
  asHighlightId,
  asBookmarkId,
  type Article,
  type Highlight,
} from "@/types";

const article: Article = {
  bookmarkId: asBookmarkId("bk_1"),
  html: "<p>please highlight me now</p>",
  textContent: "please highlight me now",
  title: "Test",
  byline: null,
  excerpt: null,
  siteName: null,
  publishedTime: null,
  readingMinutes: 1,
  heroImageUrl: null,
  capturedAt: 1,
  summary: null,
} as Article;

const hl: Highlight = {
  id: asHighlightId("hl_1"),
  bookmarkId: asBookmarkId("bk_1"),
  quote: "highlight me",
  prefix: "please ",
  suffix: " now",
  color: "green",
  annotation: null,
  createdAt: 1,
} as Highlight;

beforeEach(() => {
  useStore.setState({ highlights: { byId: {} } });
});

describe("ReaderArticle highlight painting (F30)", () => {
  it("paints a stored highlight as a colored mark", () => {
    useStore.setState((s) => ({ highlights: addHighlight(s.highlights, hl) }));
    const { container } = render(<ReaderArticle article={article} />);
    const mark = container.querySelector("mark[data-hl-id]");
    expect(mark).not.toBeNull();
    expect(mark!.getAttribute("data-color")).toBe("green");
    expect(mark!.textContent).toBe("highlight me");
  });

  it("reports unresolved highlights via onUnresolved", () => {
    const missing: Highlight = {
      ...hl,
      id: asHighlightId("hl_x"),
      quote: "absent",
    };
    useStore.setState((s) => ({
      highlights: addHighlight(s.highlights, missing),
    }));
    let reported: Highlight[] = [];
    render(
      <ReaderArticle article={article} onUnresolved={(u) => (reported = u)} />
    );
    expect(reported.map((r) => r.quote)).toEqual(["absent"]);
  });
});
