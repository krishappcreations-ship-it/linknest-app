"use client";

import { useSmartCollections } from "@/hooks/use-smart-collections";
import { openSmartCollectionDialog } from "@/store/slices/ui-slice";
import { useStore } from "@/store";
import { SmartCollectionRow } from "./smart-collection-row";

export function SmartCollectionsSection() {
  const { collections } = useSmartCollections();

  return (
    <div className="mt-4">
      <div className="text-foreground-subtle px-3 pt-2 pb-2 text-[11px] font-semibold tracking-wider uppercase">
        Smart Collections
      </div>
      {collections.map((c) => (
        <SmartCollectionRow key={c.id} collection={c} />
      ))}
      <button
        type="button"
        onClick={() =>
          useStore.setState((s) => ({
            ui: openSmartCollectionDialog(s.ui, null),
          }))
        }
        className="text-foreground-subtle hover:text-foreground hover:bg-surface-hover flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors"
      >
        <span aria-hidden className="text-base leading-none">
          +
        </span>
        New smart collection
      </button>
    </div>
  );
}
