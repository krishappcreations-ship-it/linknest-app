"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "@/app/styles/motion";
import { useStore } from "@/store";
import { useHighlightActions } from "@/hooks/use-highlight-actions";
import { HIGHLIGHT_COLORS, asHighlightId, type HighlightColor } from "@/types";
import type { ToolbarPosition } from "./highlight-toolbar";

const SWATCH: Record<HighlightColor, string> = {
  yellow: "bg-[rgba(250,204,21,0.7)]",
  green: "bg-[rgba(74,222,128,0.7)]",
  blue: "bg-[rgba(96,165,250,0.7)]",
  pink: "bg-[rgba(244,114,182,0.7)]",
};

export function HighlightPopover({
  highlightId,
  position,
  onClose,
}: {
  highlightId: string | null;
  position: ToolbarPosition | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { update, remove } = useHighlightActions();
  const highlight = useStore((s) =>
    highlightId ? s.highlights.byId[highlightId] : undefined
  );
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft(highlight?.annotation ?? "");
  }, [highlight?.id, highlight?.annotation]);

  if (!highlightId || !position || !highlight) return null;
  const id = asHighlightId(highlightId);

  return (
    <motion.div
      role="dialog"
      aria-label="Edit highlight"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: duration.fast, ease: ease.out }}
      style={{ top: position.top, left: position.left }}
      className="border-border bg-surface-elevated fixed z-50 w-64 -translate-x-1/2 -translate-y-full space-y-2 rounded-lg border p-2.5 shadow-lg"
    >
      <div className="flex items-center gap-1.5">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            data-active={highlight.color === color || undefined}
            onClick={() => void update(id, { color })}
            className={`data-[active=true]:ring-foreground size-5 rounded-full ring-1 ring-black/10 transition-transform duration-100 ease-out hover:scale-110 active:scale-95 data-[active=true]:ring-2 ${SWATCH[color]}`}
          />
        ))}
        <button
          type="button"
          aria-label="Delete highlight"
          onClick={() => {
            void remove(id);
            onClose();
          }}
          className="text-foreground-subtle hover:text-foreground ml-auto flex size-7 items-center justify-center rounded-md transition-colors active:scale-95"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M3 4h10M6.5 4V3h3v1M5 4l.5 9h5l.5-9"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void update(id, { annotation: draft.trim() || null })}
        placeholder="Add a note…"
        rows={3}
        className="border-border bg-surface text-foreground placeholder:text-foreground-subtle focus:border-border-strong w-full resize-none rounded-md border px-2 py-1.5 text-sm outline-none"
      />
    </motion.div>
  );
}
