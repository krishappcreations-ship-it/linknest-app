import { describe, it, expect } from "vitest";
import { swStrategyFor } from "@/lib/pwa/sw-strategy";

const S = (over: Partial<Parameters<typeof swStrategyFor>[0]> = {}) =>
  swStrategyFor({
    method: "GET",
    sameOrigin: true,
    isNavigate: false,
    path: "/x",
    ...over,
  });

describe("swStrategyFor", () => {
  it("network-first for same-origin navigations", () => {
    expect(S({ isNavigate: true, path: "/" })).toBe("network-first");
  });
  it("stale-while-revalidate for static assets", () => {
    expect(S({ path: "/_next/static/chunk.js" })).toBe("swr");
    expect(S({ path: "/icon.svg" })).toBe("swr");
    expect(S({ path: "/manifest.webmanifest" })).toBe("swr");
  });
  it("passthrough for non-GET, cross-origin, api, and workers", () => {
    expect(S({ method: "POST", isNavigate: true })).toBe("passthrough");
    expect(S({ sameOrigin: false, isNavigate: true })).toBe("passthrough");
    expect(S({ path: "/api/preview" })).toBe("passthrough");
    expect(S({ path: "/embed.worker.js" })).toBe("passthrough");
  });
  it("passthrough for an uncacheable same-origin GET", () => {
    expect(S({ path: "/read/abc" })).toBe("passthrough");
  });
});
