/**
 * Canonical de-duplication key for a bookmark URL (feature 29). Builds on
 * `normalizeUrl` (scheme/host lowercase, default-port + trailing-slash strip),
 * then drops the fragment and known tracking query params, and sorts the
 * remaining params so param order never defeats matching. Pure. The stored
 * Bookmark.url is NOT canonicalized — this is only the dedup match key.
 */

import { normalizeUrl } from "@/types";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "gad_source",
  "mc_eid",
  "mc_cid",
  "igshid",
  "si",
  "ref",
  "ref_src",
  "_hsenc",
  "_hsmi",
  "vero_id",
  "yclid",
]);

export function canonicalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(normalizeUrl(input));
  } catch {
    return input;
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}
