"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { hydrateFromDexie } from "@/store";
import { selectBookmarkById } from "@/store/slices/bookmarks-slice";
import type { Article, Bookmark, BookmarkId } from "@/types";

export type ReaderStatus = "loading" | "missing" | "not-captured" | "ready";

/**
 * Pure status resolver — given the loaded bookmark + article, decide what the
 * reader should render. `loaded` distinguishes "still fetching" from "fetched,
 * nothing there".
 */
export function readerStatus(
  loaded: boolean,
  bookmark: Bookmark | null,
  article: Article | null
): ReaderStatus {
  if (!loaded) return "loading";
  if (!bookmark) return "missing";
  if (bookmark.captureStatus !== "ready" || !article) return "not-captured";
  return "ready";
}

export function useReaderData(id: BookmarkId): {
  status: ReaderStatus;
  bookmark: Bookmark | null;
  article: Article | null;
} {
  const bookmark = useStore((s) => selectBookmarkById(s.bookmarks, id));
  const hydrated = useStore((s) => s.hydrated);
  const [article, setArticle] = useState<Article | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateFromDexie();
      const a = await useStore.getState().articlesAdapter.get(id);
      if (!cancelled) {
        setArticle(a);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return {
    status: readerStatus(loaded && hydrated, bookmark, article),
    bookmark,
    article,
  };
}
