"use client";

import { motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "@/app/styles/motion";
import { HIGHLIGHT_COLORS, type HighlightColor } from "@/types";

const SWATCH: Record<HighlightColor, string> = {
  yellow: "bg-[rgba(250,204,21,0.7)]",
  green: "bg-[rgba(74,222,128,0.7)]",
  blue: "bg-[rgba(96,165,250,0.7)]",
  pink: "bg-[rgba(244,114,182,0.7)]",
};

export interface ToolbarPosition {
  top: number;
  left: number;
}

export function HighlightToolbar({
  position,
  onPick,
}: {
  position: ToolbarPosition | null;
  onPick: (color: HighlightColor) => void;
}) {
  const reduce = useReducedMotion();
  if (!position) return null;

  return (
    <motion.div
      role="toolbar"
      aria-label="Highlight color"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: duration.fast, ease: ease.out }}
      style={{ top: position.top, left: position.left }}
      className="border-border bg-surface-elevated fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-1.5 rounded-full border px-2 py-1.5 shadow-lg"
      // Keep the active text selection alive while clicking a swatch.
      onMouseDown={(e) => e.preventDefault()}
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          onClick={() => onPick(color)}
          className={`size-5 rounded-full ring-1 ring-black/10 transition-transform duration-100 ease-out hover:scale-110 active:scale-95 ${SWATCH[color]}`}
        />
      ))}
    </motion.div>
  );
}
