"use client";

import { useStore } from "@/store";
import { openCommandPalette } from "@/store/slices/ui-slice";
import { LayoutSwitcher } from "./layout-switcher";
import { AddMenu } from "./add-menu";

export function Topbar() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 md:px-6">
      <button
        type="button"
        onClick={() =>
          useStore.setState((s) => ({ ui: openCommandPalette(s.ui) }))
        }
        className="border-border bg-surface text-foreground-subtle hover:text-foreground hover:border-border-strong flex max-w-[460px] flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors duration-150 ease-out active:scale-[0.99]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="size-3.5"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Search bookmarks
        <kbd className="border-border bg-surface-elevated ml-auto rounded border px-1.5 py-px font-mono text-[11px]">
          ⌘K
        </kbd>
      </button>
      <span className="hidden md:block">
        <LayoutSwitcher />
      </span>
      <AddMenu />
    </div>
  );
}
