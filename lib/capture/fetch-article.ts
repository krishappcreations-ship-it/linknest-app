/**
 * Server-side article fetcher — feature 23. Behind /api/capture.
 *
 * Reuses the preview pipeline's SSRF guard + capped streamed reader (single
 * trust boundary, no duplication). Larger budgets than preview: 8s timeout,
 * 5 MB raw cap. Delegates extraction to extractReadable.
 */

import { extractReadable } from "@/lib/capture/extract-readable";
import { guardSsrf, readCapped } from "@/lib/preview/fetch-preview";
import type { CaptureResponse } from "@/types";

export const TIMEOUT_MS = 8_000;
export const MAX_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "LinkNest/0.1 (+https://github.com/krish/linknest)";

export async function fetchArticle(url: string): Promise<CaptureResponse> {
  if (guardSsrf(url)) return { ok: false, kind: "blocked", retriable: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        ok: false,
        kind: "http_error",
        retriable: res.status >= 500 && res.status < 600,
      };
    }

    const body = await readCapped(res, MAX_BYTES);
    if (body === "oversize") {
      return { ok: false, kind: "oversize", retriable: false };
    }

    const extracted = extractReadable(body, res.url || url);
    if (!extracted) {
      return { ok: false, kind: "not_readable", retriable: false };
    }
    return { ok: true, ...extracted, fetchedAt: Date.now() };
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
