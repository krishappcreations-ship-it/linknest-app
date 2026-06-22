import { describe, it, expect, vi, afterEach } from "vitest";
import { summarize } from "@/lib/ai/summarize-client";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("summarize client", () => {
  it("returns ok result on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: true, tldr: "T", keyPoints: ["a"] }))
    );
    const r = await summarize({ text: "body" });
    expect(r).toEqual({ ok: true, tldr: "T", keyPoints: ["a"] });
  });

  it("maps 401 to unauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ok: false, error: "unauthorized" }, 401))
    );
    const r = await summarize({ text: "body" });
    expect(r).toEqual({ ok: false, error: "unauthorized" });
  });

  it("maps a thrown fetch to network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const r = await summarize({ text: "body" });
    expect(r).toEqual({ ok: false, error: "network" });
  });
});
