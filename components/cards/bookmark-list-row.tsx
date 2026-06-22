"use client";

import { useMemo } from "react";
import { useStore } from "@/store";
import { openEditDialog } from "@/store/slices/ui-slice";
import { selectTagsByIds } from "@/store/slices/tags-slice";
import { FaviconFallback } from "./favicon-fallback";
import { BookmarkActions } from "./bookmark-actions";
import { TagChip } from "@/components/tags/tag-chip";
import { useTap } from "@/hooks/use-tap";
import type { Bookmark } from "@/types";

interface Props {
  bookmark: Bookmark;
  isSelected: boolean;
  isFocused: boolean;
  onToggle: (modifier: "single" | "range") => void;
}

function relativeTime(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export function BookmarkListRow({
  bookmark,
  isSelected,
  isFocused,
  onToggle,
}: Props) {
  const allTags = useStore((s) => s.tags);
  const tagsForRow = useMemo(
    () => selectTagsByIds(allTags, bookmark.tagIds),
    [allTags, bookmark.tagIds]
  );
  const visibleChips = tagsForRow.slice(0, 3);
  const overflow = tagsForRow.length - visibleChips.length;

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      onToggle("single");
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      onToggle("range");
      return;
    }
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
  };
  const tap = useTap(handleClick);

  return (
    <div
      {...tap}
      onDoubleClick={() =>
        useStore.setState((s) => ({
          ui: openEditDialog(s.ui, bookmark.id),
        }))
      }
      data-selected={isSelected || undefined}
      data-focused={isFocused || undefined}
      className="border-border group hover:bg-surface-hover data-[selected]:bg-surface-elevated active:bg-surface-elevated/70 data-[focused]:ring-accent-blue/40 flex h-12 cursor-pointer items-center gap-3 border-b px-3 transition-colors duration-100 ease-out data-[focused]:ring-2"
    >
      <FaviconFallback url={bookmark.faviconUrl} domain={bookmark.domain} />
      <span className="text-foreground flex-1 truncate text-sm font-medium">
        {bookmark.title}
      </span>
      <span className="text-foreground-subtle hidden text-xs sm:inline">
        {bookmark.domain} · {relativeTime(bookmark.createdAt)}
      </span>
      {tagsForRow.length > 0 && (
        <div className="hidden items-center gap-1 md:flex">
          {visibleChips.map((t) => (
            <TagChip key={t.id} tag={t} size="sm" />
          ))}
          {overflow > 0 && (
            <span className="text-foreground-subtle text-[11px] tabular-nums">
              +{overflow}
            </span>
          )}
        </div>
      )}
      <BookmarkActions bookmark={bookmark} />
    </div>
  );
}
