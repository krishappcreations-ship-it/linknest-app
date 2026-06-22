"use client";

import { motion, useReducedMotion } from "framer-motion";
import { keyframes } from "@/app/styles/motion";

/**
 * Shimmer skeleton matching the BookmarkCard footprint so the swap to a
 * real card on previewStatus transitions feels seamless.
 *
 * Only the thumb area animates (backgroundPosition — GPU-friendly).
 * Body uses static muted-tone bars at fixed widths.
 */
export function BookmarkSkeleton() {
  const reduce = useReducedMotion();
  return (
    <article
      aria-label="Loading bookmark preview"
      className="border-border bg-surface flex flex-col overflow-hidden rounded-lg border"
    >
      <motion.div
        className="aspect-video bg-[length:200%_100%]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-sheen) 50%, var(--skeleton-base) 100%)",
        }}
        animate={reduce ? undefined : keyframes.shimmer}
        transition={
          reduce
            ? undefined
            : { duration: 1.4, repeat: Infinity, ease: "linear" }
        }
      />
      <div className="flex flex-col gap-2 p-3">
        <div className="bg-surface-elevated h-2.5 w-3/4 rounded" />
        <div className="bg-surface-elevated h-2.5 w-1/2 rounded" />
      </div>
    </article>
  );
}
