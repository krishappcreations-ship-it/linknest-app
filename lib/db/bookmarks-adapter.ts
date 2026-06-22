/**
 * Bookmark CRUD adapter — thin wrapper around Dexie.
 *
 * The rest of the app never imports Dexie directly. This adapter is the
 * boundary. Mocking it in tests lets us run slice tests without a real
 * IndexedDB (we run them under jsdom; Dexie supports jsdom via fake-indexeddb
 * but the contract here lets us swap in pure in-memory for the prototype).
 */

import type { Bookmark, BookmarkId } from "@/types";
import type { LinkNestDb } from "./schema";

export interface BookmarksAdapter {
  /** Return every bookmark, newest first. */
  list(): Promise<Bookmark[]>;
  /** Upsert (`put`) — used for both create and update. */
  put(b: Bookmark): Promise<void>;
  /** Remove by id. Idempotent. */
  remove(id: BookmarkId): Promise<void>;
  /** Get a single bookmark by id. Null if absent. */
  get(id: BookmarkId): Promise<Bookmark | null>;
}

export function dexieBookmarksAdapter(db: LinkNestDb): BookmarksAdapter {
  return {
    async list() {
      const all = await db.bookmarks.toArray();
      return all.sort((a, b) => b.createdAt - a.createdAt);
    },
    async put(b) {
      await db.bookmarks.put(b);
    },
    async remove(id) {
      await db.bookmarks.delete(id);
    },
    async get(id) {
      const row = await db.bookmarks.get(id);
      return row ?? null;
    },
  };
}

/** In-memory adapter — used for tests + Phase 3 prototype. */
export function memoryBookmarksAdapter(): BookmarksAdapter {
  const store = new Map<string, Bookmark>();
  return {
    async list() {
      return [...store.values()].sort((a, b) => b.createdAt - a.createdAt);
    },
    async put(b) {
      store.set(b.id, b);
    },
    async remove(id) {
      store.delete(id);
    },
    async get(id) {
      return store.get(id) ?? null;
    },
  };
}
