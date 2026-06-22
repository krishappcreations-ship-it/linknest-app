"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/store";
import { openEditDialog } from "@/store/slices/ui-slice";
import { useBookmarks } from "@/hooks/use-bookmarks";
import type { Bookmark } from "@/types";

interface Props {
  bookmark: Bookmark;
}

/**
 * Single kebab trigger that opens a 4-item
 * DropdownMenu: Open / Copy URL / Edit / Delete (destructive).
 */
export function BookmarkActions({ bookmark }: Props) {
  const { remove, refreshPreview, recaptureArticle, setReadState } =
    useBookmarks();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Bookmark actions"
          onClick={(e) => e.stopPropagation()}
          className="border-border-strong bg-surface-elevated text-foreground hover:bg-surface-hover inline-flex size-6 items-center justify-center rounded-md border transition-[transform,background-color] duration-100 active:translate-y-px"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="size-3.5"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      {/*
        onClick stopPropagation here catches React-synthetic-event bubble from
        menu items back up to the card — Radix portals the menu OUT of the DOM
        but React's synthetic event system still bubbles through the React tree,
        which means a menu item click would fire BookmarkCard's onClick (which
        opens the URL in a new tab). Stop the bubble at the menu content boundary.
      */}
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {bookmark.kind === "prompt" ? (
          <>
            <DropdownMenuItem
              onSelect={() =>
                void navigator.clipboard.writeText(bookmark.promptBody ?? "")
              }
            >
              Copy prompt
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                useStore.setState((s) => ({
                  ui: openEditDialog(s.ui, bookmark.id),
                }))
              }
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void remove(bookmark.id)}
              className="text-tag-rose data-[highlighted]:bg-tag-rose/10 data-[highlighted]:text-tag-rose"
            >
              Delete
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem
              onSelect={() =>
                window.open(bookmark.url, "_blank", "noopener,noreferrer")
              }
            >
              Open in new tab
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard.writeText(bookmark.url);
              }}
            >
              Copy URL
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void refreshPreview(bookmark.id)}>
              Refresh preview
            </DropdownMenuItem>
            {bookmark.captureStatus === "ready" && (
              <DropdownMenuItem asChild>
                <Link href={`/read/${bookmark.id}`}>Read article</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => void recaptureArticle(bookmark.id)}
            >
              {bookmark.captureStatus === "ready"
                ? "Re-capture article"
                : "Capture article"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {(
              [
                ["inbox", "Move to Inbox"],
                ["reading", "Move to Reading"],
                ["finished", "Mark finished"],
                ["archived", "Archive"],
              ] as const
            )
              .filter(([state]) => state !== bookmark.readState)
              .map(([state, label]) => (
                <DropdownMenuItem
                  key={state}
                  onSelect={() => void setReadState(bookmark.id, state)}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                useStore.setState((s) => ({
                  ui: openEditDialog(s.ui, bookmark.id),
                }))
              }
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void remove(bookmark.id)}
              className="text-tag-rose data-[highlighted]:bg-tag-rose/10 data-[highlighted]:text-tag-rose"
            >
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
