import { describe, it, expect } from "vitest";
import { shouldGenerateSnapshot } from "@/hooks/use-bookmark-snapshot";

const bk = (over: Partial<{ previewImageUrl: string | null }> = {}) =>
  ({ id: "bk_1", previewImageUrl: null, ...over }) as never;

describe("shouldGenerateSnapshot", () => {
  it("true when no og:image and no snapshot yet", () => {
    expect(shouldGenerateSnapshot(bk(), false)).toBe(true);
  });
  it("false when og:image present", () => {
    expect(
      shouldGenerateSnapshot(bk({ previewImageUrl: "https://x/i.png" }), false)
    ).toBe(false);
  });
  it("false when a snapshot already exists", () => {
    expect(shouldGenerateSnapshot(bk(), true)).toBe(false);
  });
});
