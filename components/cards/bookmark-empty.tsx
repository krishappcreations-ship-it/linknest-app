"use client";

import { motion, useReducedMotion } from "framer-motion";
import { duration, ease, keyframes } from "@/app/styles/motion";
import { useStore } from "@/store";
import { openAddDialog } from "@/store/slices/ui-slice";

/**
 * Empty state — feature 01.
 *
 * One-shot fade-in on mount + the ONE perpetual loop in feature 01:
 * a 4s vertical drift on the bookmark icon (2px amplitude). Restraint
 * over spectacle. Reduced-motion-aware.
 */
export function BookmarkEmpty() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce ? undefined : { duration: duration.slow, ease: ease.out }
      }
      className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center"
    >
      <motion.div
        animate={reduce ? undefined : keyframes.iconFloat}
        transition={
          reduce
            ? undefined
            : { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }
        className="border-border bg-surface text-foreground-muted mb-5 flex size-14 items-center justify-center rounded-xl border"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-5"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
      </motion.div>
      <h2 className="text-foreground mb-2 text-xl font-semibold tracking-tight">
        Your nest is empty
      </h2>
      <p className="text-foreground-muted mb-6 max-w-sm text-sm">
        Save your first URL to start building a visual bookmark library. Paste a
        link above or press{" "}
        <kbd className="border-border bg-surface-elevated rounded border px-1.5 py-0.5 font-mono text-[11px]">
          N
        </kbd>
        .
      </p>
      <button
        type="button"
        onClick={() => useStore.setState((s) => ({ ui: openAddDialog(s.ui) }))}
        className="bg-foreground text-background hover:bg-foreground-muted inline-flex h-8 items-center gap-1.5 rounded-md px-4 text-sm font-medium transition-[transform,background-color] duration-100 active:translate-y-px"
      >
        Add your first bookmark
      </button>
    </motion.div>
  );
}
