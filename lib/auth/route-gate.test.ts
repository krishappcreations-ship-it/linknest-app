import { describe, expect, it } from "vitest";
import { decideGate } from "@/lib/auth/route-gate";

describe("decideGate", () => {
  it("rewrites anonymous / to the landing page", () => {
    expect(decideGate(false, "/")).toEqual({
      action: "rewrite",
      to: "/welcome",
    });
  });

  it("lets an authenticated user through to the app at /", () => {
    expect(decideGate(true, "/")).toEqual({ action: "next" });
  });

  it("serves the landing page to anonymous /welcome visitors", () => {
    expect(decideGate(false, "/welcome")).toEqual({ action: "next" });
  });

  it("redirects authenticated users off /welcome into the app", () => {
    expect(decideGate(true, "/welcome")).toEqual({
      action: "redirect",
      to: "/",
    });
  });

  it("passes through any other path untouched", () => {
    expect(decideGate(false, "/read/abc")).toEqual({ action: "next" });
    expect(decideGate(true, "/read/abc")).toEqual({ action: "next" });
  });
});
