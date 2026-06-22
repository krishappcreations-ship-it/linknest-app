import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  resolveInitialTheme,
  applyTheme,
  THEME_KEY,
  THEME_META_COLOR,
} from "@/lib/theme";

function mockMatchMedia(prefersLight: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({
      matches: q.includes("light") ? prefersLight : !prefersLight,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

describe("resolveInitialTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("saved choice wins over OS preference", () => {
    localStorage.setItem(THEME_KEY, "light");
    mockMatchMedia(false); // OS prefers dark
    expect(resolveInitialTheme()).toBe("light");
  });

  it("falls back to OS light when no saved choice", () => {
    mockMatchMedia(true);
    expect(resolveInitialTheme()).toBe("light");
  });

  it("falls back to OS dark when no saved choice", () => {
    mockMatchMedia(false);
    expect(resolveInitialTheme()).toBe("dark");
  });

  it("ignores a junk localStorage value and uses OS", () => {
    localStorage.setItem(THEME_KEY, "banana");
    mockMatchMedia(true);
    expect(resolveInitialTheme()).toBe("light");
  });
});

describe("applyTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.remove());
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  });

  it("light sets data-theme, localStorage, and meta colour", () => {
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content")
    ).toBe(THEME_META_COLOR.light);
  });

  it("dark removes data-theme and writes localStorage + meta", () => {
    document.documentElement.dataset.theme = "light";
    applyTheme("dark");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute("content")
    ).toBe(THEME_META_COLOR.dark);
  });
});
