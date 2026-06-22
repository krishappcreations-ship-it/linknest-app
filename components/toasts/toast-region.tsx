"use client";

import { AnimatePresence } from "framer-motion";
import { useToasts } from "@/hooks/use-toast";
import { ToastItem } from "./toast-item";

/**
 * Fixed bottom-right toast stack. aria-live="polite" so screen readers
 * announce non-intrusively. Container is pointer-events:none so toasts
 * don't block UI clicks behind them; each toast restores pointer-events.
 */
export function ToastRegion() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
