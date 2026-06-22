/**
 * Embedding CRUD adapter (feature 28) — local-only, keyed by bookmarkId.
 * Mirrors articlesAdapter.
 */

import type { Embedding, BookmarkId } from "@/types";
import type { LinkNestDb } from "./schema";

export interface EmbeddingsAdapter {
  list(): Promise<Embedding[]>;
  put(e: Embedding): Promise<void>;
  remove(bookmarkId: BookmarkId): Promise<void>;
  get(bookmarkId: BookmarkId): Promise<Embedding | null>;
}

export function dexieEmbeddingsAdapter(db: LinkNestDb): EmbeddingsAdapter {
  return {
    async list() {
      return db.embeddings.toArray();
    },
    async put(e) {
      await db.embeddings.put(e);
    },
    async remove(bookmarkId) {
      await db.embeddings.delete(bookmarkId);
    },
    async get(bookmarkId) {
      return (await db.embeddings.get(bookmarkId)) ?? null;
    },
  };
}

export function memoryEmbeddingsAdapter(): EmbeddingsAdapter {
  const store = new Map<string, Embedding>();
  return {
    async list() {
      return [...store.values()];
    },
    async put(e) {
      store.set(e.bookmarkId, e);
    },
    async remove(bookmarkId) {
      store.delete(bookmarkId);
    },
    async get(bookmarkId) {
      return store.get(bookmarkId) ?? null;
    },
  };
}
