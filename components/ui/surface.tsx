import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Surface — flat container, no elevation, no hover state.
 *
 * Use for: panel backgrounds, sidebar wells, content frames.
 * Pair with Card when you need elevation or interactivity.
 */
type SurfaceProps = HTMLAttributes<HTMLDivElement>;

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(
  function Surface({ className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn("bg-surface border-border rounded-lg border", className)}
        {...rest}
      />
    );
  }
);
