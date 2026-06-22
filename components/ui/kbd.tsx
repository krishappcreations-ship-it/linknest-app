import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Kbd — keyboard shortcut hint.
 *
 * Use inline to indicate a hotkey, e.g. `<Kbd>⌘</Kbd><Kbd>K</Kbd>` for
 * command palette. Mono font, subtle border, tight kerning.
 */
type KbdProps = HTMLAttributes<HTMLElement>;

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd(
  { className, children, ...rest },
  ref
) {
  return (
    <kbd
      ref={ref}
      className={cn(
        "border-border bg-surface-elevated text-foreground-muted font-mono",
        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md",
        "border px-1 text-[0.6875rem] leading-none",
        className
      )}
      {...rest}
    >
      {children}
    </kbd>
  );
});
