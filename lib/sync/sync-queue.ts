import type { Bookmark, Folder, Tag, Preferences } from "@/types";
import type { LinkNestDb, SyncQueueRow } from "@/lib/db/schema";

export type QueuePayload = Bookmark | Folder | Tag | Preferences;
export type QueueEntity = "bookmark" | "folder" | "tag" | "preferences";

export interface SyncQueueAdapter {
  enqueue(
    entity: QueueEntity,
    id: string,
    payload: QueuePayload
  ): Promise<void>;
  list(): Promise<SyncQueueRow[]>;
  incrementAttempts(key: string): Promise<number>;
  remove(key: string): Promise<void>;
  size(): Promise<number>;
}

export function dexieSyncQueueAdapter(db: LinkNestDb): SyncQueueAdapter {
  return {
    async enqueue(entity, id, payload) {
      // Dedupe per Q6: primary-key upsert replaces existing, bumps createdAt + resets attempts.
      await db.syncQueue.put({
        key: `${entity}:${id}`,
        entity,
        createdAt: Date.now(),
        attempts: 0,
        payload,
      });
    },
    async list() {
      return db.syncQueue.orderBy("createdAt").toArray();
    },
    async incrementAttempts(key) {
      const row = await db.syncQueue.get(key);
      if (!row) return 0;
      const next = row.attempts + 1;
      await db.syncQueue.update(key, { attempts: next });
      return next;
    },
    async remove(key) {
      await db.syncQueue.delete(key);
    },
    async size() {
      return db.syncQueue.count();
    },
  };
}

export function memorySyncQueueAdapter(): SyncQueueAdapter {
  const store = new Map<string, SyncQueueRow>();
  return {
    async enqueue(entity, id, payload) {
      const key = `${entity}:${id}`;
      store.set(key, {
        key,
        entity,
        createdAt: Date.now(),
        attempts: 0,
        payload,
      });
    },
    async list() {
      return [...store.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    async incrementAttempts(key) {
      const row = store.get(key);
      if (!row) return 0;
      row.attempts += 1;
      store.set(key, row);
      return row.attempts;
    },
    async remove(key) {
      store.delete(key);
    },
    async size() {
      return store.size;
    },
  };
}
