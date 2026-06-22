"use client";

import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderRow } from "./folder-row";
import type { FolderRow as FolderRowData } from "@/store/slices/folders-slice";

interface Props {
  row: FolderRowData;
  count?: number;
}

export function SortableFolderRow({ row, count }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `folder:${row.folder.id}:sortable` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    // dnd-kit's `transition` covers only `transform`. Extend it with scale +
    // opacity so the compress + dim flip animates instead of snapping when
    // drag starts. ease-out 150ms matches `ease.out` / `duration.base` tokens.
    transition: transition
      ? `${transition}, scale 150ms ease-out, opacity 150ms ease-out`
      : "scale 150ms ease-out, opacity 150ms ease-out",
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? 0.97 : undefined,
    // pan-y so the drawer's folder list scrolls smoothly on touch; long-press
    // (TouchSensor delay) still starts a drag.
    touchAction: "pan-y",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FolderRow row={row} count={count} />
    </div>
  );
}
