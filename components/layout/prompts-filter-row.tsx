"use client";

import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import { setKindFilter } from "@/store/slices/ui-slice";
import { useStore } from "@/store";

/** Sidebar entry for the Prompts section. Mirrors ReadingFilterRow. */
export function PromptsFilterRow() {
  const active = useStore((s) => s.ui.selectedKindFilter === "prompt");
  const count = useStore(
    (s) =>
      selectVisibleBookmarks(s.bookmarks).filter((b) => b.kind === "prompt")
        .length
  );
  return (
    <button
      type="button"
      onClick={() =>
        useStore.setState((s) => ({
          ui: setKindFilter(s.ui, active ? null : "prompt"),
        }))
      }
      data-active={active || undefined}
      className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover text-foreground-muted flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors"
    >
      <span className="flex-1">Prompts</span>
      <span className="text-foreground-subtle text-xs tabular-nums">
        {count}
      </span>
    </button>
  );
}
