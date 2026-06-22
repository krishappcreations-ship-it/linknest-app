"use client";

import { useStore } from "@/store";
import { selectBrokenCount } from "@/store/slices/bookmarks-slice";
import { setLinkStatusFilter } from "@/store/slices/ui-slice";

export function BrokenLinksRow() {
  const active = useStore((s) => s.ui.linkStatusFilter === "broken");
  const count = useStore((s) => selectBrokenCount(s.bookmarks));
  if (count === 0 && !active) return null;
  return (
    <button
      type="button"
      onClick={() =>
        useStore.setState((s) => ({
          ui: setLinkStatusFilter(s.ui, active ? null : "broken"),
        }))
      }
      data-active={active || undefined}
      className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover text-foreground-muted flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors"
    >
      <span className="flex-1">Broken links</span>
      <span className="text-foreground-subtle text-xs tabular-nums">
        {count}
      </span>
    </button>
  );
}
