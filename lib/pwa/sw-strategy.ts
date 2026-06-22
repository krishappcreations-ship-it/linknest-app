/**
 * Pure routing decision for the service worker (feature 33). `public/sw.js`
 * mirrors these rules; this is the unit-tested contract. Network-first for
 * navigations means a fresh deploy's HTML always wins online — no stale chunks.
 */

export type SwStrategy = "network-first" | "swr" | "passthrough";

export interface SwRequestInfo {
  method: string;
  sameOrigin: boolean;
  isNavigate: boolean;
  path: string;
}

const STATIC_PREFIXES = ["/_next/static", "/icon", "/manifest"];

export function swStrategyFor(req: SwRequestInfo): SwStrategy {
  if (req.method !== "GET" || !req.sameOrigin) return "passthrough";
  if (req.path.startsWith("/api/") || req.path.includes(".worker"))
    return "passthrough";
  if (req.isNavigate) return "network-first";
  if (STATIC_PREFIXES.some((p) => req.path.startsWith(p))) return "swr";
  return "passthrough";
}
