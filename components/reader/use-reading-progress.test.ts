import { describe, it, expect } from "vitest";
import {
  computeRatio,
  shouldFinish,
} from "@/components/reader/use-reading-progress";

describe("computeRatio", () => {
  it("0 at top", () => {
    expect(computeRatio(0, 2000, 1000)).toBe(0);
  });
  it("1 at bottom", () => {
    expect(computeRatio(1000, 2000, 1000)).toBe(1);
  });
  it("0.5 at midpoint", () => {
    expect(computeRatio(500, 2000, 1000)).toBe(0.5);
  });
  it("1 when content fits (no scroll)", () => {
    expect(computeRatio(0, 800, 1000)).toBe(1);
  });
});

describe("shouldFinish", () => {
  it("true at >=95% when not finished", () => {
    expect(shouldFinish(0.96, "reading")).toBe(true);
  });
  it("false below 95%", () => {
    expect(shouldFinish(0.9, "reading")).toBe(false);
  });
  it("false when already finished", () => {
    expect(shouldFinish(1, "finished")).toBe(false);
  });
});
