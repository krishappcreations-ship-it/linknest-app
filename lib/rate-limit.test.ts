import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, getClientIp } from "./rate-limit";

// Access the module-level Map via module reset between tests
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  // Clear internal state by resetting the module
  vi.resetModules();
});

// Re-import after resetModules so each describe block gets a fresh Map
async function freshRateLimit() {
  const { checkRateLimit: rl } = await import("./rate-limit");
  return rl;
}

describe("checkRateLimit", () => {
  it("allows requests under the limit", async () => {
    const rl = await freshRateLimit();
    const cfg = { windowMs: 60_000, max: 3 };

    expect(rl("ip:1.2.3.4", cfg)).toEqual({ ok: true });
    expect(rl("ip:1.2.3.4", cfg)).toEqual({ ok: true });
    expect(rl("ip:1.2.3.4", cfg)).toEqual({ ok: true });
  });

  it("blocks the (max + 1)-th request", async () => {
    const rl = await freshRateLimit();
    const cfg = { windowMs: 60_000, max: 2 };

    rl("ip:a", cfg);
    rl("ip:a", cfg);
    const result = rl("ip:a", cfg);
    expect(result.ok).toBe(false);
  });

  it("retryAfterMs is positive when blocked", async () => {
    const rl = await freshRateLimit();
    const cfg = { windowMs: 60_000, max: 1 };

    rl("ip:b", cfg);
    const result = rl("ip:b", cfg);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("allows requests again after window expires", async () => {
    const rl = await freshRateLimit();
    const cfg = { windowMs: 1_000, max: 1 };

    rl("ip:c", cfg);
    expect(rl("ip:c", cfg).ok).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(rl("ip:c", cfg)).toEqual({ ok: true });
  });

  it("tracks different keys independently", async () => {
    const rl = await freshRateLimit();
    const cfg = { windowMs: 60_000, max: 1 };

    rl("ip:x", cfg); // x at limit
    expect(rl("ip:x", cfg).ok).toBe(false);
    expect(rl("ip:y", cfg)).toEqual({ ok: true }); // y unaffected
  });
});

describe("getClientIp", () => {
  it("returns first IP from x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns unknown when header absent", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toBe("unknown");
  });
});
