"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@radix-ui/react-icons";
import { usePreferences } from "@/hooks/use-preferences";
import { applyTheme, type Theme } from "@/lib/theme";

/**
 * Light/dark toggle. Display follows the *actually applied* theme by observing
 * the `data-theme` attribute on <html> — so it's correct regardless of whether
 * the store is hydrated (landing page) and reflects reconcile / cross-device
 * sync changes too, with no race. Clicking applies immediately (no flash) and
 * persists via usePreferences (Dexie + sync). Sun in dark (click → light),
 * moon in light. Radix icon, never an emoji.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { setTheme } = usePreferences();
  const [theme, setLocal] = useState<Theme>("dark");

  useEffect(() => {
    const read = () =>
      setLocal(
        document.documentElement.dataset.theme === "light" ? "light" : "dark"
      );
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next); // observer updates local state
        void setTheme(next); // persist (Dexie + sync)
      }}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={`text-foreground-muted hover:text-foreground hover:bg-surface-hover flex size-8 items-center justify-center rounded-md transition-colors duration-100 ease-out active:scale-[0.97] ${className}`}
    >
      {theme === "dark" ? (
        <SunIcon className="size-4" />
      ) : (
        <MoonIcon className="size-4" />
      )}
    </button>
  );
}
