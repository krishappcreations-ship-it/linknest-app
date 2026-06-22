import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/capture/fetch-article", () => ({
  fetchArticle: vi.fn(async (url: string) => {
    if (url === "https://ok.test/") {
      return {
        ok: true,
        title: "OK",
        byline: null,
        excerpt: null,
        siteName: null,
        publishedTime: null,
        html: "<p>x</p>",
        textContent: "x",
        readingMinutes: 1,
        heroImageUrl: null,
        fetchedAt: 1700000000000,
      };
    }
    return { ok: false, kind: "network", retriable: true };
  }),
}));

import { POST } from "@/app/api/capture/route";
import { fetchArticle } from "@/lib/capture/fetch-article";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/capture", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  (fetchArticle as unknown as { mockClear: () => void }).mockClear();
});

describe("POST /api/capture", () => {
  it("delegates valid body to fetchArticle", async () => {
    const res = await POST(makeReq({ url: "https://ok.test/" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(fetchArticle).toHaveBeenCalledWith("https://ok.test/");
  });
  it("returns 400 for invalid JSON body", async () => {
    const res = await POST(makeReq("not json") as never);
    expect(res.status).toBe(400);
  });
  it("returns 400 for missing url field", async () => {
    const res = await POST(makeReq({ notUrl: "x" }) as never);
    expect(res.status).toBe(400);
  });
});
