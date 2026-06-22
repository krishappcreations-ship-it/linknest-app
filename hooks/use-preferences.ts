"use client";

import { useEffect } from "react";
import { useStore } from "@/store";
import { getSyncOpts } from "@/lib/sync/sync-runtime";
import {
  applySetLayout,
  applySetTheme,
  applySetReaderPref,
} from "@/store/slices/preferences-slice";
import type { LayoutMode, Preferences } from "@/types";

const KEY_TO_LAYOUT: Record<string, LayoutMode> = {
  "1": "masonry",
  "2": "list",
  "3": "gallery",
};

export function usePreferences(): {
  layout: LayoutMode;
  setLayout: (mode: LayoutMode) => Promise<void>;
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => Promise<void>;
  readerFontSize: Preferences["readerFontSize"];
  readerFontFamily: Preferences["readerFontFamily"];
  readerWidth: Preferences["readerWidth"];
  setReaderFontSize: (v: Preferences["readerFontSize"]) => Promise<void>;
  setReaderFontFamily: (v: Preferences["readerFontFamily"]) => Promise<void>;
  setReaderWidth: (v: Preferences["readerWidth"]) => Promise<void>;
} {
  const layout = useStore((s) => s.preferences.prefs.layout);
  const theme = useStore((s) => s.preferences.prefs.theme);
  const readerFontSize = useStore((s) => s.preferences.prefs.readerFontSize);
  const readerFontFamily = useStore(
    (s) => s.preferences.prefs.readerFontFamily
  );
  const readerWidth = useStore((s) => s.preferences.prefs.readerWidth);

  const setLayout = async (mode: LayoutMode) => {
    const state = useStore.getState();
    const r = await applySetLayout(state.preferences, mode, {
      adapter: state.preferencesAdapter,
      ...getSyncOpts(),
    });
    useStore.setState({ preferences: r.state });
  };

  const setTheme = async (next: "dark" | "light") => {
    const state = useStore.getState();
    const r = await applySetTheme(state.preferences, next, {
      adapter: state.preferencesAdapter,
      ...getSyncOpts(),
    });
    useStore.setState({ preferences: r.state });
  };

  const setReaderPref = async <
    K extends "readerFontSize" | "readerFontFamily" | "readerWidth",
  >(
    key: K,
    value: Preferences[K]
  ) => {
    const state = useStore.getState();
    const r = await applySetReaderPref(state.preferences, key, value, {
      adapter: state.preferencesAdapter,
      ...getSyncOpts(),
    });
    useStore.setState({ preferences: r.state });
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.metaKey && !e.ctrlKey) return;
      const mode = KEY_TO_LAYOUT[e.key];
      if (!mode) return;
      e.preventDefault();
      void setLayout(mode);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    layout,
    setLayout,
    theme,
    setTheme,
    readerFontSize,
    readerFontFamily,
    readerWidth,
    setReaderFontSize: (v) => setReaderPref("readerFontSize", v),
    setReaderFontFamily: (v) => setReaderPref("readerFontFamily", v),
    setReaderWidth: (v) => setReaderPref("readerWidth", v),
  };
}
