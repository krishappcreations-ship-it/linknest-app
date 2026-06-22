"use client";

import { useFolders } from "@/hooks/use-folders";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import { useStore } from "@/store";

interface Props {
  kind: "all" | "unfiled";
  label: string;
}

export function FolderPseudoRow({ kind, label }: Props) {
  const { selectedFilter, setFilter } = useFolders();
  const isActive = selectedFilter.kind === kind;
  const count = useStore((s) => {
    const all = selectVisibleBookmarks(s.bookmarks).filter(
      (b) => b.readState !== "archived" && b.kind !== "prompt"
    );
    return kind === "all"
      ? all.length
      : all.filter((b) => b.folderId === null).length;
  });
  return (
    <button
      type="button"
      onClick={() => setFilter({ kind })}
      data-active={isActive || undefined}
      className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover text-foreground-muted flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors"
    >
      <span className="flex-1">{label}</span>
      <span className="text-foreground-subtle text-xs tabular-nums">
        {count}
      </span>
    </button>
  );
}
