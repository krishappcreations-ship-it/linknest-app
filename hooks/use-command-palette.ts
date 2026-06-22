"use client";

import { useEffect } from "react";
import { useStore } from "@/store";
import {
  openCommandPalette,
  closeCommandPalette,
} from "@/store/slices/ui-slice";

/**
 * Reads commandPaletteOpen from the store + registers a global Cmd/Ctrl+K
 * listener that toggles it. Single instance per app — mount once at the
 * dashboard layout level via the <CommandPalette> component.
 */
export function useCommandPalette(): {
  open: boolean;
  setOpen: (next: boolean) => void;
} {
  const open = useStore((s) => s.ui.commandPaletteOpen);

  const setOpen = (next: boolean) => {
    useStore.setState((s) => ({
      ui: next ? openCommandPalette(s.ui) : closeCommandPalette(s.ui),
    }));
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "k") return;
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      useStore.setState((s) => ({
        ui: s.ui.commandPaletteOpen
          ? closeCommandPalette(s.ui)
          : openCommandPalette(s.ui),
      }));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}
