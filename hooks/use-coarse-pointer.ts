"use client";

import { useEffect, useState } from "react";

/**
 * True on coarse-pointer (touch) devices. SSR-safe: defaults to false on the
 * server and first client render, then syncs from matchMedia. Used to drop
 * hover-only motion/affordances on touch (cheaper per-card work + reachable
 * actions). Mirrors the CSS `(pointer: coarse)` checks already used in the
 * folder/tag rows.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return coarse;
}
