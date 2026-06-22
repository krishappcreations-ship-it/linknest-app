"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { duration, ease, keyframes, spring } from "@/app/styles/motion";
import { FaviconFallback } from "./favicon-fallback";
import { BookmarkActions } from "./bookmark-actions";
import { useStore } from "@/store";
import {
  openEditDialog,
  setSimilarTo,
  pushToast,
} from "@/store/slices/ui-slice";
import { CopyIcon } from "@radix-ui/react-icons";
import { selectTagsByIds } from "@/store/slices/tags-slice";
import { findSimilar } from "@/lib/dedupe/similar";
import { useBookmarkSnapshot } from "@/hooks/use-bookmark-snapshot";
import { useAssetUrl } from "@/hooks/use-asset-url";
import { useTap } from "@/hooks/use-tap";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { getUseBookmarksApi } from "@/hooks/use-bookmarks";
import { TagChip } from "@/components/tags/tag-chip";
import { PreviewPlaceholder } from "./preview-placeholder";
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

function PdfPreviewGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      className="text-accent-orange size-10"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BookmarkCard({
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

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(i);
  }, []);
  void tick;

  const allTags = useStore((s) => s.tags);
  const tagsForCard = useMemo(
    () => selectTagsByIds(allTags, bookmark.tagIds),
    [allTags, bookmark.tagIds]
  );
  const visibleChips = tagsForCard.slice(0, 3);
  const overflow = tagsForCard.length - visibleChips.length;

  const embeddingById = useStore((s) => s.embeddingById);
  const similarCount = useMemo(
    () => findSimilar(bookmark.id, embeddingById).length,
    [bookmark.id, embeddingById]
  );

  const { dataUrl: snapshotUrl, setRef: setSnapshotRef } =
    useBookmarkSnapshot(bookmark);

  const isImage = bookmark.kind === "image";
  const isPdf = bookmark.kind === "pdf";
  const isPrompt = bookmark.kind === "prompt";
  const isAsset = isImage || isPdf;
  const assetUrl = useAssetUrl(isAsset ? (bookmark.assetPath ?? null) : null);

  const showShimmer = !isAsset && bookmark.previewStatus === "pending";
  const showImage =
    !isAsset &&
    bookmark.previewStatus === "ready" &&
    bookmark.previewImageUrl !== null &&
    !imgFailed;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(bookmark.promptBody ?? "");
      useStore.setState((s) => ({
        ui: pushToast(s.ui, { tone: "info", title: "Copied", ttlMs: 1500 }),
      }));
    } catch {
      /* clipboard blocked */
    }
  };

  // Single tap handler for both card kinds; the useTap guard below swallows the
  // click when the gesture was a scroll (touch), so cards don't open/select
  // mid-scroll on mobile.
  const handleTap = (e: React.MouseEvent) => {
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
    if (isPrompt) {
      void copyPrompt();
      return;
    }
    const href = isAsset ? assetUrl : bookmark.url;
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };
  const tap = useTap(handleTap);

  if (isPrompt) {
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
        className="group border-border bg-surface hover:border-border-strong data-[selected]:border-accent-blue relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-lg border p-3.5 transition-colors"
      >
        <div
          className="pointer-events-none absolute top-2 right-2 transition-opacity duration-100"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          <div className="pointer-events-auto">
            <BookmarkActions bookmark={bookmark} />
          </div>
        </div>

        <div className="text-foreground-subtle flex items-center gap-1.5 text-[11px]">
          <span className="border-border text-foreground-muted shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
            {bookmark.promptCategory || "Uncategorized"}
          </span>
          {relativeTime(bookmark.createdAt)}
        </div>

        <h3 className="text-foreground text-sm font-medium">
          {bookmark.title}
        </h3>
        <p className="text-foreground-muted line-clamp-5 text-xs whitespace-pre-wrap">
          {bookmark.promptBody}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1">
            {visibleChips.map((t) => (
              <TagChip key={t.id} tag={t} />
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void copyPrompt();
            }}
            className="border-border-strong text-foreground-muted hover:bg-surface-hover hover:text-foreground inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors duration-100 ease-out active:scale-[0.97]"
          >
            <CopyIcon className="size-3" />
            Copy
          </button>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      ref={setSnapshotRef}
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
        className="pointer-events-none absolute top-2 right-2 transition-opacity duration-100"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        <div className="pointer-events-auto">
          <BookmarkActions bookmark={bookmark} />
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {isImage ? (
          <motion.div
            key="asset-image"
            className="bg-surface-elevated flex aspect-video w-full items-center justify-center overflow-hidden"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? false : { opacity: 1 }}
            transition={
              reduce ? undefined : { duration: duration.medium, ease: ease.out }
            }
          >
            {assetUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl}
                alt={bookmark.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />
            )}
          </motion.div>
        ) : isPdf ? (
          snapshotUrl ? (
            <motion.img
              key="asset-pdf-thumb"
              src={snapshotUrl}
              alt={bookmark.title}
              loading="lazy"
              decoding="async"
              className="bg-surface-elevated aspect-video w-full object-cover object-top"
              initial={reduce ? false : { opacity: 0 }}
              animate={reduce ? false : { opacity: 1 }}
              transition={
                reduce
                  ? undefined
                  : { duration: duration.medium, ease: ease.out }
              }
            />
          ) : (
            <motion.div
              key="asset-pdf"
              className="bg-surface-elevated flex aspect-video w-full flex-col items-center justify-center gap-2"
              initial={reduce ? false : { opacity: 0 }}
              animate={reduce ? false : { opacity: 1 }}
              transition={
                reduce
                  ? undefined
                  : { duration: duration.medium, ease: ease.out }
              }
            >
              <PdfPreviewGlyph />
              <span className="text-foreground-subtle text-[11px] font-semibold tracking-wider uppercase">
                PDF
              </span>
            </motion.div>
          )
        ) : showShimmer ? (
          <motion.div
            key="shimmer"
            className="aspect-video bg-[length:200%_100%]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-sheen) 50%, var(--skeleton-base) 100%)",
            }}
            animate={reduce ? undefined : keyframes.shimmer}
            exit={
              reduce
                ? undefined
                : {
                    opacity: 0,
                    transition: { duration: duration.fast, ease: ease.out },
                  }
            }
            transition={
              reduce
                ? undefined
                : { duration: 1.4, repeat: Infinity, ease: "linear" }
            }
          />
        ) : showImage ? (
          <motion.img
            key="image"
            src={bookmark.previewImageUrl ?? undefined}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="bg-surface-elevated aspect-video w-full object-cover"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? false : { opacity: 1 }}
            transition={
              reduce ? undefined : { duration: duration.medium, ease: ease.out }
            }
          />
        ) : snapshotUrl ? (
          <motion.img
            key="snapshot"
            src={snapshotUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="bg-surface-elevated aspect-video w-full object-cover"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? false : { opacity: 1 }}
            transition={
              reduce ? undefined : { duration: duration.medium, ease: ease.out }
            }
          />
        ) : (
          <motion.div
            key="fallback"
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? false : { opacity: 1 }}
            transition={
              reduce ? undefined : { duration: duration.medium, ease: ease.out }
            }
          >
            <PreviewPlaceholder
              domain={bookmark.domain}
              faviconUrl={bookmark.faviconUrl}
              title={bookmark.title}
              className="aspect-video"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col gap-2 px-3.5 py-3 pb-3.5">
        <div className="text-foreground-subtle flex items-center gap-1.5 text-[11px]">
          {isAsset ? (
            <span className="border-border text-foreground-muted shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase">
              {isPdf ? "PDF" : "Image"}
            </span>
          ) : (
            <FaviconFallback
              url={bookmark.faviconUrl}
              domain={bookmark.domain}
            />
          )}
          {isAsset
            ? relativeTime(bookmark.createdAt)
            : `${bookmark.domain} · ${relativeTime(bookmark.createdAt)}`}
          {bookmark.linkStatus === "broken" && (
            <span className="border-tone-error/40 text-tone-error shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
              Broken
            </span>
          )}
          {bookmark.linkStatus === "redirected" && bookmark.linkRedirectUrl && (
            <span className="flex shrink-0 items-center gap-1">
              <span className="border-accent-orange/40 text-accent-orange rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                Moved
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void getUseBookmarksApi().update(bookmark.id, {
                    url: bookmark.linkRedirectUrl!,
                    linkStatus: "ok",
                    linkRedirectUrl: null,
                  });
                }}
                className="text-accent-blue hover:underline"
              >
                Update
              </button>
            </span>
          )}
          {bookmark.note && bookmark.note.length > 0 && (
            <svg
              width="11"
              height="11"
              viewBox="0 0 16 16"
              fill="none"
              aria-label="Has note"
              className="shrink-0"
            >
              <path
                d="M3 2.5h10v8l-3 3H3z M10 13.5V10h3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {similarCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                useStore.setState((s) => ({
                  ui: setSimilarTo(s.ui, bookmark.id),
                }));
              }}
              className="border-border bg-surface text-foreground-subtle hover:text-foreground hover:border-border-strong ml-auto shrink-0 rounded-full border px-2 py-0.5 transition-colors duration-100 ease-out active:scale-[0.97]"
            >
              {similarCount} similar
            </button>
          )}
        </div>
        <h3 className="text-foreground line-clamp-2 text-sm leading-snug font-medium tracking-tight">
          {bookmark.title}
        </h3>
        {bookmark.description && (
          <p className="text-foreground-muted line-clamp-2 text-xs leading-relaxed">
            {bookmark.description}
          </p>
        )}
        {tagsForCard.length > 0 && (
          <motion.div layout className="flex flex-wrap items-center gap-1 pt-1">
            <AnimatePresence initial={false}>
              {visibleChips.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={reduce ? false : { opacity: 0, scale: 0.95 }}
                  animate={reduce ? false : { opacity: 1, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
                  transition={
                    reduce
                      ? undefined
                      : { duration: duration.fast, ease: ease.out }
                  }
                >
                  <TagChip tag={t} size="sm" />
                </motion.div>
              ))}
              {overflow > 0 && (
                <motion.span
                  key="overflow"
                  layout
                  initial={reduce ? false : { opacity: 0 }}
                  animate={reduce ? false : { opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  transition={
                    reduce
                      ? undefined
                      : { duration: duration.fast, ease: ease.out }
                  }
                  className="text-foreground-subtle text-[11px] tabular-nums"
                >
                  +{overflow}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </motion.article>
  );
}
