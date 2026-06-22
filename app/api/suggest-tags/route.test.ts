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

import { POST } from "@/app/api/suggest-tags/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/suggest-tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/suggest-tags (F17)", () => {
  it("returns 401 when anon user", async () => {
    authUserMock.mockReturnValue(null);
    const res = await POST(
      makeRequest({ url: "https://x.com/", existingTags: [] })
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "unauthorized" });
  });

  it("returns 400 on invalid body", async () => {
    authUserMock.mockReturnValue({ id: "u1" });
    const res = await POST(makeRequest({ notAUrl: "garbage" }));
    expect(res.status).toBe(400);
  });

  it("returns 3 suggestions on happy path", async () => {
    authUserMock.mockReturnValue({ id: "u1" });
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            suggestions: [
              { name: "react", kind: "existing" },
              { name: "framework", kind: "new" },
              { name: "frontend", kind: "new" },
            ],
          }),
        },
      ],
    });
    const res = await POST(
      makeRequest({
        url: "https://react.dev/",
        title: "React",
        description: null,
        existingTags: ["react", "design"],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.suggestions).toHaveLength(3);
    expect(json.suggestions[0]).toEqual({ name: "react", kind: "existing" });
  });

  it("returns 502 when Claude SDK throws", async () => {
    authUserMock.mockReturnValue({ id: "u1" });
    createMessageMock.mockRejectedValue(new Error("API down"));
    const res = await POST(
      makeRequest({ url: "https://x.com/", existingTags: [] })
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: "ai_error" });
  });
});
