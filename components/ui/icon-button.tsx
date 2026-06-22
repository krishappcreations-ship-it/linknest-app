"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { spring, transform, pickTransition } from "@/app/styles/motion";

/**
 * IconButton — square button containing a single icon.
 *
 * Sizes:
 *   - "sm" 32px — sidebar actions, toolbar
 *   - "md" 40px — primary actions (Add Bookmark, layout switch)
 *
 * Always pass an `aria-label`. Press feedback uses transform.pressActive.
 */
type IconButtonProps = HTMLMotionProps<"button"> &
  Pick<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
    size?: "sm" | "md";
  };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { className, size = "md", type = "button", ...rest },
    ref
  ) {
    const reduce = useReducedMotion() ?? false;

    return (
      <motion.button
        ref={ref}
        type={type}
        whileTap={{ scale: reduce ? 1 : transform.pressActive }}
        transition={pickTransition(spring.snappy, reduce)}
        className={cn(
          "inline-flex items-center justify-center rounded-md",
          "text-foreground-muted hover:text-foreground hover:bg-surface-hover",
          "focus-visible:ring-accent-blue focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:pointer-events-none disabled:opacity-50",
          size === "sm" && "h-8 w-8",
          size === "md" && "h-10 w-10",
          className
        )}
        {...rest}
      />
    );
  }
);
