import { describe, expect, it } from "vitest";
import { memoryPreferencesAdapter } from "@/lib/db/preferences-adapter";

describe("memoryPreferencesAdapter", () => {
  it("returns default Preferences when nothing set", async () => {
    const a = memoryPreferencesAdapter();
    const p = await a.get();
    expect(p).toEqual({
      layout: "masonry",
      pinnedFolderIds: [],
      theme: "dark",
      readerFontSize: "m",
      readerFontFamily: "serif",
      readerWidth: "normal",
    });
  });

  it("set + get round-trip", async () => {
    const a = memoryPreferencesAdapter();
    await a.set({
      layout: "list",
      pinnedFolderIds: [],
      theme: "dark",
      readerFontSize: "m",
      readerFontFamily: "serif",
      readerWidth: "normal",
    });
    const p = await a.get();
    expect(p.layout).toBe("list");
  });

  it("partial set merges with existing", async () => {
    const a = memoryPreferencesAdapter();
    await a.set({
      layout: "gallery",
      pinnedFolderIds: [],
      theme: "dark",
      readerFontSize: "m",
      readerFontFamily: "serif",
      readerWidth: "normal",
    });
    await a.set({
      layout: "list",
      pinnedFolderIds: [],
      theme: "dark",
      readerFontSize: "m",
      readerFontFamily: "serif",
      readerWidth: "normal",
    });
    const p = await a.get();
    expect(p.layout).toBe("list");
  });
});
