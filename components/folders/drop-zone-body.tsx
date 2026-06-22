"use client";

import { useDroppable, useDndContext } from "@dnd-kit/core";
import { useStore } from "@/store";
import { FOLDER_MAX_DEPTH, type FolderId } from "@/types";
import type { FoldersState } from "@/store/slices/folders-slice";

interface Props {
  folderId: FolderId;
}

/**
 * Absolutely-positioned droppable overlay inside the folder row.
 * Accepts drops:
 *   - bookmark:<id>:sortable → move bookmark into this folder
 *   - folder:<id>:sortable    → nest folder under this folder
 *
 * Disabled when:
 *   - active is the same folder (self)
 *   - active is an ancestor of this folder (cycle)
 *   - target is at depth ≥ FOLDER_MAX_DEPTH - 1 AND active is a folder
 *
 * Returns null when no drag is in progress so the overlay never blocks
 * pointer events during normal sidebar use.
 */
export function DropZoneBody({ folderId }: Props) {
  const { active } = useDndContext();
  const folders = useStore((s) => s.folders);

  const activeKind = (() => {
    if (typeof active?.id !== "string") return null;
    const [kind] = active.id.split(":");
    return kind === "bookmark" || kind === "folder" ? kind : null;
  })();
  const activeFolderId =
    activeKind === "folder" && typeof active?.id === "string"
      ? (active.id.split(":")[1] as FolderId)
      : null;

  const disabled = (() => {
    if (activeKind === "folder") {
      if (activeFolderId === folderId) return true;
      const targetDepth = depthOf(folders, folderId);
      if (targetDepth >= FOLDER_MAX_DEPTH - 1) return true;
      if (activeFolderId && isAncestorOf(folders, activeFolderId, folderId))
        return true;
    }
    return false;
  })();

  const { isOver, setNodeRef } = useDroppable({
    id: `folder:${folderId}:body`,
    disabled,
  });

  if (active === null) return null;

  return (
    <div
      ref={setNodeRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 rounded-md transition-[background-color,box-shadow,transform] duration-150 ease-out ${
        isOver && !disabled
          ? "bg-accent-blue/10 ring-accent-blue/40 scale-[1.02] ring-2"
          : ""
      }`}
    />
  );
}

function depthOf(state: FoldersState, id: FolderId): number {
  let depth = 0;
  let cur = state.byId[id];
  while (cur && cur.parentId !== null) {
    depth++;
    cur = state.byId[cur.parentId];
    if (depth > FOLDER_MAX_DEPTH + 1) break;
  }
  return depth;
}

function isAncestorOf(
  state: FoldersState,
  ancestor: FolderId,
  target: FolderId
): boolean {
  let cur = state.byId[target];
  while (cur && cur.parentId !== null) {
    if (cur.parentId === ancestor) return true;
    cur = state.byId[cur.parentId];
  }
  return false;
}
