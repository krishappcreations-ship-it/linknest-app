import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/preview/fetch-preview", () => ({
  fetchPreview: vi.fn(async (url: string) => {
    if (url === "https://ok.test/") {
      return {
        ok: true,
        title: "OK",
        description: null,
        ogImage: null,
        favicon: null,
        fetchedAt: 1700000000000,
      };
    }
    return { ok: false, kind: "network", retriable: true };
  }),
}));

import { POST } from "@/app/api/preview/route";
import { fetchPreview } from "@/lib/preview/fetch-preview";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/preview", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  (fetchPreview as unknown as { mockClear: () => void }).mockClear();
});

describe("POST /api/preview", () => {
  it("delegates valid body to fetchPreview", async () => {
    const res = await POST(makeReq({ url: "https://ok.test/" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(fetchPreview).toHaveBeenCalledWith("https://ok.test/");
  });
  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(makeReq("not json") as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      kind: "http_error",
      retriable: false,
    });
  });
  it("returns 400 for missing url field", async () => {
    const res = await POST(makeReq({ notUrl: "x" }) as never);
    expect(res.status).toBe(400);
  });
  it("returns 400 for url > 2048 chars", async () => {
    const big = "https://example.com/" + "a".repeat(2050);
    const res = await POST(makeReq({ url: big }) as never);
    expect(res.status).toBe(400);
  });
});
