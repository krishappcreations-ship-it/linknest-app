import type { Preferences, LayoutMode } from "@/types";
import type { PreferencesAdapter } from "@/lib/db/preferences-adapter";

export interface PreferencesState {
  prefs: Preferences;
}

export const initialPreferencesState: PreferencesState = {
  prefs: {
    layout: "masonry",
    pinnedFolderIds: [],
    theme: "dark",
    readerFontSize: "m",
    readerFontFamily: "serif",
    readerWidth: "normal",
  },
};

export type Inverse = (state: PreferencesState) => PreferencesState;

export function setLayout(
  state: PreferencesState,
  mode: LayoutMode
): { next: PreferencesState; inverse: Inverse } {
  if (state.prefs.layout === mode) {
    return { next: state, inverse: (s) => s };
  }
  const prev = state.prefs.layout;
  const next: PreferencesState = {
    prefs: { ...state.prefs, layout: mode },
  };
  const inverse: Inverse = (s) => ({
    prefs: { ...s.prefs, layout: prev },
  });
  return { next, inverse };
}

export interface ApplyOptions {
  adapter: PreferencesAdapter;
  sync?: import("@/lib/sync/types").SyncAdapter;
  userId?: string;
  onSyncError?: (err: unknown) => void;
}

export async function applySetLayout(
  state: PreferencesState,
  mode: LayoutMode,
  opts: ApplyOptions
): Promise<{ state: PreferencesState; rolledBack: boolean; error?: unknown }> {
  const { next, inverse } = setLayout(state, mode);
  if (next === state) return { state, rolledBack: false };
  try {
    await opts.adapter.set(next.prefs);
    if (opts.sync && opts.userId) {
      opts.sync.putPreferences(opts.userId, next.prefs).catch((err) => {
        opts.onSyncError?.(err);
      });
    }
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

export function setTheme(
  state: PreferencesState,
  theme: "dark" | "light"
): { next: PreferencesState; inverse: Inverse } {
  if (state.prefs.theme === theme) return { next: state, inverse: (s) => s };
  const prev = state.prefs.theme;
  return {
    next: { prefs: { ...state.prefs, theme } },
    inverse: (s) => ({ prefs: { ...s.prefs, theme: prev } }),
  };
}

export async function applySetTheme(
  state: PreferencesState,
  theme: "dark" | "light",
  opts: ApplyOptions
): Promise<{ state: PreferencesState; rolledBack: boolean; error?: unknown }> {
  const { next, inverse } = setTheme(state, theme);
  if (next === state) return { state, rolledBack: false };
  try {
    await opts.adapter.set(next.prefs);
    if (opts.sync && opts.userId) {
      opts.sync
        .putPreferences(opts.userId, next.prefs)
        .catch((e) => opts.onSyncError?.(e));
    }
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

type ReaderPrefKey = "readerFontSize" | "readerFontFamily" | "readerWidth";

export function setReaderPref<K extends ReaderPrefKey>(
  state: PreferencesState,
  key: K,
  value: Preferences[K]
): { next: PreferencesState; inverse: Inverse } {
  if (state.prefs[key] === value) return { next: state, inverse: (s) => s };
  const prev = state.prefs[key];
  return {
    next: { prefs: { ...state.prefs, [key]: value } },
    inverse: (s) => ({ prefs: { ...s.prefs, [key]: prev } }),
  };
}

export async function applySetReaderPref<K extends ReaderPrefKey>(
  state: PreferencesState,
  key: K,
  value: Preferences[K],
  opts: ApplyOptions
): Promise<{ state: PreferencesState; rolledBack: boolean; error?: unknown }> {
  const { next, inverse } = setReaderPref(state, key, value);
  if (next === state) return { state, rolledBack: false };
  try {
    await opts.adapter.set(next.prefs);
    if (opts.sync && opts.userId) {
      opts.sync
        .putPreferences(opts.userId, next.prefs)
        .catch((e) => opts.onSyncError?.(e));
    }
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

/**
 * Sync-driven inbound upsert. Replaces prefs wholesale.
 */
export function upsertFromSync(
  _state: PreferencesState,
  p: Preferences
): PreferencesState {
  return { prefs: p };
}
