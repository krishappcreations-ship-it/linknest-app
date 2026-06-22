"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { applyTheme, resolveInitialTheme, THEME_KEY } from "@/lib/theme";
import { applySetTheme } from "@/store/slices/preferences-slice";
import { getSyncOpts } from "@/lib/sync/sync-runtime";
import type { Theme } from "@/lib/theme";

/**
 * Keeps the document theme in sync with the persisted preference.
 *
 * Before hydration the blocking inline script in app/layout.tsx owns the DOM
 * (no flash). After hydration we reconcile once:
 *   - first visit anywhere (no localStorage marker) → follow the OS and persist;
 *   - returning visitor → the store/Dexie value (cross-device synced) wins, and
 *     we correct the localStorage cache to match.
 * Thereafter any store change (including a realtime preference sync) re-applies.
 */
async function persist(next: Theme) {
  const state = useStore.getState();
  const r = await applySetTheme(state.preferences, next, {
    adapter: state.preferencesAdapter,
    ...getSyncOpts(),
  });
  useStore.setState({ preferences: r.state });
}

export function ThemeApplier() {
  const theme = useStore((s) => s.preferences.prefs.theme);
  const hydrated = useStore((s) => s.hydrated);
  const reconciled = useRef(false);

  useEffect(() => {
    if (!hydrated) return;

    if (!reconciled.current) {
      reconciled.current = true;
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch {
        /* blocked — treat as first visit */
      }
      if (stored !== "light" && stored !== "dark") {
        const os = resolveInitialTheme();
        if (os !== theme) {
          void persist(os); // store change re-runs this effect → applyTheme
          return;
        }
      }
    }

    applyTheme(theme);
  }, [theme, hydrated]);

  return null;
}
