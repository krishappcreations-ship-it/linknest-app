"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBookmarks } from "@/hooks/use-bookmarks";
import type { Bookmark, ReadState } from "@/types";

export function computeRatio(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const scrollable = scrollHeight - clientHeight;
  if (scrollable <= 0) return 1;
  return Math.max(0, Math.min(1, scrollTop / scrollable));
}

export function shouldFinish(ratio: number, readState: ReadState): boolean {
  return ratio >= 0.95 && readState !== "finished";
}

const PERSIST_THROTTLE_MS = 1000;

/**
 * Restores scroll to the bookmark's saved progress, persists progress
 * (throttled) as the user scrolls, and auto-marks the bookmark finished once
 * at ≥95%. Returns the live ratio for the progress bar.
 */
export function useReadingProgress(
  containerRef: React.RefObject<HTMLElement | null>,
  bookmark: Bookmark
): number {
  const { setReadProgress, setReadState } = useBookmarks();
  const [progress, setProgress] = useState(bookmark.readProgress);
  const restoringRef = useRef(true);
  const lastPersistRef = useRef(0);
  const finishedRef = useRef(false);

  // Restore scroll after layout (once).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = bookmark.readProgress * (el.scrollHeight - el.clientHeight);
    el.scrollTop = target;
    // Release the restore guard on the next frame so the programmatic scroll
    // doesn't get persisted back.
    const raf = requestAnimationFrame(() => {
      restoringRef.current = false;
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onScroll() {
      if (restoringRef.current || !el) return;
      const ratio = computeRatio(
        el.scrollTop,
        el.scrollHeight,
        el.clientHeight
      );
      setProgress(ratio);
      const nowMs = Date.now();
      if (nowMs - lastPersistRef.current >= PERSIST_THROTTLE_MS) {
        lastPersistRef.current = nowMs;
        void setReadProgress(bookmark.id, ratio);
      }
      if (!finishedRef.current && shouldFinish(ratio, bookmark.readState)) {
        finishedRef.current = true;
        void setReadState(bookmark.id, "finished");
      }
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmark.id]);

  return progress;
}
