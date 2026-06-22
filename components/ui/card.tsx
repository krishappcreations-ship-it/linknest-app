"use client";

import { type HTMLAttributes, forwardRef } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { spring, transform, pickTransition } from "@/app/styles/motion";

/**
 * Card — elevated, interactive surface.
 *
 * Hover lifts by 0.5% (per ADR-005 transform.liftHover). Press scales to
 * 0.97. Motion respects `prefers-reduced-motion`.
 *
 * Use for: bookmark cards, folder rows in the sidebar, list items that
 * want tactile feedback. Pair with `<motion.button>` semantics by passing
 * `as="button"`-style props through HTMLMotionProps.
 */
type CardProps = HTMLMotionProps<"div"> & {
  interactive?: boolean;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive = true, ...rest },
  ref
) {
  const reduce = useReducedMotion() ?? false;

  return (
    <motion.div
      ref={ref}
      whileHover={
        interactive ? { scale: reduce ? 1 : transform.liftHover } : undefined
      }
      whileTap={
        interactive ? { scale: reduce ? 1 : transform.pressActive } : undefined
      }
      transition={pickTransition(spring.gentle, reduce)}
      className={cn(
        "bg-surface ring-border rounded-lg p-4 ring-1",
        interactive &&
          "hover:ring-border-strong hover:shadow-lg hover:shadow-black/20",
        className
      )}
      {...rest}
    />
  );
});
