/**
 * SmartCollection CRUD adapter (feature 27) — local-only, mirrors
 * foldersAdapter. Ordered by `order` (creation time).
 */

import type { SmartCollection, SmartCollectionId } from "@/types";
import type { LinkNestDb } from "./schema";

export interface SmartCollectionsAdapter {
  list(): Promise<SmartCollection[]>;
  put(c: SmartCollection): Promise<void>;
  remove(id: SmartCollectionId): Promise<void>;
  get(id: SmartCollectionId): Promise<SmartCollection | null>;
}

export function dexieSmartCollectionsAdapter(
  db: LinkNestDb
): SmartCollectionsAdapter {
  return {
    async list() {
      return (await db.smartCollections.toArray()).sort(
        (a, b) => a.order - b.order
      );
    },
    async put(c) {
      await db.smartCollections.put(c);
    },
    async remove(id) {
      await db.smartCollections.delete(id);
    },
    async get(id) {
      return (await db.smartCollections.get(id)) ?? null;
    },
  };
}

export function memorySmartCollectionsAdapter(): SmartCollectionsAdapter {
  const store = new Map<string, SmartCollection>();
  return {
    async list() {
      return [...store.values()].sort((a, b) => a.order - b.order);
    },
    async put(c) {
      store.set(c.id, c);
    },
    async remove(id) {
      store.delete(id);
    },
    async get(id) {
      return store.get(id) ?? null;
    },
  };
}
