/**
 * Dexie schema v1. Adding tables or indexes requires bumping the version
 * and writing an `.upgrade(tx => …)` block. No silent migrations
 * (per ADR-004).
 */

import Dexie, { type Table } from "dexie";
import type {
  Bookmark,
  Folder,
  Tag,
  Preview,
  Preferences,
  Article,
  SmartCollection,
  Embedding,
  Highlight,
  Snapshot,
} from "@/types";

export type PreferenceRow = {
  key: string;
  value: Preferences[keyof Preferences];
};
export type SyncMetaRow = { entity: string; lastSyncedAt: number };

export type SyncQueueRow = {
  key: string; // "${entity}:${id}"
  entity: "bookmark" | "folder" | "tag" | "preferences";
  createdAt: number;
  attempts: number;
  payload: Bookmark | Folder | Tag | Preferences;
};

export class LinkNestDb extends Dexie {
  bookmarks!: Table<Bookmark, string>;
  folders!: Table<Folder, string>;
  tags!: Table<Tag, string>;
  preferences!: Table<PreferenceRow, string>;
  previewCache!: Table<Preview, string>;
  syncMeta!: Table<SyncMetaRow, string>;
  syncQueue!: Table<SyncQueueRow, string>;
  articles!: Table<Article, string>;
  smartCollections!: Table<SmartCollection, string>;
  embeddings!: Table<Embedding, string>;
  highlights!: Table<Highlight, string>;
  snapshots!: Table<Snapshot, string>;

  constructor(name = "linknest") {
    super(name);
    this.version(1).stores({
      bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
      folders: "id, parentId, order, pinned, updatedAt",
      tags: "id, name, color, updatedAt",
      preferences: "key",
      previewCache: "url, fetchedAt",
      syncMeta: "entity",
    });

    // v2 — F08 Phase 2a offline write queue. Additive table only.
    // Per ADR-004 migration policy: explicit version bump, no silent migrations.
    this.version(2)
      .stores({
        bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
        folders: "id, parentId, order, pinned, updatedAt",
        tags: "id, name, color, updatedAt",
        preferences: "key",
        previewCache: "url, fetchedAt",
        syncMeta: "entity",
        syncQueue: "key, entity, createdAt",
      })
      .upgrade(async () => {
        // No data migration — new syncQueue table starts empty.
      });

    // v3 — F08 Phase 2b folder/tag tombstones. Additive deletedAt field
    // on folders + tags. Existing rows auto-migrate to deletedAt = null.
    this.version(3)
      .stores({
        bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
        folders: "id, parentId, order, pinned, updatedAt",
        tags: "id, name, color, updatedAt",
        preferences: "key",
        previewCache: "url, fetchedAt",
        syncMeta: "entity",
        syncQueue: "key, entity, createdAt",
      })
      .upgrade(async (tx) => {
        await tx.table("folders").toCollection().modify({ deletedAt: null });
        await tx.table("tags").toCollection().modify({ deletedAt: null });
      });

    // v4 — F22 read-later workflow. Additive readState field on bookmarks.
    // Not indexed (counts/filter run in-memory). Existing rows backfill to
    // readState = "inbox".
    this.version(4)
      .stores({
        bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
        folders: "id, parentId, order, pinned, updatedAt",
        tags: "id, name, color, updatedAt",
        preferences: "key",
        previewCache: "url, fetchedAt",
        syncMeta: "entity",
        syncQueue: "key, entity, createdAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("bookmarks")
          .toCollection()
          .modify((b) => {
            if (b.readState === undefined) b.readState = "inbox";
          });
      });

    // v5 — F23 article capture. Additive articles table + capture state on
    // bookmarks. Existing rows backfill to captureStatus = "pending".
    this.version(5)
      .stores({
        bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
        folders: "id, parentId, order, pinned, updatedAt",
        tags: "id, name, color, updatedAt",
        preferences: "key",
        previewCache: "url, fetchedAt",
        syncMeta: "entity",
        syncQueue: "key, entity, createdAt",
        articles: "bookmarkId, capturedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("bookmarks")
          .toCollection()
          .modify((b) => {
            if (b.captureStatus === undefined) {
              b.captureStatus = "pending";
              b.captureFailureKind = null;
              b.captureAttempt = 0;
            }
          });
      });

    // v6 — F24 reader mode. Additive readProgress on bookmarks (scroll
    // restore). Existing rows backfill to 0.
    this.version(6)
      .stores({
        bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
        folders: "id, parentId, order, pinned, updatedAt",
        tags: "id, name, color, updatedAt",
        preferences: "key",
        previewCache: "url, fetchedAt",
        syncMeta: "entity",
        syncQueue: "key, entity, createdAt",
        articles: "bookmarkId, capturedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("bookmarks")
          .toCollection()
          .modify((b) => {
            if (b.readProgress === undefined) b.readProgress = 0;
          });
      });

    // v7 — F27 smart collections. Additive table only (empty until the user
    // creates a collection); no data migration.
    this.version(7).stores({
      bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
      folders: "id, parentId, order, pinned, updatedAt",
      tags: "id, name, color, updatedAt",
      preferences: "key",
      previewCache: "url, fetchedAt",
      syncMeta: "entity",
      syncQueue: "key, entity, createdAt",
      articles: "bookmarkId, capturedAt",
      smartCollections: "id, order",
    });

    // v8 — F28 semantic search. Additive embeddings table (empty until the
    // embed worker fills it); no data migration.
    this.version(8).stores({
      bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
      folders: "id, parentId, order, pinned, updatedAt",
      tags: "id, name, color, updatedAt",
      preferences: "key",
      previewCache: "url, fetchedAt",
      syncMeta: "entity",
      syncQueue: "key, entity, createdAt",
      articles: "bookmarkId, capturedAt",
      smartCollections: "id, order",
      embeddings: "bookmarkId",
    });

    // v9 — F30 notes & highlights. Additive highlights table (local-only) +
    // additive bookmark.note field (no index change for note). No data migration.
    this.version(9).stores({
      bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
      folders: "id, parentId, order, pinned, updatedAt",
      tags: "id, name, color, updatedAt",
      preferences: "key",
      previewCache: "url, fetchedAt",
      syncMeta: "entity",
      syncQueue: "key, entity, createdAt",
      articles: "bookmarkId, capturedAt",
      smartCollections: "id, order",
      embeddings: "bookmarkId",
      highlights: "id, bookmarkId, createdAt",
    });

    // v10 — F31 snapshot capture. Additive snapshots table (local-only). No data migration.
    this.version(10).stores({
      bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, url, domain",
      folders: "id, parentId, order, pinned, updatedAt",
      tags: "id, name, color, updatedAt",
      preferences: "key",
      previewCache: "url, fetchedAt",
      syncMeta: "entity",
      syncQueue: "key, entity, createdAt",
      articles: "bookmarkId, capturedAt",
      smartCollections: "id, order",
      embeddings: "bookmarkId",
      highlights: "id, bookmarkId, createdAt",
      snapshots: "bookmarkId, generatedAt",
    });

    // v11 — F-assets: kind (link|image|pdf) + assetPath. Backfill existing rows
    // to kind:'link'. Index `kind` for future filtering.
    this.version(11)
      .stores({
        bookmarks:
          "id, folderId, kind, *tagIds, createdAt, updatedAt, url, domain",
      })
      .upgrade(async (tx) => {
        await tx
          .table("bookmarks")
          .toCollection()
          .modify((b: { kind?: string; assetPath?: string | null }) => {
            if (b.kind === undefined) b.kind = "link";
            if (b.assetPath === undefined) b.assetPath = null;
          });
      });
  }
}

/** Factory — call inside client-only code (browser context). */
export function createDb(name?: string): LinkNestDb {
  return new LinkNestDb(name);
}
