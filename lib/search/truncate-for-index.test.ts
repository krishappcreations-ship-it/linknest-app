import { describe, it, expect } from "vitest";
import {
  truncateForIndex,
  INDEX_MAX_CHARS,
} from "@/lib/search/truncate-for-index";

describe("truncateForIndex", () => {
  it("lowercases", () => {
    expect(truncateForIndex("Hello WORLD")).toBe("hello world");
  });
  it("truncates to INDEX_MAX_CHARS", () => {
    const long = "A".repeat(INDEX_MAX_CHARS + 500);
    expect(truncateForIndex(long).length).toBe(INDEX_MAX_CHARS);
  });
  it("leaves short text intact (lowercased)", () => {
    expect(truncateForIndex("Zero Trust")).toBe("zero trust");
  });
});
