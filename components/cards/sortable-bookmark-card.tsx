"use client";

import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookmarkCard } from "./bookmark-card";
import type { Bookmark } from "@/types";

interface Props {
  bookmark: Bookmark;
  isSelected: boolean;
  isFocused: boolean;
  onToggle: (modifier: "single" | "range") => void;
}

export function SortableBookmarkCard(props: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `bookmark:${props.bookmark.id}:sortable` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // dnd-kit's `transition` covers only `transform`. Extend it with scale +
    // opacity so the compress + dim flip animates instead of snapping when
    // drag starts. ease-out 150ms matches `ease.out` / `duration.base` tokens.
    transition: transition
      ? `${transition}, scale 150ms ease-out, opacity 150ms ease-out`
      : "scale 150ms ease-out, opacity 150ms ease-out",
    opacity: isDragging ? 0.5 : 1,
    // Compress the in-place original per PROJECT_SPEC §Motion ("dragged
    // cards compress slightly"). DragOverlay clone carries the same scale
    // at the cursor.
    scale: isDragging ? 0.97 : undefined,
    // touch-action: pan-y lets the page scroll vertically when a touch lands on
    // a card; the TouchSensor's 250ms long-press delay still starts a drag.
    // (Was "none", which blocked all scrolling on mobile — every touch hits a
    // card.) Revises ADR-006 §Consequences for the mobile scroll fix.
    touchAction: "pan-y",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BookmarkCard {...props} />
    </div>
  );
}
