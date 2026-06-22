import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("extension manifest", () => {
  it("is a valid MV3 manifest with a popup + background worker", () => {
    const raw = readFileSync(resolve(__dirname, "../../manifest.json"), "utf8");
    const m = JSON.parse(raw);
    expect(m.manifest_version).toBe(3);
    expect(m.action.default_popup).toBe("popup.html");
    expect(m.background.service_worker).toBeTruthy();
    expect(Array.isArray(m.permissions)).toBe(true);
    expect(m.permissions).toContain("activeTab");
  });
});
