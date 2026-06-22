"use client";

import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import { setReadStateFilter } from "@/store/slices/ui-slice";
import { useStore } from "@/store";
import type { ReadState } from "@/types";

interface Props {
  state: ReadState;
  label: string;
}

export function ReadingFilterRow({ state, label }: Props) {
  const active = useStore((s) => s.ui.readStateFilter === state);
  const count = useStore(
    (s) =>
      selectVisibleBookmarks(s.bookmarks).filter(
        (b) => b.readState === state && b.kind !== "prompt"
      ).length
  );
  return (
    <button
      type="button"
      onClick={() =>
        useStore.setState((s) => ({
          ui: setReadStateFilter(s.ui, active ? null : state),
        }))
      }
      data-active={active || undefined}
      className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover text-foreground-muted flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors"
    >
      <span className="flex-1">{label}</span>
      <span className="text-foreground-subtle text-xs tabular-nums">
        {count}
      </span>
    </button>
  );
}
