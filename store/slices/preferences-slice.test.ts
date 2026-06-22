import { describe, expect, it } from "vitest";
import {
  initialPreferencesState,
  setLayout,
  applySetLayout,
  setTheme,
  applySetTheme,
  applySetReaderPref,
  type PreferencesState,
} from "./preferences-slice";
import { memoryPreferencesAdapter } from "@/lib/db/preferences-adapter";

describe("setLayout reducer", () => {
  it("updates layout + returns inverse", () => {
    const { next, inverse } = setLayout(initialPreferencesState, "list");
    expect(next.prefs.layout).toBe("list");
    expect(inverse(next).prefs.layout).toBe("masonry");
  });

  it("no-ops if layout already matches", () => {
    const s0: PreferencesState = {
      prefs: {
        layout: "gallery",
        pinnedFolderIds: [],
        theme: "dark",
        readerFontSize: "m",
        readerFontFamily: "serif",
        readerWidth: "normal",
      },
    };
    const { next } = setLayout(s0, "gallery");
    expect(next).toBe(s0);
  });
});

describe("applySetLayout", () => {
  it("persists via adapter + returns next state", async () => {
    const adapter = memoryPreferencesAdapter();
    const r = await applySetLayout(initialPreferencesState, "list", {
      adapter,
    });
    expect(r.rolledBack).toBe(false);
    expect(r.state.prefs.layout).toBe("list");
    const stored = await adapter.get();
    expect(stored.layout).toBe("list");
  });

  it("rolls back on adapter throw", async () => {
    const throwing = {
      get: async () =>
        ({
          layout: "masonry",
          pinnedFolderIds: [],
          theme: "dark",
          readerFontSize: "m",
          readerFontFamily: "serif",
          readerWidth: "normal",
        }) as const,
      set: () => Promise.reject(new Error("boom")),
    };
    const r = await applySetLayout(initialPreferencesState, "list", {
      adapter: throwing as never,
    });
    expect(r.rolledBack).toBe(true);
    expect(r.state.prefs.layout).toBe("masonry");
  });
});

describe("setTheme + reader prefs (feature 24)", () => {
  it("setTheme flips theme + inverse restores", () => {
    const { next, inverse } = setTheme(initialPreferencesState, "light");
    expect(next.prefs.theme).toBe("light");
    expect(inverse(next).prefs.theme).toBe("dark");
  });
  it("setTheme no-ops when unchanged", () => {
    const { next } = setTheme(initialPreferencesState, "dark");
    expect(next).toBe(initialPreferencesState);
  });
  it("applySetTheme persists via adapter", async () => {
    const adapter = memoryPreferencesAdapter();
    const r = await applySetTheme(initialPreferencesState, "light", {
      adapter,
    });
    expect(r.rolledBack).toBe(false);
    expect(r.state.prefs.theme).toBe("light");
    expect((await adapter.get()).theme).toBe("light");
  });
  it("applySetReaderPref updates a typography field + persists", async () => {
    const adapter = memoryPreferencesAdapter();
    const r = await applySetReaderPref(
      initialPreferencesState,
      "readerFontSize",
      "l",
      { adapter }
    );
    expect(r.state.prefs.readerFontSize).toBe("l");
    expect((await adapter.get()).readerFontSize).toBe("l");
  });
});
