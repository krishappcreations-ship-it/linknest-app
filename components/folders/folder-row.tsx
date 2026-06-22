"use client";

import { motion } from "framer-motion";
import { useFolders } from "@/hooks/use-folders";
import { FolderActions } from "./folder-actions";
import { FolderRowEditor } from "./folder-row-editor";
import { DropZoneBody } from "./drop-zone-body";
import type { FolderRow as FolderRowData } from "@/store/slices/folders-slice";

interface Props {
  row: FolderRowData;
  variant?: "sidebar" | "picker";
  onPick?: () => void;
}

export function FolderRow({ row, variant = "sidebar", onPick }: Props) {
  const {
    selectedFilter,
    editing,
    toggleCollapse,
    setFilter,
    subtreeBookmarkCount,
  } = useFolders();
  const folder = row.folder;
  const isActive =
    selectedFilter.kind === "subtree" && selectedFilter.id === folder.id;
  const isEditing = editing.id === folder.id && editing.mode === "rename";
  const count = subtreeBookmarkCount(folder.id);

  return (
    <motion.div
      layout="position"
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="group relative"
    >
      {variant === "sidebar" && <DropZoneBody folderId={folder.id} />}
      <div
        role="button"
        tabIndex={0}
        onClick={
          variant === "picker"
            ? onPick
            : () => setFilter({ kind: "subtree", id: folder.id })
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (variant === "picker") onPick?.();
            else setFilter({ kind: "subtree", id: folder.id });
          }
        }}
        data-active={isActive || undefined}
        className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover active:bg-surface-elevated/70 text-foreground-muted flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm transition-colors duration-150 ease-out"
        style={{ paddingLeft: `${8 + row.depth * 14}px` }}
      >
        {row.hasChildren ? (
          <span
            role="button"
            aria-label={row.collapsed ? "Expand" : "Collapse"}
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(folder.id);
            }}
            className="text-foreground-subtle hover:text-foreground inline-flex size-4 items-center justify-center"
          >
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              className={`size-2.5 transition-transform duration-100 ${
                row.collapsed ? "" : "rotate-90"
              }`}
              fill="currentColor"
            >
              <path d="M4 2l4 4-4 4z" />
            </svg>
          </span>
        ) : (
          <span aria-hidden className="inline-block size-4" />
        )}

        {folder.pinned && (
          <span
            aria-label="Pinned"
            className="text-accent-blue inline-flex size-3 items-center justify-center"
          >
            <svg aria-hidden viewBox="0 0 12 12" fill="currentColor">
              <path d="M6 1l1.5 3.5L11 5.5 8.5 8 9 11l-3-1.5L3 11l.5-3L1 5.5l3.5-1L6 1z" />
            </svg>
          </span>
        )}

        {isEditing ? (
          <FolderRowEditor mode="rename" initialName={folder.name} />
        ) : (
          <span className="flex-1 truncate">{folder.name}</span>
        )}

        {!isEditing && count > 0 && (
          <span className="text-foreground-subtle text-xs tabular-nums">
            {count}
          </span>
        )}

        {variant === "sidebar" && !isEditing && (
          <span className="opacity-0 transition-opacity duration-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
            <FolderActions folder={folder} depth={row.depth} />
          </span>
        )}
      </div>
    </motion.div>
  );
}
