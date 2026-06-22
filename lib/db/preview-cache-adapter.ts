/**
 * previewCache adapter — feature 02.
 *
 * Mirrors BookmarksAdapter shape. The table is declared in lib/db/schema.ts
 * v1 with key `url, fetchedAt`. Worker reads cache first on pending rows
 * (30-day TTL). Manual refresh bypasses by deleting the row.
 */

import type { Preview } from "@/types";
import type { LinkNestDb } from "./schema";

export interface PreviewCacheAdapter {
  get(url: string): Promise<Preview | null>;
  put(entry: Preview): Promise<void>;
  delete(url: string): Promise<void>;
  list(): Promise<Preview[]>;
}

export function dexiePreviewCacheAdapter(db: LinkNestDb): PreviewCacheAdapter {
  return {
    async get(url) {
      const row = await db.previewCache.get(url);
      return row ?? null;
    },
    async put(entry) {
      await db.previewCache.put(entry);
    },
    async delete(url) {
      await db.previewCache.delete(url);
    },
    async list() {
      return db.previewCache.toArray();
    },
  };
}

export function memoryPreviewCacheAdapter(): PreviewCacheAdapter {
  const store = new Map<string, Preview>();
  return {
    async get(url) {
      return store.get(url) ?? null;
    },
    async put(entry) {
      store.set(entry.url, entry);
    },
    async delete(url) {
      store.delete(url);
    },
    async list() {
      return [...store.values()];
    },
  };
}
