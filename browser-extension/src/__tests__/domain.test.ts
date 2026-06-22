import { describe, it, expect } from "vitest";
import { normalizeUrl, extractDomain } from "../lib/domain";

describe("normalizeUrl", () => {
  it("lowercases scheme and host", () => {
    expect(normalizeUrl("HTTPS://GitHub.COM/vercel/next.js")).toBe(
      "https://github.com/vercel/next.js"
    );
  });
  it("strips trailing slash from path longer than /", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path"
    );
  });
  it("strips default https port 443", () => {
    expect(normalizeUrl("https://example.com:443/page")).toBe(
      "https://example.com/page"
    );
  });
  it("preserves non-default port", () => {
    expect(normalizeUrl("https://example.com:8080/")).toBe(
      "https://example.com:8080/"
    );
  });
  it("strips bare fragment #", () => {
    expect(normalizeUrl("https://example.com/#")).toBe("https://example.com/");
  });
  it("preserves fragment with value", () => {
    expect(normalizeUrl("https://example.com/#section")).toBe(
      "https://example.com/#section"
    );
  });
});

describe("extractDomain", () => {
  it("strips www prefix", () => {
    expect(extractDomain("https://www.github.com/")).toBe("github.com");
  });
  it("returns host for non-www URL", () => {
    expect(extractDomain("https://github.com/")).toBe("github.com");
  });
  it("lowercases the result", () => {
    expect(extractDomain("https://GitHub.COM/")).toBe("github.com");
  });
});
