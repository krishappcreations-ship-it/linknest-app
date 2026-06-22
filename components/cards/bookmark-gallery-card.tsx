"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { duration, ease, spring } from "@/app/styles/motion";
import { useStore } from "@/store";
import { openEditDialog } from "@/store/slices/ui-slice";
import { selectTagsByIds } from "@/store/slices/tags-slice";
import { FaviconFallback } from "./favicon-fallback";
import { BookmarkActions } from "./bookmark-actions";
import { TagChip } from "@/components/tags/tag-chip";
import { PreviewPlaceholder } from "./preview-placeholder";
import { useTap } from "@/hooks/use-tap";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
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
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export function BookmarkGalleryCard({
  bookmark,
  isSelected,
  isFocused,
  onToggle,
}: Props) {
  const reduce = useReducedMotion();
  const coarse = useCoarsePointer();
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [bookmark.previewImageUrl]);

  const allTags = useStore((s) => s.tags);
  const tagsForCard = useMemo(
    () => selectTagsByIds(allTags, bookmark.tagIds),
    [allTags, bookmark.tagIds]
  );
  const visibleChips = tagsForCard.slice(0, 3);
  const overflow = tagsForCard.length - visibleChips.length;

  const showImage =
    bookmark.previewStatus === "ready" &&
    bookmark.previewImageUrl !== null &&
    !imgFailed;

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
    <motion.article
      {...tap}
      onDoubleClick={() =>
        useStore.setState((s) => ({ ui: openEditDialog(s.ui, bookmark.id) }))
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={reduce || coarse ? undefined : { y: -2 }}
      transition={reduce ? undefined : spring.gentle}
      animate={
        isFocused
          ? { boxShadow: "0 0 0 2px var(--accent-blue)" }
          : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
      }
      data-selected={isSelected || undefined}
      className="group border-border bg-surface hover:border-border-strong data-[selected]:border-accent-blue relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-colors"
    >
      <div
        className="pointer-events-none absolute top-2 right-2 z-10 transition-opacity duration-100"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        <div className="pointer-events-auto">
          <BookmarkActions bookmark={bookmark} />
        </div>
      </div>

      {showImage ? (
        <motion.img
          src={bookmark.previewImageUrl ?? undefined}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="bg-surface-elevated aspect-[4/3] w-full object-cover"
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? false : { opacity: 1 }}
          transition={
            reduce ? undefined : { duration: duration.medium, ease: ease.out }
          }
        />
      ) : (
        <PreviewPlaceholder
          domain={bookmark.domain}
          faviconUrl={bookmark.faviconUrl}
          title={bookmark.title}
          className="aspect-[4/3]"
        />
      )}

      <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
        <div className="text-foreground-subtle flex items-center gap-1.5 text-xs">
          <FaviconFallback url={bookmark.faviconUrl} domain={bookmark.domain} />
          {bookmark.domain} · {relativeTime(bookmark.createdAt)}
        </div>
        <h3 className="text-foreground line-clamp-2 text-base leading-snug font-semibold tracking-tight">
          {bookmark.title}
        </h3>
        {tagsForCard.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1">
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
      </div>
    </motion.article>
  );
}
