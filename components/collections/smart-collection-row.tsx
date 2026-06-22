"use client";

import { useSmartCollections } from "@/hooks/use-smart-collections";
import { openSmartCollectionDialog } from "@/store/slices/ui-slice";
import { useStore } from "@/store";
import type { SmartCollection } from "@/types";

export function SmartCollectionRow({
  collection,
}: {
  collection: SmartCollection;
}) {
  const { activeId, select, count } = useSmartCollections();
  const isActive = activeId === collection.id;
  const n = count(collection.id);

  return (
    <div
      data-active={isActive || undefined}
      className="group data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover text-foreground-muted flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors"
    >
      <button
        type="button"
        onClick={() => select(isActive ? null : collection.id)}
        className="flex-1 truncate text-left"
      >
        {collection.name}
      </button>
      <button
        type="button"
        aria-label={`Edit ${collection.name}`}
        onClick={() =>
          useStore.setState((s) => ({
            ui: openSmartCollectionDialog(s.ui, collection.id),
          }))
        }
        className="text-foreground-subtle hover:text-foreground hidden size-5 items-center justify-center rounded group-hover:flex"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-3.5"
          aria-hidden
        >
          <path
            d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <span className="text-foreground-subtle text-xs tabular-nums group-hover:hidden">
        {n}
      </span>
    </div>
  );
}
