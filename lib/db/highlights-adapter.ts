/**
 * Highlight CRUD adapter — Dexie `highlights` table (feature 30, local-only).
 * Mirrors ArticlesAdapter, plus removeByBookmark for cascade-on-delete.
 */

import type { Highlight, HighlightId, BookmarkId } from "@/types";
import type { LinkNestDb } from "./schema";

export interface HighlightsAdapter {
  list(): Promise<Highlight[]>;
  put(h: Highlight): Promise<void>;
  remove(id: HighlightId): Promise<void>;
  removeByBookmark(bookmarkId: BookmarkId): Promise<void>;
}

export function dexieHighlightsAdapter(db: LinkNestDb): HighlightsAdapter {
  return {
    async list() {
      return db.highlights.toArray();
    },
    async put(h) {
      await db.highlights.put(h);
    },
    async remove(id) {
      await db.highlights.delete(id);
    },
    async removeByBookmark(bookmarkId) {
      await db.highlights.where("bookmarkId").equals(bookmarkId).delete();
    },
  };
}

export function memoryHighlightsAdapter(): HighlightsAdapter {
  const store = new Map<string, Highlight>();
  return {
    async list() {
      return [...store.values()];
    },
    async put(h) {
      store.set(h.id, h);
    },
    async remove(id) {
      store.delete(id);
    },
    async removeByBookmark(bookmarkId) {
      for (const [k, v] of store)
        if (v.bookmarkId === bookmarkId) store.delete(k);
    },
  };
}
