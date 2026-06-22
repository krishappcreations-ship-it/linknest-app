/**
 * Tags slice — flat domain CRUD with optimistic + inverse rollback (per ADR-001).
 *
 * Mirrors bookmarks/folders slice patterns:
 *   - Pure reducers return { next, inverse }.
 *   - Adapter-agnostic; the apply* effect helpers (Task 4 + 5) own persistence.
 *   - Branded TagId for type-safety at the boundary.
 *
 * State shape:
 *   - byId    → all tags, indexed by id for O(1) reads.
 *   - order   → ids in createdAt ASC for sidebar stability.
 */

import { hashColor, type Tag, type TagId } from "@/types";

export interface TagsState {
  byId: Record<string, Tag>;
  order: TagId[];
}

export const initialTagsState: TagsState = {
  byId: {},
  order: [],
};

export type Inverse = (state: TagsState) => TagsState;
export interface ReducerResult {
  next: TagsState;
  inverse: Inverse;
}

/* ---------- Pure reducers ---------- */

export function addTag(state: TagsState, tag: Tag): ReducerResult {
  const byId = { ...state.byId, [tag.id]: tag };
  const order = [...state.order, tag.id];
  const next: TagsState = { byId, order };
  const inverse: Inverse = (s) => {
    const restored = { ...s.byId };
    delete restored[tag.id];
    return { byId: restored, order: s.order.filter((id) => id !== tag.id) };
  };
  return { next, inverse };
}

export function renameTag(
  state: TagsState,
  id: TagId,
  name: string,
  now: number
): ReducerResult {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const updated: Tag = {
    ...prev,
    name,
    color: hashColor(name),
    updatedAt: now,
  };
  const next: TagsState = {
    byId: { ...state.byId, [id]: updated },
    order: state.order,
  };
  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: s.order,
  });
  return { next, inverse };
}

export function removeTag(state: TagsState, id: TagId): ReducerResult {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const prevIndex = state.order.indexOf(id);
  const byId = { ...state.byId };
  delete byId[id];
  const order = state.order.filter((x) => x !== id);
  const next: TagsState = { byId, order };
  const inverse: Inverse = (s) => {
    const restoredOrder = [...s.order];
    restoredOrder.splice(prevIndex, 0, id);
    return { byId: { ...s.byId, [id]: prev }, order: restoredOrder };
  };
  return { next, inverse };
}

export function tombstoneTag(
  state: TagsState,
  id: TagId,
  now: number
): ReducerResult {
  const prev = state.byId[id];
  if (!prev || prev.deletedAt !== null) {
    return { next: state, inverse: (s) => s };
  }
  const updated: Tag = { ...prev, deletedAt: now, updatedAt: now };
  const byId = { ...state.byId, [id]: updated };
  const order = state.order.filter((x) => x !== id);
  const next: TagsState = { byId, order };
  const inverse: Inverse = (s) => {
    const restored = { ...s.byId, [id]: prev };
    return { byId: restored, order: [...s.order, id] };
  };
  return { next, inverse };
}

/* ---------- Selectors ---------- */

export function selectTagById(state: TagsState, id: TagId): Tag | null {
  const t = state.byId[id];
  return t && t.deletedAt === null ? t : null;
}

export function selectTagByNameInsensitive(
  state: TagsState,
  name: string
): Tag | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  for (const id of state.order) {
    const tag = state.byId[id];
    if (tag && tag.deletedAt === null && tag.name.toLowerCase() === needle) {
      return tag;
    }
  }
  return null;
}

export function selectVisibleTags(state: TagsState): Tag[] {
  const out: Tag[] = [];
  for (const id of state.order) {
    const tag = state.byId[id];
    if (tag && tag.deletedAt === null) out.push(tag);
  }
  return out;
}

export function selectTagsByIds(state: TagsState, ids: TagId[]): Tag[] {
  const out: Tag[] = [];
  for (const id of ids) {
    const tag = state.byId[id];
    if (tag && tag.deletedAt === null) out.push(tag);
  }
  return out;
}

/* ---------- Apply* helpers (effectful — slice + adapter) ---------- */

import { TagInputSchema, buildTag } from "@/types";
import type { TagInput } from "@/types";
import type { TagsAdapter } from "@/lib/db/tags-adapter";

export interface ApplyTagOptions {
  adapter: TagsAdapter;
  now?: () => number;
  id?: () => TagId;
  sync?: import("@/lib/sync/types").SyncAdapter;
  userId?: string;
  onSyncError?: (err: unknown) => void;
}

function fireSyncTag(
  t: Tag,
  opts: {
    sync?: import("@/lib/sync/types").SyncAdapter;
    userId?: string;
    onSyncError?: (err: unknown) => void;
  }
) {
  if (!opts.sync || !opts.userId) return;
  opts.sync.putTag(opts.userId, t).catch((err) => {
    opts.onSyncError?.(err);
  });
}

export type CreateOrGetTagOutcome =
  | { kind: "added"; tag: Tag; state: TagsState }
  | { kind: "existing"; tag: Tag; state: TagsState }
  | { kind: "error"; error: Error; state: TagsState };

export async function applyCreateOrGetTag(
  state: TagsState,
  input: TagInput,
  ctx: ApplyTagOptions
): Promise<CreateOrGetTagOutcome> {
  const parsed = TagInputSchema.parse(input);
  const existing = selectTagByNameInsensitive(state, parsed.name);
  if (existing) {
    return { kind: "existing", tag: existing, state };
  }
  const tag = buildTag(parsed, { now: ctx.now, id: ctx.id });
  const { next, inverse } = addTag(state, tag);
  try {
    await ctx.adapter.put(tag);
    fireSyncTag(tag, ctx);
    return { kind: "added", tag, state: next };
  } catch (err) {
    return {
      kind: "error",
      error: err instanceof Error ? err : new Error(String(err)),
      state: inverse(next),
    };
  }
}

export async function applyRenameTag(
  state: TagsState,
  id: TagId,
  name: string,
  ctx: ApplyTagOptions
): Promise<{ state: TagsState; rolledBack: boolean; error?: unknown }> {
  const now = (ctx.now ?? Date.now)();
  const trimmed = name.trim();
  if (!trimmed) return { state, rolledBack: false };
  // Collision guard — case-insensitive against OTHER tags (allow renaming to a case-variant of self)
  for (const otherId of state.order) {
    if (otherId === id) continue;
    const other = state.byId[otherId];
    if (other && other.name.toLowerCase() === trimmed.toLowerCase()) {
      return { state, rolledBack: false, error: "collision" };
    }
  }
  const { next, inverse } = renameTag(state, id, trimmed, now);
  if (next === state) return { state, rolledBack: false };
  const updated = next.byId[id];
  if (!updated) return { state, rolledBack: false };
  try {
    await ctx.adapter.put(updated);
    fireSyncTag(updated, ctx);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

/**
 * Sync-driven inbound upsert. Handles tombstones from cloud:
 * incoming row with deletedAt !== null → tombstoneTag if local has it.
 */
export function upsertFromSync(state: TagsState, t: Tag): TagsState {
  const exists = state.byId[t.id];
  if (exists && exists.updatedAt >= t.updatedAt) return state; // LWW guard (F13)
  if (t.deletedAt !== null) {
    if (state.byId[t.id]) {
      return tombstoneTag(state, t.id, t.deletedAt).next;
    }
    return state;
  }
  return addTag(state, t).next;
}

export interface ApplyDeleteTagOptions {
  adapter: TagsAdapter;
  now?: () => number;
  sync?: import("@/lib/sync/types").SyncAdapter;
  userId?: string;
  onSyncError?: (err: unknown) => void;
}

/**
 * Tombstones a tag. Per spec §5.6 + Q3: NO bookmark cascade — bookmarks
 * retain ghost tag id references in tagIds[]; selectors (selectTagsByIds)
 * filter tombstoned tags out at read time.
 */
export async function applyDeleteTag(
  state: TagsState,
  id: TagId,
  ctx: ApplyDeleteTagOptions
): Promise<{ state: TagsState; rolledBack: boolean; error?: unknown }> {
  const prev = state.byId[id];
  if (!prev || prev.deletedAt !== null) {
    return { state, rolledBack: false };
  }
  const now = (ctx.now ?? Date.now)();
  const { next, inverse } = tombstoneTag(state, id, now);
  if (next === state) return { state, rolledBack: false };
  const tombstoned = next.byId[id];
  if (!tombstoned) return { state, rolledBack: false };
  try {
    await ctx.adapter.put(tombstoned);
    fireSyncTag(tombstoned, ctx);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}
