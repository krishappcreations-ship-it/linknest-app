/**
 * Theme application + first-paint resolution.
 *
 * The Zustand preference (Dexie + Supabase sync) stays the cross-device source of
 * truth; this module mirrors the active theme into `localStorage` so a blocking
 * inline script can set `data-theme` before React paints (no flash) and the
 * anonymous landing page can persist a choice without the DB. See
 * components/theme/theme-applier.tsx and app/layout.tsx.
 */

export type Theme = "dark" | "light";

export const THEME_KEY = "linknest-theme";

/** Browser-chrome colour per theme (background hex). */
export const THEME_META_COLOR: Record<Theme, string> = {
  dark: "#09090b",
  light: "#fafafa",
};

/** First-paint theme: saved choice wins, else follow the OS, else dark. */
export function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* localStorage blocked — fall through to OS */
  }
  const prefersLight = window.matchMedia?.(
    "(prefers-color-scheme: light)"
  ).matches;
  return prefersLight ? "light" : "dark";
}

/** Apply a theme to the DOM + persist the localStorage mirror + meta colour. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* non-fatal */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_META_COLOR[theme]);
}
