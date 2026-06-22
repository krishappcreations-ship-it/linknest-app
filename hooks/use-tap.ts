"use client";

import { useRef } from "react";
import type React from "react";

/**
 * Tap-vs-scroll guard. On touch, a scroll that starts on an element still fires a
 * click at the end of the gesture — which would open/select a card mid-scroll.
 * This records the pointer-down position, marks the gesture as "moved" once it
 * passes a small threshold, and swallows the click when it moved.
 *
 * Spread the returned handlers on the clickable element. Modifier/keyboard paths
 * are unaffected — `onTap` receives the original click event.
 */
const MOVE_THRESHOLD = 10; // px

export function useTap(onTap: (e: React.MouseEvent) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY };
      moved.current = false;
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (!s) return;
      if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > MOVE_THRESHOLD) {
        moved.current = true;
      }
    },
    onClick: (e: React.MouseEvent) => {
      if (moved.current) {
        moved.current = false;
        return;
      }
      onTap(e);
    },
  };
}
