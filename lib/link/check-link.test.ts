import { describe, it, expect } from "vitest";
import { classifyHealth } from "@/lib/link/check-link";

describe("classifyHealth", () => {
  it("ok for 2xx, no redirect", () => {
    expect(classifyHealth(200, false, "https://e.com").status).toBe("ok");
  });
  it("redirected for 2xx + meaningful redirect", () => {
    const r = classifyHealth(200, true, "https://new.com");
    expect(r.status).toBe("redirected");
    expect(r.redirectUrl).toBe("https://new.com");
  });
  it("broken for 404 / 410 / generic 4xx", () => {
    expect(classifyHealth(404, false, "x").status).toBe("broken");
    expect(classifyHealth(410, false, "x").status).toBe("broken");
    expect(classifyHealth(400, false, "x").status).toBe("broken");
  });
  it("ok (not false-dead) for restricted 401/403/405/429", () => {
    for (const s of [401, 403, 405, 429])
      expect(classifyHealth(s, false, "x").status).toBe("ok");
  });
  it("unknown for 5xx", () => {
    expect(classifyHealth(503, false, "x").status).toBe("unknown");
  });
});
