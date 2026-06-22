/**
 * Readable article extraction — feature 23. Server-only.
 *
 * linkedom + Mozilla Readability find the main article; DOMPurify sanitizes the
 * extracted HTML at capture time so the stored snapshot is render-safe for
 * Reader Mode (F24). Returns null when the page is not an article.
 *
 * Uses linkedom (not jsdom): jsdom's import chain crashes on Vercel serverless
 * functions (the route module fails to load → 500). linkedom is a lightweight,
 * serverless-safe DOM that Readability + DOMPurify both run against.
 */

import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import createDOMPurify from "dompurify";

export interface Extracted {
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  siteName: string | null;
  publishedTime: string | null;
  html: string;
  textContent: string;
  readingMinutes: number;
  heroImageUrl: string | null;
}

export function extractReadable(html: string, url: string): Extracted | null {
  const { document, window } = parseHTML(html);
  // Give Readability a base href so relative links/images resolve absolutely
  // (jsdom got this from its `url` option; linkedom needs an explicit <base>).
  if (!document.querySelector("base")) {
    const base = document.createElement("base");
    base.setAttribute("href", url);
    (document.head ?? document.documentElement)?.prepend(base);
  }

  const reader = new Readability(
    document as unknown as ConstructorParameters<typeof Readability>[0]
  );
  const parsed = reader.parse();
  if (!parsed || !parsed.content) return null;

  const purify = createDOMPurify(
    window as unknown as Parameters<typeof createDOMPurify>[0]
  );
  const cleanHtml = purify.sanitize(parsed.content, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });

  const { document: frag } = parseHTML(`<body>${cleanHtml}</body>`);
  const firstImg = frag.querySelector("img");
  const heroImageUrl = firstImg?.getAttribute("src") || null;

  const words = (parsed.textContent || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  // Readability is lenient — it returns thin content for non-article pages
  // (nav shells, link lists, app dashboards). Require real substance so those
  // settle to "not readable" rather than producing a useless snapshot.
  const MIN_ARTICLE_WORDS = 100;
  if (words < MIN_ARTICLE_WORDS) return null;
  const readingMinutes = Math.max(1, Math.ceil(words / 220));

  const publishedTime =
    (parsed as { publishedTime?: string | null }).publishedTime ?? null;

  return {
    title: parsed.title || null,
    byline: parsed.byline || null,
    excerpt: parsed.excerpt || null,
    siteName: parsed.siteName || null,
    publishedTime,
    html: cleanHtml,
    textContent: parsed.textContent || "",
    readingMinutes,
    heroImageUrl,
  };
}
