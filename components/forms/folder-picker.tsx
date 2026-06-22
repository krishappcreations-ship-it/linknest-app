"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useFolders } from "@/hooks/use-folders";
import { FOLDER_MAX_DEPTH, type FolderId } from "@/types";

interface Props {
  value: FolderId | null;
  onChange: (id: FolderId | null) => void;
}

export function FolderPicker({ value, onChange }: Props) {
  const { rows, byId, ancestors } = useFolders();
  const [open, setOpen] = useState(false);

  const label =
    value === null
      ? "Root"
      : ancestors(value)
          .map((a) => a.name)
          .join(" / ") ||
        (byId(value)?.name ?? "Root");

  const pickerRows = rows.filter((r) => r.depth < FOLDER_MAX_DEPTH);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="border-border-strong bg-background text-foreground hover:bg-surface-hover focus:border-accent-blue flex h-9 w-full items-center justify-between rounded-md border px-2.5 text-sm transition-colors outline-none"
        >
          <span className="truncate">{label}</span>
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="size-3 opacity-60"
            fill="currentColor"
          >
            <path d="M2 4l4 4 4-4z" />
          </svg>
        </button>
      </Popover.Trigger>
      {/*
        No Popover.Portal: the picker is opened from inside a Radix Dialog, whose
        RemoveScroll only permits scrolling within the dialog's DOM subtree. A
        portaled popover lands on <body> (outside that subtree) and its touch
        scroll is blocked. Rendering inline keeps it inside the dialog so the
        folder list scrolls. touch-action: pan-y restores momentum scroll.
      */}
      <Popover.Content
        align="start"
        sideOffset={4}
        className="border-border bg-surface z-50 max-h-72 w-64 overflow-y-auto overscroll-contain rounded-md border p-1 shadow-lg"
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
        onWheel={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
          data-active={value === null || undefined}
          className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover text-foreground-muted flex w-full items-center rounded-md px-2 py-1 text-left text-sm transition-colors"
        >
          Root
        </button>
        {pickerRows.map((row) => (
          <button
            key={row.folder.id}
            type="button"
            onClick={() => {
              onChange(row.folder.id);
              setOpen(false);
            }}
            data-active={value === row.folder.id || undefined}
            className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover text-foreground-muted flex w-full items-center rounded-md py-1 text-left text-sm transition-colors"
            style={{
              paddingLeft: `${8 + row.depth * 14}px`,
              paddingRight: "8px",
            }}
          >
            <span className="truncate">{row.folder.name}</span>
          </button>
        ))}
      </Popover.Content>
    </Popover.Root>
  );
}
