import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/link/check-link", () => ({
  checkLink: vi.fn().mockResolvedValue({ status: "broken", httpStatus: 404 }),
}));

import { POST } from "@/app/api/link-check/route";

function req(body: unknown): Request {
  return new Request("http://localhost/api/link-check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/link-check", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns the check result for a valid url", async () => {
    const res = await POST(req({ url: "https://e.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "broken" });
  });
  it("400 on a bad body", async () => {
    const res = await POST(req({ nope: 1 }));
    expect(res.status).toBe(400);
  });
});
