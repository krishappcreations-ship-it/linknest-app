import type { Bookmark, Folder, Tag, Preferences } from "@/types";
import type { SyncAdapter } from "./types";

export interface MemorySyncStore {
  bookmarks: Map<string, Bookmark>;
  folders: Map<string, Folder>;
  tags: Map<string, Tag>;
  preferences: Preferences | null;
  /** Failing path for tests — when set, next op rejects with this. */
  failNext: Error | null;
}

export function createMemorySyncStore(): MemorySyncStore {
  return {
    bookmarks: new Map(),
    folders: new Map(),
    tags: new Map(),
    preferences: null,
    failNext: null,
  };
}

function maybeFail(store: MemorySyncStore) {
  if (store.failNext) {
    const err = store.failNext;
    store.failNext = null;
    throw err;
  }
}

function lwwPut<T extends { id: string; updatedAt: number }>(
  map: Map<string, T>,
  row: T
) {
  const existing = map.get(row.id);
  if (!existing || row.updatedAt >= existing.updatedAt) {
    map.set(row.id, row);
  }
}

export function memorySyncAdapter(store: MemorySyncStore): SyncAdapter {
  return {
    async uploadAll(_userId, payload) {
      maybeFail(store);
      payload.bookmarks.forEach((b) => lwwPut(store.bookmarks, b));
      payload.folders.forEach((f) => lwwPut(store.folders, f));
      payload.tags.forEach((t) => lwwPut(store.tags, t));
      if (payload.preferences) store.preferences = payload.preferences;
    },
    async fetchAll(_userId) {
      maybeFail(store);
      return {
        bookmarks: [...store.bookmarks.values()],
        folders: [...store.folders.values()],
        tags: [...store.tags.values()],
        preferences: store.preferences,
      };
    },
    async putBookmark(_userId, b) {
      maybeFail(store);
      lwwPut(store.bookmarks, b);
    },
    async putFolder(_userId, f) {
      maybeFail(store);
      lwwPut(store.folders, f);
    },
    async putTag(_userId, t) {
      maybeFail(store);
      lwwPut(store.tags, t);
    },
    async putPreferences(_userId, p) {
      maybeFail(store);
      store.preferences = p;
    },
  };
}
