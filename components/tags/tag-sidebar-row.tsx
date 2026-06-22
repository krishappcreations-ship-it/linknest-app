"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTags } from "@/hooks/use-tags";
import type { Tag } from "@/types";

interface Props {
  tag: Tag & { count: number };
}

const COLOR_DOT_CLASS: Record<string, string> = {
  cyan: "bg-tag-cyan",
  blue: "bg-tag-blue",
  orange: "bg-tag-orange",
  emerald: "bg-tag-emerald",
  violet: "bg-tag-violet",
  rose: "bg-tag-rose",
  amber: "bg-tag-amber",
  zinc: "bg-tag-zinc",
};

export function TagSidebarRow({ tag }: Props) {
  const { selectedTagId, setFilter, rename, remove } = useTags();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tag.name);
  const isActive = selectedTagId === tag.id;

  async function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== tag.name) {
      await rename(tag.id, draft.trim());
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setFilter(selectedTagId === tag.id ? null : tag.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFilter(selectedTagId === tag.id ? null : tag.id);
        }
      }}
      data-active={isActive || undefined}
      className="group data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground hover:bg-surface-hover active:bg-surface-elevated/70 text-foreground-muted flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1 text-left text-sm transition-colors duration-150 ease-out"
    >
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${COLOR_DOT_CLASS[tag.color] ?? "bg-tag-zinc"}`}
      />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
              setDraft(tag.name);
            }
          }}
          onBlur={() => void commit()}
          onClick={(e) => e.stopPropagation()}
          maxLength={32}
          className="border-accent-blue bg-background text-foreground flex-1 rounded-sm border px-1.5 py-0.5 text-sm outline-none"
        />
      ) : (
        <span className="flex-1 truncate">{tag.name}</span>
      )}
      {!editing && (
        <>
          <span className="text-foreground-subtle text-xs tabular-nums">
            {tag.count}
          </span>
          <span
            className="opacity-0 transition-opacity duration-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Tag actions"
                  className="border-border-strong bg-surface-elevated text-foreground hover:bg-surface-hover inline-flex size-5 items-center justify-center rounded-md border"
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setDraft(tag.name);
                    setEditing(true);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => void remove(tag.id)}
                  className="text-tag-rose data-[highlighted]:bg-tag-rose/10 data-[highlighted]:text-tag-rose"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </>
      )}
    </div>
  );
}
