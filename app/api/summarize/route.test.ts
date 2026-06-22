/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { authUserMock, createMessageMock } = vi.hoisted(() => ({
  authUserMock: vi.fn(),
  createMessageMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: authUserMock() } }),
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMessageMock };
  },
}));

import { POST } from "@/app/api/summarize/route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  authUserMock.mockReset();
  createMessageMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/summarize", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/summarize", () => {
  it("401 when unauthenticated", async () => {
    authUserMock.mockReturnValue(null);
    const res = await POST(makeReq({ text: "x" }) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("400 for bad body", async () => {
    authUserMock.mockReturnValue({ id: "u1" });
    const res = await POST(makeReq({ notText: 1 }) as never);
    expect(res.status).toBe(400);
  });

  it("returns tldr + keyPoints on success", async () => {
    authUserMock.mockReturnValue({ id: "u1" });
    createMessageMock.mockResolvedValue({
      content: [{ type: "text", text: '{"tldr":"T","keyPoints":["a","b"]}' }],
    });
    const res = await POST(makeReq({ text: "a long article body" }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, tldr: "T", keyPoints: ["a", "b"] });
  });

  it("502 ai_error on non-JSON model output", async () => {
    authUserMock.mockReturnValue({ id: "u1" });
    createMessageMock.mockResolvedValue({
      content: [{ type: "text", text: "sorry, no json here" }],
    });
    const res = await POST(makeReq({ text: "body" }) as never);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("ai_error");
  });
});
