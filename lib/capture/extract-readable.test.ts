import { describe, it, expect } from "vitest";
import { extractReadable } from "@/lib/capture/extract-readable";

const ARTICLE = `<!doctype html><html><head><title>Headline</title>
<meta name="author" content="Jane Doe"></head><body><article>
<h1>Headline</h1>${"<p>Sentence with several words here for length.</p>".repeat(25)}
<script>alert(1)</script><img src="/hero.png"></article></body></html>`;

describe("extractReadable", () => {
  it("extracts an article and strips scripts", () => {
    const out = extractReadable(ARTICLE, "https://example.com/post");
    expect(out).not.toBeNull();
    expect(out!.textContent).toMatch(/Sentence with several words/);
    expect(out!.html).not.toMatch(/<script/i);
    expect(out!.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it("absolutizes the hero image against the page URL", () => {
    const out = extractReadable(ARTICLE, "https://example.com/post");
    expect(out!.heroImageUrl).toBe("https://example.com/hero.png");
  });

  it("returns null for a non-article page", () => {
    const out = extractReadable(
      "<html><body><nav>menu</nav><div>hi</div></body></html>",
      "https://e.com"
    );
    expect(out).toBeNull();
  });
});
