/**
 * Article CRUD adapter — thin wrapper around Dexie's `articles` table.
 *
 * Feature 23. Mirrors BookmarksAdapter. Keyed by `bookmarkId` (1:1 with a
 * bookmark). The memory variant backs tests + the Phase-3 prototype seam.
 */

import type { Article, BookmarkId } from "@/types";
import type { LinkNestDb } from "./schema";

export interface ArticlesAdapter {
  list(): Promise<Article[]>;
  put(a: Article): Promise<void>;
  remove(bookmarkId: BookmarkId): Promise<void>;
  get(bookmarkId: BookmarkId): Promise<Article | null>;
}

export function dexieArticlesAdapter(db: LinkNestDb): ArticlesAdapter {
  return {
    async list() {
      return db.articles.toArray();
    },
    async put(a) {
      await db.articles.put(a);
    },
    async remove(bookmarkId) {
      await db.articles.delete(bookmarkId);
    },
    async get(bookmarkId) {
      return (await db.articles.get(bookmarkId)) ?? null;
    },
  };
}

export function memoryArticlesAdapter(): ArticlesAdapter {
  const store = new Map<string, Article>();
  return {
    async list() {
      return [...store.values()];
    },
    async put(a) {
      store.set(a.bookmarkId, a);
    },
    async remove(bookmarkId) {
      store.delete(bookmarkId);
    },
    async get(bookmarkId) {
      return store.get(bookmarkId) ?? null;
    },
  };
}
