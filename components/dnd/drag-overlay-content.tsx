"use client";

import { useDndContext } from "@dnd-kit/core";
import { useStore } from "@/store";
import { selectBookmarkById } from "@/store/slices/bookmarks-slice";
import { BookmarkCard } from "@/components/cards/bookmark-card";
import { FolderRow } from "@/components/folders/folder-row";
import type { BookmarkId, FolderId } from "@/types";

/**
 * Renders inside <DragOverlay>. Reads activeId from context and renders a
 * compressed clone of the dragged item — scale(0.97) + shadow-2xl per
 * PROJECT_SPEC §Motion ("dragged cards compress slightly").
 */
export function DragOverlayContent() {
  const { active } = useDndContext();
  const bookmarks = useStore((s) => s.bookmarks);
  const folders = useStore((s) => s.folders);

  if (active === null || typeof active.id !== "string") return null;
  const [kind, id] = active.id.split(":");

  const baseClass = "scale-[0.97] shadow-2xl rounded-lg";

  if (kind === "bookmark") {
    const b = selectBookmarkById(bookmarks, id as BookmarkId);
    if (!b) return null;
    const selection = useStore.getState().ui.selection;
    const isBatch = selection.size >= 2 && selection.has(id as BookmarkId);
    const overflow = isBatch ? selection.size - 1 : 0;
    return (
      <div className={`relative ${baseClass}`}>
        <BookmarkCard
          bookmark={b}
          isSelected={false}
          isFocused={false}
          onToggle={() => {}}
        />
        {overflow > 0 && (
          <span
            aria-hidden
            className="bg-accent-blue text-foreground absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums shadow-md"
          >
            +{overflow}
          </span>
        )}
      </div>
    );
  }

  if (kind === "folder") {
    const f = folders.byId[id as FolderId];
    if (!f) return null;
    return (
      <div className={baseClass}>
        <FolderRow
          row={{
            folder: f,
            depth: 0,
            hasChildren: false,
            collapsed: false,
          }}
        />
      </div>
    );
  }

  return null;
}
