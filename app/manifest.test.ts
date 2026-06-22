import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PWA manifest", () => {
  it("is valid JSON with the required installability fields", () => {
    const raw = readFileSync(
      resolve(process.cwd(), "public/manifest.webmanifest"),
      "utf8"
    );
    const m = JSON.parse(raw);
    expect(m.name).toBe("LinkNest");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThanOrEqual(1);
    expect(
      m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")
    ).toBe(true);
  });
});
