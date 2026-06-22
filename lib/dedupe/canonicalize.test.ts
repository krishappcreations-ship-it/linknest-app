import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "@/lib/dedupe/canonicalize";

describe("canonicalizeUrl", () => {
  it("strips utm_* and other tracking params", () => {
    expect(
      canonicalizeUrl("https://ex.com/p?utm_source=x&utm_medium=y&id=7")
    ).toBe("https://ex.com/p?id=7");
  });

  it("strips fbclid/gclid/igshid/ref", () => {
    expect(canonicalizeUrl("https://ex.com/p?fbclid=abc&gclid=z")).toBe(
      "https://ex.com/p"
    );
    expect(canonicalizeUrl("https://ex.com/p?igshid=i&ref=tw")).toBe(
      "https://ex.com/p"
    );
  });

  it("drops the fragment entirely", () => {
    expect(canonicalizeUrl("https://ex.com/p#section-2")).toBe(
      "https://ex.com/p"
    );
  });

  it("sorts remaining params so order never defeats matching", () => {
    expect(canonicalizeUrl("https://ex.com/p?b=2&a=1")).toBe(
      canonicalizeUrl("https://ex.com/p?a=1&b=2")
    );
  });

  it("preserves real (non-tracking) params", () => {
    expect(canonicalizeUrl("https://ex.com/s?q=cats&page=2")).toBe(
      "https://ex.com/s?page=2&q=cats"
    );
  });

  it("is idempotent", () => {
    const once = canonicalizeUrl("https://ex.com/p?utm_source=x#h");
    expect(canonicalizeUrl(once)).toBe(once);
  });

  it("returns the input unchanged on parse failure", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
  });
});
