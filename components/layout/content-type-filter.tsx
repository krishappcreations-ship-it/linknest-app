"use client";

import { useMemo } from "react";
import { useStore } from "@/store";
import {
  selectFilteredBookmarks,
  effectiveContentKind,
  type ContentKind,
} from "@/store/slices/bookmarks-slice";
import { setContentType } from "@/store/slices/ui-slice";

interface PillSpec {
  value: ContentKind | null;
  label: string;
}

const PILLS: PillSpec[] = [
  { value: null, label: "All" },
  { value: "link", label: "Links" },
  { value: "image", label: "Images" },
  { value: "pdf", label: "PDFs" },
];

/**
 * In-folder content-type filter (Links / Images / PDFs). A subordinate view
 * filter that narrows the active folder/All/tag/read-state view to one content
 * type. Hidden in the Prompts section and the special broken/similar/smart views.
 *
 * Counts are derived with useMemo over stable store slices — never returns a
 * fresh array/object from a useStore selector (that loops React 19 #185).
 */
export function ContentTypeFilter() {
  const selected = useStore((s) => s.ui.selectedContentType);
  const bookmarksState = useStore((s) => s.bookmarks);
  const foldersState = useStore((s) => s.folders);
  const filter = useStore((s) => s.ui.selectedFolderFilter);
  const tagFilter = useStore((s) => s.ui.selectedTagId);
  const readStateFilter = useStore((s) => s.ui.readStateFilter);
  // Visibility flags for the special views the filter does not apply to.
  const promptsActive = useStore((s) => s.ui.selectedKindFilter === "prompt");
  const linkStatusFilter = useStore((s) => s.ui.linkStatusFilter);
  const similarToBookmarkId = useStore((s) => s.ui.similarToBookmarkId);
  const activeSmartCollectionId = useStore((s) => s.ui.activeSmartCollectionId);

  const counts = useMemo(() => {
    const base = selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter,
      tagFilter,
      readStateFilter,
      contentType: null,
    });
    const c = { all: base.length, link: 0, image: 0, pdf: 0 };
    for (const b of base) c[effectiveContentKind(b)] += 1;
    return c;
  }, [bookmarksState, foldersState, filter, tagFilter, readStateFilter]);

  const special =
    promptsActive ||
    linkStatusFilter !== null ||
    similarToBookmarkId !== null ||
    activeSmartCollectionId !== null;
  if (special || counts.all === 0) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Content type"
      className="border-border bg-surface mb-4 inline-flex items-center gap-0.5 rounded-md border p-0.5"
    >
      {PILLS.map((pill) => {
        const isActive = selected === pill.value;
        const count = pill.value === null ? counts.all : counts[pill.value];
        return (
          <button
            key={pill.label}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() =>
              useStore.setState((s) => ({
                ui: setContentType(s.ui, pill.value),
              }))
            }
            className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-sm transition-colors duration-150 ease-out active:scale-[0.97] ${
              isActive
                ? "bg-foreground/10 text-foreground"
                : "text-foreground-subtle hover:text-foreground"
            }`}
          >
            {pill.label}
            <span className="text-foreground-subtle text-xs tabular-nums">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
