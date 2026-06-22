"use client";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useFolders } from "@/hooks/use-folders";
import { FOLDER_MAX_DEPTH, type Folder } from "@/types";

interface Props {
  folder: Folder;
  depth: number;
}

export function FolderActions({ folder, depth }: Props) {
  const { beginCreate, beginRename, togglePin, remove } = useFolders();
  const canAddSubfolder = depth + 1 < FOLDER_MAX_DEPTH;
  const canPin = depth === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Folder actions"
          onClick={(e) => e.stopPropagation()}
          className="border-border-strong bg-surface-elevated text-foreground hover:bg-surface-hover inline-flex size-5 items-center justify-center rounded-md border transition-[transform,background-color] duration-100 active:translate-y-px"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="size-3"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {canAddSubfolder && (
          <DropdownMenuItem onSelect={() => beginCreate(folder.id)}>
            New subfolder
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => beginRename(folder.id)}>
          Rename
        </DropdownMenuItem>
        {canPin && (
          <DropdownMenuItem onSelect={() => void togglePin(folder.id)}>
            {folder.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void remove(folder.id)}
          className="text-tag-rose data-[highlighted]:bg-tag-rose/10 data-[highlighted]:text-tag-rose"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
