"use client";

import { motion, useReducedMotion } from "framer-motion";
import { spring, duration, ease } from "@/app/styles/motion";
import { useStore } from "@/store";
import { dismissToast, type Toast } from "@/store/slices/ui-slice";
import { useBookmarks } from "@/hooks/use-bookmarks";

interface Props {
  toast: Toast;
}

const TONE_DOT: Record<Toast["tone"], string> = {
  info: "bg-accent-cyan",
  success: "bg-tag-emerald",
  warn: "bg-tag-amber",
  error: "bg-tag-rose",
};

/**
 * Single toast row. spring.snappy enter, duration.fast + ease.out exit
 * (driven by parent AnimatePresence). Layout prop enables smooth stack
 * reorder when a toast above this one dismisses.
 *
 * Action button (when present) invokes restore for intent=undo or
 * focusBookmark for intent=view, then dismisses self.
 */
export function ToastItem({ toast }: Props) {
  const { restore, focusBookmark } = useBookmarks();
  const reduce = useReducedMotion();

  const dismiss = () =>
    useStore.setState((s) => ({ ui: dismissToast(s.ui, toast.id) }));

  async function handleAction() {
    if (!toast.action) return;
    if (toast.action.intent === "undo") {
      await restore(toast.action.payload);
    } else if (toast.action.intent === "view") {
      focusBookmark(toast.action.payload);
    }
    dismiss();
  }

  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        reduce
          ? { opacity: 0 }
          : {
              opacity: 0,
              y: 8,
              transition: { duration: duration.fast, ease: ease.out },
            }
      }
      transition={reduce ? undefined : spring.snappy}
      role="status"
      className="border-border-strong bg-surface-elevated flex max-w-[360px] items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-sm shadow-lg shadow-black/40"
    >
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${TONE_DOT[toast.tone]}`}
      />
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate">{toast.title}</div>
        {toast.description && (
          <div className="text-foreground-subtle truncate text-[11px]">
            {toast.description}
          </div>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => void handleAction()}
          className="text-accent-cyan hover:text-foreground ml-auto cursor-pointer text-sm font-medium transition-[transform,color] duration-100 active:translate-y-px"
        >
          {toast.action.label}
        </button>
      )}
    </motion.div>
  );
}
