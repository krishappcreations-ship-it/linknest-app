/**
 * Server-side preview fetcher — feature 02.
 *
 * Lives behind /api/preview/route.ts. Enforces every safety boundary
 * (SSRF block, 5s timeout, 2 MB cap, 5-redirect cap inherited from
 * fetch's default `redirect: "follow"`). Returns a PreviewResponse
 * union — the route handler is a thin shim that JSON-stringifies this.
 */

import { parse } from "node-html-parser";
import type { PreviewResponse } from "@/types";
import { screenshotFallbackUrl } from "@/lib/preview/screenshot-url";

export const TIMEOUT_MS = 5_000;
export const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT = "LinkNest/0.1 (+https://github.com/krish/linknest)";

const PRIVATE_HOST_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/i,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
];

export async function fetchPreview(url: string): Promise<PreviewResponse> {
  const ssrf = guardSsrf(url);
  if (ssrf) return ssrf;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!res.ok) {
      // 5xx (transient) and 429 (our own rate limit during a bulk refresh) should
      // retry for the real metadata, not get permanently replaced by a screenshot.
      // Other 4xx (e.g. 403 bot-block) won't improve on retry → screenshot the
      // page; mShots' own crawler often renders sites our server fetch can't.
      if ((res.status >= 500 && res.status < 600) || res.status === 429) {
        return { ok: false, kind: "http_error", retriable: true };
      }
      return screenshotResult(res.url || url);
    }

    const body = await readCapped(res, MAX_BYTES);
    if (body === "oversize") {
      // Page exists but is too big to parse — a screenshot still works.
      return screenshotResult(res.url || url);
    }

    const meta = parseHead(body, res.url || url);
    return { ok: true, ...meta, fetchedAt: Date.now() };
  } catch (err) {
    const e = err as { name?: string };
    if (e?.name === "AbortError") {
      return { ok: false, kind: "timeout", retriable: true };
    }
    return { ok: false, kind: "network", retriable: true };
  } finally {
    clearTimeout(timer);
  }
}

export function guardSsrf(rawUrl: string): PreviewResponse | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { ok: false, kind: "blocked", retriable: false };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, kind: "blocked", retriable: false };
  }
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "0.0.0.0") {
    return { ok: false, kind: "blocked", retriable: false };
  }
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) {
    return { ok: false, kind: "blocked", retriable: false };
  }
  return null;
}

export async function readCapped(
  res: Response,
  max: number
): Promise<string | "oversize"> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      try {
        await reader.cancel();
      } catch {
        /* noop */
      }
      return "oversize";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(out);
}

/**
 * Terminal success built from a page screenshot, used when the page itself
 * can't be fetched/parsed (4xx bot-block, oversize). No title/description —
 * just the screenshot + a favicon guess.
 */
function screenshotResult(finalUrl: string): PreviewResponse {
  let favicon: string | null = null;
  try {
    favicon = `https://www.google.com/s2/favicons?domain=${new URL(finalUrl).hostname}&sz=64`;
  } catch {
    favicon = null;
  }
  return {
    ok: true,
    title: null,
    description: null,
    ogImage: screenshotFallbackUrl(finalUrl),
    favicon,
    fetchedAt: Date.now(),
  };
}

function parseHead(
  html: string,
  finalUrl: string
): {
  title: string | null;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
} {
  const lower = html.toLowerCase();
  const headEnd = lower.indexOf("</head>");
  const headHtml =
    headEnd === -1 ? html.slice(0, 64_000) : html.slice(0, headEnd + 7);
  const root = parse(headHtml, { lowerCaseTagName: true, comment: false });
  const head = root.querySelector("head") ?? root;

  const meta = (selector: string, attr: string): string | null => {
    const el = head.querySelector(selector);
    const v = el?.getAttribute(attr)?.trim();
    return v ? v : null;
  };

  const titleEl = head.querySelector("title");
  const rawTitle = (titleEl?.text ?? "").trim();
  const titleAttr = meta('meta[property="og:title"]', "content");
  const title = rawTitle || titleAttr;

  const description =
    meta('meta[property="og:description"]', "content") ||
    meta('meta[name="description"]', "content");

  const ogImage =
    absolutize(meta('meta[property="og:image"]', "content"), finalUrl) ||
    absolutize(meta('meta[name="twitter:image"]', "content"), finalUrl) ||
    absolutize(meta('meta[name="twitter:image:src"]', "content"), finalUrl) ||
    absolutize(meta('meta[property="twitter:image"]', "content"), finalUrl) ||
    // No image exposed by the page — fall back to a live screenshot of it.
    screenshotFallbackUrl(finalUrl);

  let favicon =
    absolutize(meta('link[rel="icon"]', "href"), finalUrl) ||
    absolutize(meta('link[rel="shortcut icon"]', "href"), finalUrl);

  if (!favicon) {
    try {
      const host = new URL(finalUrl).hostname;
      favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
    } catch {
      favicon = null;
    }
  }

  return {
    title: title || null,
    description: description || null,
    ogImage,
    favicon,
  };
}

function absolutize(href: string | null, base: string): string | null {
  if (!href) return null;
  // Reject hrefs that aren't a valid absolute URL and don't look like a
  // well-formed relative reference (path/protocol-relative/fragment/query).
  // Without this guard, `new URL("not a url", base)` happily produces
  // `${base}/not%20a%20url`, leaking junk text into ogImage.
  const trimmed = href.trim();
  if (!trimmed) return null;
  const isAbsolute = /^[a-z][a-z0-9+\-.]*:/i.test(trimmed);
  if (!isAbsolute) {
    const looksRelative =
      trimmed.startsWith("/") ||
      trimmed.startsWith("./") ||
      trimmed.startsWith("../") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("?");
    if (!looksRelative) return null;
  }
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}
