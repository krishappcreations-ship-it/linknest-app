/**
 * Snapshot CRUD adapter (feature 31) — local-only, keyed by bookmarkId.
 * Mirrors embeddingsAdapter.
 */

import type { Snapshot, BookmarkId } from "@/types";
import type { LinkNestDb } from "./schema";

export interface SnapshotsAdapter {
  list(): Promise<Snapshot[]>;
  put(s: Snapshot): Promise<void>;
  remove(bookmarkId: BookmarkId): Promise<void>;
  get(bookmarkId: BookmarkId): Promise<Snapshot | null>;
}

export function dexieSnapshotsAdapter(db: LinkNestDb): SnapshotsAdapter {
  return {
    async list() {
      return db.snapshots.toArray();
    },
    async put(s) {
      await db.snapshots.put(s);
    },
    async remove(bookmarkId) {
      await db.snapshots.delete(bookmarkId);
    },
    async get(bookmarkId) {
      return (await db.snapshots.get(bookmarkId)) ?? null;
    },
  };
}

export function memorySnapshotsAdapter(): SnapshotsAdapter {
  const store = new Map<string, Snapshot>();
  return {
    async list() {
      return [...store.values()];
    },
    async put(s) {
      store.set(s.bookmarkId, s);
    },
    async remove(bookmarkId) {
      store.delete(bookmarkId);
    },
    async get(bookmarkId) {
      return store.get(bookmarkId) ?? null;
    },
  };
}
