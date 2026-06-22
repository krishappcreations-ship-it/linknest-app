import type { LinkNestDb } from "@/lib/db/schema";
import type { Tag, TagId } from "@/types";

export interface TagsAdapter {
  list(): Promise<Tag[]>;
  put(tag: Tag): Promise<void>;
  remove(id: TagId): Promise<void>;
  get(id: TagId): Promise<Tag | null>;
}

export function dexieTagsAdapter(db: LinkNestDb): TagsAdapter {
  return {
    async list() {
      return db.tags.toArray();
    },
    async put(tag) {
      await db.tags.put(tag);
    },
    async remove(id) {
      await db.tags.delete(id);
    },
    async get(id) {
      return (await db.tags.get(id)) ?? null;
    },
  };
}

export function memoryTagsAdapter(): TagsAdapter {
  const store = new Map<string, Tag>();
  return {
    async list() {
      return Array.from(store.values());
    },
    async put(tag) {
      store.set(tag.id, tag);
    },
    async remove(id) {
      store.delete(id);
    },
    async get(id) {
      return store.get(id) ?? null;
    },
  };
}
