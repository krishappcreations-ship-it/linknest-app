"use client";

import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
} from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils/cn";

/**
 * Tooltip — Radix-backed, instant on hover.
 *
 * Tooltips appear after a short open-delay (350ms) BUT once a group has
 * shown a tooltip in the last 1500ms, subsequent hovers skip the delay.
 * Implemented via `<TooltipPrimitive.Provider delayDuration>`
 * + `skipDelayDuration`.
 *
 * Usage:
 *   <TooltipProvider>
 *     <Tooltip>
 *       <TooltipTrigger asChild><IconButton …/></TooltipTrigger>
 *       <TooltipContent>Add bookmark</TooltipContent>
 *     </Tooltip>
 *   </TooltipProvider>
 */

export const TooltipProvider = ({
  children,
  delayDuration = 350,
  skipDelayDuration = 1500,
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider
    delayDuration={delayDuration}
    skipDelayDuration={skipDelayDuration}
  >
    {children}
  </TooltipPrimitive.Provider>
);

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...rest }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "bg-surface-elevated text-foreground border-border z-50",
          "rounded-md border px-2 py-1 text-xs leading-tight",
          "shadow-lg shadow-black/30",
          "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
          "data-[state=delayed-open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=delayed-open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          className
        )}
        {...rest}
      />
    </TooltipPrimitive.Portal>
  );
});
