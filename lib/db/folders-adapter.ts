/**
 * Folder CRUD adapter — mirrors BookmarksAdapter shape (feature 01).
 *
 * Two implementations:
 *   - dexieFoldersAdapter(db) — production, backed by the v1 schema's
 *     `folders` table (declared in lib/db/schema.ts).
 *   - memoryFoldersAdapter() — tests + Phase 3 prototype patterns.
 */

import type { Folder, FolderId } from "@/types";
import type { LinkNestDb } from "./schema";

export interface FoldersAdapter {
  list(): Promise<Folder[]>;
  put(folder: Folder): Promise<void>;
  remove(id: FolderId): Promise<void>;
  get(id: FolderId): Promise<Folder | null>;
}

export function dexieFoldersAdapter(db: LinkNestDb): FoldersAdapter {
  return {
    async list() {
      const all = await db.folders.toArray();
      return all.sort((a, b) => b.createdAt - a.createdAt);
    },
    async put(folder) {
      await db.folders.put(folder);
    },
    async remove(id) {
      await db.folders.delete(id);
    },
    async get(id) {
      const row = await db.folders.get(id);
      return row ?? null;
    },
  };
}

export function memoryFoldersAdapter(): FoldersAdapter {
  const store = new Map<string, Folder>();
  return {
    async list() {
      return [...store.values()].sort((a, b) => b.createdAt - a.createdAt);
    },
    async put(folder) {
      store.set(folder.id, folder);
    },
    async remove(id) {
      store.delete(id);
    },
    async get(id) {
      return store.get(id) ?? null;
    },
  };
}
