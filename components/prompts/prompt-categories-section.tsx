"use client";

import { useMemo } from "react";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import { setPromptCategory } from "@/store/slices/ui-slice";
import { useStore } from "@/store";

/**
 * Category list shown inside the Prompts section. Lists "All prompts" + the
 * distinct categories among prompts (with counts); click to filter. Only the
 * sidebar renders this when the Prompts filter is active.
 */
export function PromptCategoriesSection() {
  const selected = useStore((s) => s.ui.selectedPromptCategory);
  const bookmarksState = useStore((s) => s.bookmarks);
  const { total, categories } = useMemo(() => {
    const prompts = selectVisibleBookmarks(bookmarksState).filter(
      (b) => b.kind === "prompt"
    );
    const counts = new Map<string, number>();
    for (const p of prompts) {
      const c = p.promptCategory?.trim();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return {
      total: prompts.length,
      categories: Array.from(counts.entries()).sort((a, b) =>
        a[0].localeCompare(b[0])
      ),
    };
  }, [bookmarksState]);

  return (
    <div className="border-border mt-1 ml-3 flex flex-col gap-0.5 border-l pl-2">
      <CategoryRow
        label="All prompts"
        count={total}
        active={selected === null}
        onClick={() =>
          useStore.setState((s) => ({ ui: setPromptCategory(s.ui, null) }))
        }
      />
      {categories.map(([name, count]) => (
        <CategoryRow
          key={name}
          label={name}
          count={count}
          active={selected === name}
          onClick={() =>
            useStore.setState((s) => ({ ui: setPromptCategory(s.ui, name) }))
          }
        />
      ))}
      {categories.length === 0 && (
        <span className="text-foreground-subtle px-3 py-1 text-xs">
          No categories yet
        </span>
      )}
    </div>
  );
}

function CategoryRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active || undefined}
      className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover text-foreground-muted flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-[13px] transition-colors"
    >
      <span className="flex-1 truncate">{label}</span>
      <span className="text-foreground-subtle text-xs tabular-nums">
        {count}
      </span>
    </button>
  );
}
