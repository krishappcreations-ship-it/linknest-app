"use client";

import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookmarkListRow } from "./bookmark-list-row";
import type { Bookmark } from "@/types";

interface Props {
  bookmark: Bookmark;
  isSelected: boolean;
  isFocused: boolean;
  onToggle: (modifier: "single" | "range") => void;
}

export function SortableBookmarkRow(props: Props) {
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
    transition: transition
      ? `${transition}, opacity 150ms ease-out`
      : "opacity 150ms ease-out",
    opacity: isDragging ? 0.5 : 1,
    // pan-y so the page scrolls on touch; long-press (TouchSensor delay) drags.
    touchAction: "pan-y",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BookmarkListRow {...props} />
    </div>
  );
}
