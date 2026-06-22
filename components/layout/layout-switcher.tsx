"use client";

import { useDndContext } from "@dnd-kit/core";
import { usePreferences } from "@/hooks/use-preferences";
import type { LayoutMode } from "@/types";

interface PillSpec {
  mode: LayoutMode;
  label: string;
  icon: React.ReactNode;
}

const PILLS: PillSpec[] = [
  {
    mode: "masonry",
    label: "Masonry",
    icon: (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="size-3.5"
        aria-hidden
      >
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="4" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="7" width="6" height="8" rx="1" />
      </svg>
    ),
  },
  {
    mode: "list",
    label: "List",
    icon: (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="size-3.5"
        aria-hidden
      >
        <rect x="1" y="3" width="14" height="2" rx="1" />
        <rect x="1" y="7" width="14" height="2" rx="1" />
        <rect x="1" y="11" width="14" height="2" rx="1" />
      </svg>
    ),
  },
  {
    mode: "gallery",
    label: "Gallery",
    icon: (
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="size-3.5"
        aria-hidden
      >
        <rect x="1" y="1" width="9" height="9" rx="1" />
        <rect x="12" y="1" width="3" height="4" rx="1" />
        <rect x="12" y="7" width="3" height="3" rx="1" />
        <rect x="1" y="12" width="14" height="3" rx="1" />
      </svg>
    ),
  },
];

export function LayoutSwitcher() {
  const { layout, setLayout } = usePreferences();
  const { active } = useDndContext();
  const disabled = active !== null;

  return (
    <div
      role="radiogroup"
      aria-label="Layout"
      className="border-border bg-surface inline-flex items-center gap-0.5 rounded-md border p-0.5"
    >
      {PILLS.map((pill) => {
        const isActive = layout === pill.mode;
        return (
          <button
            key={pill.mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={pill.label}
            disabled={disabled}
            onClick={() => void setLayout(pill.mode)}
            className={`flex h-7 items-center justify-center rounded px-2 transition-colors duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
              isActive
                ? "bg-foreground/10 text-foreground"
                : "text-foreground-subtle hover:text-foreground"
            }`}
          >
            {pill.icon}
          </button>
        );
      })}
    </div>
  );
}
