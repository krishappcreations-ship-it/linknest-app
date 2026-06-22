import type { Preferences } from "@/types";
import type { LinkNestDb, PreferenceRow } from "./schema";

const DEFAULT_PREFS: Preferences = {
  layout: "masonry",
  pinnedFolderIds: [],
  theme: "dark",
  readerFontSize: "m",
  readerFontFamily: "serif",
  readerWidth: "normal",
};

export interface PreferencesAdapter {
  get(): Promise<Preferences>;
  set(prefs: Preferences): Promise<void>;
}

export function dexiePreferencesAdapter(db: LinkNestDb): PreferencesAdapter {
  return {
    async get() {
      const rows = await db.preferences.toArray();
      const out: Preferences = { ...DEFAULT_PREFS };
      for (const r of rows) {
        (out as Record<string, Preferences[keyof Preferences]>)[r.key] =
          r.value;
      }
      return out;
    },
    async set(prefs) {
      const rows: PreferenceRow[] = (
        Object.entries(prefs) as Array<[string, Preferences[keyof Preferences]]>
      ).map(([key, value]) => ({ key, value }));
      await db.preferences.bulkPut(rows);
    },
  };
}

export function memoryPreferencesAdapter(): PreferencesAdapter {
  let prefs: Preferences = { ...DEFAULT_PREFS };
  return {
    async get() {
      return { ...prefs };
    },
    async set(next) {
      prefs = { ...next };
    },
  };
}
