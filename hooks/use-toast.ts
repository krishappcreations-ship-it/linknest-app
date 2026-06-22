"use client";

/**
 * useToasts — subscribes to the live toast queue and auto-dismisses past
 * expiry. Mounted ONCE inside <ToastRegion>. The 250ms tick keeps the
 * disappear animation perceived as intentional rather than abrupt.
 */

import { useEffect } from "react";
import { useStore } from "@/store";
import { dismissToast, type Toast } from "@/store/slices/ui-slice";

export function useToasts(): Toast[] {
  const toasts = useStore((s) => s.ui.toasts);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const expired = useStore
        .getState()
        .ui.toasts.filter((t) => t.expiresAt <= now);
      if (expired.length === 0) return;
      useStore.setState((s) => ({
        ui: expired.reduce((acc, t) => dismissToast(acc, t.id), s.ui),
      }));
    };
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, []);

  return toasts;
}
