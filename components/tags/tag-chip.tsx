"use client";

import type { Tag } from "@/types";

interface Props {
  tag: Tag;
  size?: "sm" | "md" | "lg";
  onRemove?: () => void;
  active?: boolean;
}

const COLOR_DOT_CLASS: Record<string, string> = {
  cyan: "bg-tag-cyan",
  blue: "bg-tag-blue",
  orange: "bg-tag-orange",
  emerald: "bg-tag-emerald",
  violet: "bg-tag-violet",
  rose: "bg-tag-rose",
  amber: "bg-tag-amber",
  zinc: "bg-tag-zinc",
};

const SIZE_CLASS = {
  sm: "h-5 gap-1 px-1.5 text-[11px]",
  md: "h-6 gap-1.5 px-2 text-xs",
  lg: "h-7 gap-1.5 px-2.5 text-sm",
} as const;

const DOT_CLASS = {
  sm: "size-1.5",
  md: "size-2",
  lg: "size-2",
} as const;

export function TagChip({ tag, size = "md", onRemove, active }: Props) {
  return (
    <span
      data-active={active || undefined}
      className={`border-border-strong bg-surface-elevated text-foreground-muted data-[active=true]:border-foreground-muted data-[active=true]:text-foreground inline-flex items-center rounded-full border ${SIZE_CLASS[size]}`}
    >
      <span
        aria-hidden
        className={`shrink-0 rounded-full ${DOT_CLASS[size]} ${COLOR_DOT_CLASS[tag.color] ?? "bg-tag-zinc"}`}
      />
      <span className="truncate">{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${tag.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-foreground-subtle hover:text-foreground ml-0.5 transition-transform duration-100 ease-out active:scale-[0.92]"
        >
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="size-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </span>
  );
}
