import { describe, it, expect, vi, beforeEach } from "vitest";
import { suggestTags } from "@/lib/ai/suggest-tags-client";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("suggestTags client (F17)", () => {
  it("returns suggestions on ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          suggestions: [{ name: "react", kind: "existing" }],
        }),
      }))
    );
    const r = await suggestTags({ url: "https://x/", existingTags: [] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.suggestions).toHaveLength(1);
  });

  it("returns network error on fetch throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const r = await suggestTags({ url: "https://x/", existingTags: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("network");
  });
});
