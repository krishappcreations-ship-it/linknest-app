"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { duration, ease, stagger } from "@/app/styles/motion";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useBookmarkShortcuts } from "@/hooks/use-bookmark-shortcuts";
import { usePreferences } from "@/hooks/use-preferences";
import { SortableBookmarkCard } from "./sortable-bookmark-card";
import { SortableBookmarkRow } from "./sortable-bookmark-row";
import { SortableBookmarkGalleryCard } from "./sortable-bookmark-gallery-card";
import { BookmarkSkeleton } from "./bookmark-skeleton";
import { BookmarkEmpty } from "./bookmark-empty";
import { hydrateFromDexie, useStore } from "@/store";
import {
  selectFilteredBookmarks,
  selectVisibleBookmarks,
} from "@/store/slices/bookmarks-slice";
import { selectFolderSubtreeIds } from "@/store/slices/folders-slice";
import { matchesRules } from "@/lib/collections/evaluate-rules";
import { setSimilarTo } from "@/store/slices/ui-slice";
import { findSimilar } from "@/lib/dedupe/similar";
import type { FolderId } from "@/types";

/**
 * Grid orchestrator — feature 01 + 07.
 *
 * Owns:
 *   - hydration from Dexie on first mount (idempotent)
 *   - global keyboard shortcuts via useBookmarkShortcuts
 *   - the 1.5s focus-highlight auto-clear after duplicate jump
 *   - layout dispatch (masonry/list/gallery) via AnimatePresence crossfade
 *   - per-layout SortableContext (rect for grids, vertical for list)
 */
export function BookmarkGrid() {
  const { count, selection, focusBookmarkId, toggle, focusBookmark } =
    useBookmarks();
  const bookmarksState = useStore((s) => s.bookmarks);
  const foldersState = useStore((s) => s.folders);
  const filter = useStore((s) => s.ui.selectedFolderFilter);
  const tagFilter = useStore((s) => s.ui.selectedTagId);
  const readStateFilter = useStore((s) => s.ui.readStateFilter);
  const activeSmartCollectionId = useStore((s) => s.ui.activeSmartCollectionId);
  const similarToBookmarkId = useStore((s) => s.ui.similarToBookmarkId);
  const linkStatusFilter = useStore((s) => s.ui.linkStatusFilter);
  const selectedKindFilter = useStore((s) => s.ui.selectedKindFilter);
  const selectedPromptCategory = useStore((s) => s.ui.selectedPromptCategory);
  const selectedContentType = useStore((s) => s.ui.selectedContentType);
  const embeddingById = useStore((s) => s.embeddingById);
  const smartCollections = useStore((s) => s.smartCollections);
  const articleReadingMinutes = useStore((s) => s.articleReadingMinutes);
  const { layout } = usePreferences();
  const bookmarks = useMemo(() => {
    if (linkStatusFilter === "broken") {
      return selectVisibleBookmarks(bookmarksState).filter(
        (b) => b.linkStatus === "broken" && b.kind !== "prompt"
      );
    }
    if (similarToBookmarkId) {
      const ids = new Set(
        findSimilar(similarToBookmarkId, embeddingById).map((h) => h.id)
      );
      return selectVisibleBookmarks(bookmarksState).filter(
        (b) => ids.has(b.id) && b.kind !== "prompt"
      );
    }
    if (activeSmartCollectionId) {
      const coll = smartCollections.byId[activeSmartCollectionId];
      if (!coll) return [];
      const ctx = {
        readingMinutes: (id: string) => articleReadingMinutes[id],
        inFolderSubtree: (id: string, folderId: FolderId) => {
          const b = bookmarksState.byId[id];
          return (
            b?.folderId != null &&
            selectFolderSubtreeIds(foldersState, folderId).has(b.folderId)
          );
        },
        now: Date.now(),
      };
      return selectVisibleBookmarks(bookmarksState).filter(
        (b) => matchesRules(coll.rules, b, ctx) && b.kind !== "prompt"
      );
    }
    return selectFilteredBookmarks({
      bookmarks: bookmarksState,
      folders: foldersState,
      filter,
      tagFilter,
      readStateFilter,
      kindFilter: selectedKindFilter,
      promptCategory: selectedPromptCategory,
      contentType: selectedContentType,
    });
  }, [
    bookmarksState,
    foldersState,
    filter,
    tagFilter,
    readStateFilter,
    selectedKindFilter,
    selectedPromptCategory,
    selectedContentType,
    activeSmartCollectionId,
    similarToBookmarkId,
    linkStatusFilter,
    embeddingById,
    smartCollections,
    articleReadingMinutes,
  ]);
  const hydrated = useStore((s) => s.hydrated);
  const reduce = useReducedMotion();

  useBookmarkShortcuts();

  useEffect(() => {
    void hydrateFromDexie();
  }, []);

  useEffect(() => {
    if (!focusBookmarkId) return;
    const t = setTimeout(() => focusBookmark(null), 1500);
    return () => clearTimeout(t);
  }, [focusBookmarkId, focusBookmark]);

  if (!hydrated) {
    return (
      <div className="grid [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-4">
        <BookmarkSkeleton />
        <BookmarkSkeleton />
        <BookmarkSkeleton />
      </div>
    );
  }

  if (count === 0) return <BookmarkEmpty />;

  const itemIds = bookmarks.map((b) => `bookmark:${b.id}:sortable`);
  const fadeTransition = reduce
    ? undefined
    : { duration: duration.medium, ease: ease.out };
  const exitTransition = reduce ? undefined : { duration: 0.15 };

  return (
    <>
      {similarToBookmarkId && (
        <div className="border-border bg-surface-elevated mb-4 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span className="text-foreground-muted">
            Showing {bookmarks.length} similar to{" "}
            <span className="text-foreground font-medium">
              “{bookmarksState.byId[similarToBookmarkId]?.title ?? "bookmark"}”
            </span>
          </span>
          <button
            type="button"
            onClick={() =>
              useStore.setState((s) => ({ ui: setSimilarTo(s.ui, null) }))
            }
            className="text-foreground-subtle hover:text-foreground ml-auto rounded px-2 py-0.5 transition-colors duration-100 ease-out active:scale-[0.98]"
          >
            Clear
          </button>
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {layout === "masonry" && (
          <motion.div
            key="masonry"
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: exitTransition }}
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: reduce
                  ? undefined
                  : {
                      duration: duration.medium,
                      ease: ease.out,
                      staggerChildren: stagger.list,
                      delayChildren: 0.02,
                    },
              },
            }}
            className="grid [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))] gap-4"
          >
            <SortableContext items={itemIds} strategy={rectSortingStrategy}>
              {bookmarks.map((b) => (
                <motion.div
                  key={b.id}
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    show: { opacity: 1, y: 0 },
                  }}
                  transition={fadeTransition}
                >
                  <SortableBookmarkCard
                    bookmark={b}
                    isSelected={selection.includes(b.id)}
                    isFocused={focusBookmarkId === b.id}
                    onToggle={(mod) => toggle(b.id, mod)}
                  />
                </motion.div>
              ))}
            </SortableContext>
          </motion.div>
        )}

        {layout === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: exitTransition }}
            transition={fadeTransition}
            className="border-border bg-surface flex flex-col overflow-hidden rounded-md border"
          >
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              {bookmarks.map((b) => (
                <SortableBookmarkRow
                  key={b.id}
                  bookmark={b}
                  isSelected={selection.includes(b.id)}
                  isFocused={focusBookmarkId === b.id}
                  onToggle={(mod) => toggle(b.id, mod)}
                />
              ))}
            </SortableContext>
          </motion.div>
        )}

        {layout === "gallery" && (
          <motion.div
            key="gallery"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: exitTransition }}
            transition={fadeTransition}
            className="grid [grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-5"
          >
            <SortableContext items={itemIds} strategy={rectSortingStrategy}>
              {bookmarks.map((b) => (
                <SortableBookmarkGalleryCard
                  key={b.id}
                  bookmark={b}
                  isSelected={selection.includes(b.id)}
                  isFocused={focusBookmarkId === b.id}
                  onToggle={(mod) => toggle(b.id, mod)}
                />
              ))}
            </SortableContext>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
