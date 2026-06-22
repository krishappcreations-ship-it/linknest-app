import { describe, it, expect, vi } from "vitest";
import { postLinkCheck } from "@/hooks/use-link-check";

describe("postLinkCheck", () => {
  it("posts to /api/link-check and returns the result", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "broken", httpStatus: 404 }),
    });
    const r = await postLinkCheck(
      "https://e.com",
      fetchImpl as unknown as typeof fetch
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/link-check",
      expect.objectContaining({ method: "POST" })
    );
    expect(r.status).toBe("broken");
  });

  it("returns unknown when the request rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("net"));
    const r = await postLinkCheck(
      "https://e.com",
      fetchImpl as unknown as typeof fetch
    );
    expect(r.status).toBe("unknown");
  });

  it("returns unknown on a non-ok response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    const r = await postLinkCheck(
      "https://e.com",
      fetchImpl as unknown as typeof fetch
    );
    expect(r.status).toBe("unknown");
  });
});
