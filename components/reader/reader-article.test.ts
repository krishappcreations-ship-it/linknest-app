import { describe, it, expect } from "vitest";
import { sanitizeArticleHtml } from "@/components/reader/reader-article";

describe("sanitizeArticleHtml", () => {
  it("strips <script> tags", () => {
    const out = sanitizeArticleHtml("<p>hi</p><script>alert(1)</script>");
    expect(out).toContain("<p>hi</p>");
    expect(out).not.toMatch(/<script/i);
  });
  it("strips event-handler attributes", () => {
    const out = sanitizeArticleHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
  });
  it("keeps safe structural markup", () => {
    const out = sanitizeArticleHtml(
      '<h2>Title</h2><p><a href="https://x.com">link</a></p>'
    );
    expect(out).toMatch(/<h2>/);
    expect(out).toMatch(/<a/);
  });
});
