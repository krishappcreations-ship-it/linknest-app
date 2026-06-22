/**
 * Link health check (feature 34). classifyHealth is pure; checkLink reuses the
 * F02 SSRF guard + a GET (status + final URL only). Conservative: only definitive
 * deadness (404/410/4xx) is "broken"; restricted is "ok"; transient is "unknown".
 */

import { guardSsrf, TIMEOUT_MS } from "@/lib/preview/fetch-preview";
import { canonicalizeUrl } from "@/lib/dedupe/canonicalize";
import type { LinkStatus } from "@/types";

export interface LinkCheckResult {
  status: LinkStatus;
  redirectUrl?: string;
  httpStatus?: number;
}

const UA = "LinkNest/0.1 (+https://github.com/krish/linknest)";

export function classifyHealth(
  httpStatus: number,
  meaningfulRedirect: boolean,
  finalUrl: string
): LinkCheckResult {
  if (httpStatus >= 200 && httpStatus < 300) {
    return meaningfulRedirect
      ? { status: "redirected", redirectUrl: finalUrl, httpStatus }
      : { status: "ok", httpStatus };
  }
  if ([401, 403, 405, 429].includes(httpStatus))
    return { status: "ok", httpStatus };
  if (httpStatus >= 400 && httpStatus < 500)
    return { status: "broken", httpStatus };
  return { status: "unknown", httpStatus };
}

export async function checkLink(url: string): Promise<LinkCheckResult> {
  if (guardSsrf(url)) return { status: "unknown" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
      redirect: "follow",
      signal: controller.signal,
    });
    let meaningful = false;
    try {
      meaningful =
        res.redirected && canonicalizeUrl(res.url) !== canonicalizeUrl(url);
    } catch {
      meaningful = res.redirected;
    }
    return classifyHealth(res.status, meaningful, res.url || url);
  } catch {
    return { status: "unknown" };
  } finally {
    clearTimeout(timer);
  }
}
