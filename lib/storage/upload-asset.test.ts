import { describe, it, expect } from "vitest";
import { classifyAsset, MAX_ASSET_BYTES } from "@/lib/storage/upload-asset";

describe("classifyAsset", () => {
  it("maps image + pdf mime types to kind + ext", () => {
    expect(classifyAsset({ type: "image/png", size: 10 })).toEqual({
      ok: true,
      kind: "image",
      ext: "png",
    });
    expect(classifyAsset({ type: "image/jpeg", size: 10 })).toEqual({
      ok: true,
      kind: "image",
      ext: "jpg",
    });
    expect(classifyAsset({ type: "application/pdf", size: 10 })).toEqual({
      ok: true,
      kind: "pdf",
      ext: "pdf",
    });
  });

  it("rejects unsupported types", () => {
    expect(classifyAsset({ type: "text/plain", size: 10 })).toEqual({
      ok: false,
      error: "unsupported",
    });
    expect(classifyAsset({ type: "video/mp4", size: 10 })).toEqual({
      ok: false,
      error: "unsupported",
    });
  });

  it("rejects files over the size cap", () => {
    expect(
      classifyAsset({ type: "image/png", size: MAX_ASSET_BYTES + 1 })
    ).toEqual({ ok: false, error: "too_large" });
  });
});
