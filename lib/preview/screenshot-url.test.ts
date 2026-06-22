import { describe, expect, it } from "vitest";
import {
  screenshotFallbackUrl,
  SCREENSHOT_WIDTH,
} from "@/lib/preview/screenshot-url";

describe("screenshotFallbackUrl", () => {
  it("builds an mShots URL with the single-encoded target + width", () => {
    expect(screenshotFallbackUrl("https://www.behance.net")).toBe(
      `https://s.wordpress.com/mshots/v1/https%3A%2F%2Fwww.behance.net?w=${SCREENSHOT_WIDTH}`
    );
  });

  it("encodes query strings and paths in the target url", () => {
    const out = screenshotFallbackUrl("https://x.test/a?b=c&d=e");
    expect(out.startsWith("https://s.wordpress.com/mshots/v1/")).toBe(true);
    // Encoded once: the target's ? & / are percent-encoded, not literal.
    expect(out).toContain("https%3A%2F%2Fx.test%2Fa%3Fb%3Dc%26d%3De");
    expect(out).toContain(`?w=${SCREENSHOT_WIDTH}`);
  });

  it("produces a valid absolute https URL (passes z.string().url())", () => {
    expect(
      () => new URL(screenshotFallbackUrl("https://example.com"))
    ).not.toThrow();
  });
});
