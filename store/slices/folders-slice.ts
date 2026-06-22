/**
 * Folders slice — domain CRUD with optimistic + inverse rollback (per ADR-001).
 *
 * Mirrors bookmarks-slice patterns:
 *   - Pure reducers return { next, inverse }.
 *   - Adapter-agnostic; the apply* effect helpers (Task 4) own persistence.
 *   - Branded FolderId for type-safety at the boundary.
 *
 * Denormalized state:
 *   - byId      → all folders, indexed by id for O(1) reads.
 *   - rootIds   → depth-0 ids in [pinned DESC, order ASC].
 *   - childrenByParent → parentId → child ids in [order ASC] (depth 1-2).
 *
 * These indices are kept fresh by every reducer. Cheap (~30 folders typical).
 */

import type { Folder, FolderId } from "@/types";

/* ---------- State ---------- */

export interface FoldersState {
  byId: Record<string, Folder>;
  rootIds: FolderId[];
  childrenByParent: Record<string, FolderId[]>;
}

export const initialFoldersState: FoldersState = {
  byId: {},
  rootIds: [],
  childrenByParent: {},
};

export type Inverse = (state: FoldersState) => FoldersState;
export interface ReducerResult {
  next: FoldersState;
  inverse: Inverse;
}

export interface FolderRow {
  folder: Folder;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
}

/* ---------- Internal helpers ---------- */

function sortRootIds(
  byId: Record<string, Folder>,
  ids: FolderId[]
): FolderId[] {
  return [...ids].sort((a, b) => {
    const fa = byId[a]!;
    const fb = byId[b]!;
    if (fa.pinned !== fb.pinned) return fa.pinned ? -1 : 1;
    if (fa.order !== fb.order) return fa.order - fb.order;
    return fa.createdAt - fb.createdAt;
  });
}

function sortChildIds(
  byId: Record<string, Folder>,
  ids: FolderId[]
): FolderId[] {
  return [...ids].sort((a, b) => byId[a]!.order - byId[b]!.order);
}

function dropFromArray<T>(arr: T[], item: T): T[] {
  return arr.filter((x) => x !== item);
}

/* ---------- Pure reducers ---------- */

export function addFolder(state: FoldersState, folder: Folder): ReducerResult {
  const byId = { ...state.byId, [folder.id]: folder };
  let rootIds = state.rootIds;
  let childrenByParent = state.childrenByParent;

  if (folder.parentId === null) {
    rootIds = sortRootIds(byId, [...state.rootIds, folder.id]);
  } else {
    const parentKey = folder.parentId;
    const existing = childrenByParent[parentKey] ?? [];
    childrenByParent = {
      ...childrenByParent,
      [parentKey]: sortChildIds(byId, [...existing, folder.id]),
    };
  }
  const next: FoldersState = { byId, rootIds, childrenByParent };
  const inverse: Inverse = (s) => removeFolderInternal(s, folder).result;
  return { next, inverse };
}

function removeFolderInternal(
  state: FoldersState,
  folder: Folder
): { result: FoldersState } {
  const byId = { ...state.byId };
  delete byId[folder.id];
  let rootIds = state.rootIds;
  let childrenByParent = state.childrenByParent;
  if (folder.parentId === null) {
    rootIds = dropFromArray(state.rootIds, folder.id);
  } else {
    const parentKey = folder.parentId;
    childrenByParent = {
      ...childrenByParent,
      [parentKey]: dropFromArray(childrenByParent[parentKey] ?? [], folder.id),
    };
  }
  return { result: { byId, rootIds, childrenByParent } };
}

export function renameFolder(
  state: FoldersState,
  id: FolderId,
  name: string,
  now: number
): ReducerResult {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const updated: Folder = { ...prev, name, updatedAt: now };
  const byId = { ...state.byId, [id]: updated };
  const next: FoldersState = { ...state, byId };
  const inverse: Inverse = (s) => ({ ...s, byId: { ...s.byId, [id]: prev } });
  return { next, inverse };
}

export function removeFolder(state: FoldersState, id: FolderId): ReducerResult {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const { result } = removeFolderInternal(state, prev);
  const inverse: Inverse = (s) => addFolder(s, prev).next;
  return { next: result, inverse };
}

export function tombstoneFolder(
  state: FoldersState,
  id: FolderId,
  now: number
): ReducerResult {
  const prev = state.byId[id];
  if (!prev || prev.deletedAt !== null) {
    return { next: state, inverse: (s) => s };
  }
  const updated: Folder = { ...prev, deletedAt: now, updatedAt: now };
  const byId = { ...state.byId, [id]: updated };
  let rootIds = state.rootIds;
  let childrenByParent = state.childrenByParent;
  if (prev.parentId === null) {
    rootIds = dropFromArray(state.rootIds, id);
  } else {
    childrenByParent = {
      ...childrenByParent,
      [prev.parentId]: dropFromArray(childrenByParent[prev.parentId] ?? [], id),
    };
  }
  const next: FoldersState = { byId, rootIds, childrenByParent };
  const inverse: Inverse = (s) => addFolder(s, prev).next;
  return { next, inverse };
}

export function togglePinFolder(
  state: FoldersState,
  id: FolderId,
  now: number
): ReducerResult {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  if (prev.parentId !== null) return { next: state, inverse: (s) => s };
  const updated: Folder = { ...prev, pinned: !prev.pinned, updatedAt: now };
  const byId = { ...state.byId, [id]: updated };
  const rootIds = sortRootIds(byId, state.rootIds);
  const next: FoldersState = { ...state, byId, rootIds };
  const inverse: Inverse = (s) => {
    const restoredById = { ...s.byId, [id]: prev };
    return {
      ...s,
      byId: restoredById,
      rootIds: sortRootIds(restoredById, s.rootIds),
    };
  };
  return { next, inverse };
}

/* ---------- Reorder + nest (feature 05) ---------- */

export function reorderFolder(
  state: FoldersState,
  args: {
    id: FolderId;
    fromIdx: number;
    toIdx: number;
    parentId: FolderId | null;
  }
): ReducerResult {
  const { fromIdx, toIdx, parentId } = args;
  if (fromIdx === toIdx) return { next: state, inverse: (s) => s };

  const existing =
    parentId === null
      ? state.rootIds
      : (state.childrenByParent[parentId] ?? []);

  if (
    fromIdx < 0 ||
    fromIdx >= existing.length ||
    toIdx < 0 ||
    toIdx >= existing.length
  ) {
    return { next: state, inverse: (s) => s };
  }

  const reordered = [...existing];
  const [moved] = reordered.splice(fromIdx, 1);
  reordered.splice(toIdx, 0, moved!);

  let next: FoldersState;
  if (parentId === null) {
    next = { ...state, rootIds: reordered };
  } else {
    next = {
      ...state,
      childrenByParent: {
        ...state.childrenByParent,
        [parentId]: reordered,
      },
    };
  }

  const inverse: Inverse = (s) => {
    const undoList =
      parentId === null
        ? [...s.rootIds]
        : [...(s.childrenByParent[parentId] ?? [])];
    const [m] = undoList.splice(toIdx, 1);
    undoList.splice(fromIdx, 0, m!);
    return parentId === null
      ? { ...s, rootIds: undoList }
      : {
          ...s,
          childrenByParent: {
            ...s.childrenByParent,
            [parentId]: undoList,
          },
        };
  };

  return { next, inverse };
}

export function nestFolder(
  state: FoldersState,
  args: { id: FolderId; newParentId: FolderId | null }
): ReducerResult {
  const { id, newParentId } = args;
  const folder = state.byId[id];
  if (!folder) return { next: state, inverse: (s) => s };
  if (newParentId === id) return { next: state, inverse: (s) => s };

  if (newParentId !== null && isDescendantOfNest(state, newParentId, id)) {
    return { next: state, inverse: (s) => s };
  }

  const newParentDepth =
    newParentId === null ? -1 : depthOfNest(state, newParentId);
  const subtreeHeight = subtreeHeightOfNest(state, id);
  const newDepth = newParentDepth + 1;
  if (newDepth + subtreeHeight > FOLDER_MAX_DEPTH - 1) {
    return { next: state, inverse: (s) => s };
  }

  const prevParentId = folder.parentId;
  if (prevParentId === newParentId) {
    return { next: state, inverse: (s) => s };
  }

  let rootIds = state.rootIds;
  let childrenByParent = state.childrenByParent;
  if (prevParentId === null) {
    rootIds = dropFromArray(rootIds, id);
  } else {
    childrenByParent = {
      ...childrenByParent,
      [prevParentId]: dropFromArray(childrenByParent[prevParentId] ?? [], id),
    };
  }

  if (newParentId === null) {
    rootIds = [...rootIds, id];
  } else {
    childrenByParent = {
      ...childrenByParent,
      [newParentId]: [...(childrenByParent[newParentId] ?? []), id],
    };
  }

  const updated: Folder = { ...folder, parentId: newParentId };
  const byId = { ...state.byId, [id]: updated };
  const next: FoldersState = { byId, rootIds, childrenByParent };

  const inverse: Inverse = (_s) => state;
  return { next, inverse };
}

function depthOfNest(state: FoldersState, id: FolderId): number {
  let depth = 0;
  let cur = state.byId[id];
  while (cur && cur.parentId !== null) {
    depth++;
    cur = state.byId[cur.parentId];
    if (depth > FOLDER_MAX_DEPTH + 1) break;
  }
  return depth;
}

function subtreeHeightOfNest(state: FoldersState, id: FolderId): number {
  const children = state.childrenByParent[id] ?? [];
  if (children.length === 0) return 0;
  let max = 0;
  for (const childId of children) {
    const h = subtreeHeightOfNest(state, childId);
    if (h + 1 > max) max = h + 1;
  }
  return max;
}

function isDescendantOfNest(
  state: FoldersState,
  candidate: FolderId,
  ancestor: FolderId
): boolean {
  let cur = state.byId[candidate];
  while (cur && cur.parentId !== null) {
    if (cur.parentId === ancestor) return true;
    cur = state.byId[cur.parentId];
  }
  return false;
}

/* ---------- Selectors ---------- */

export function selectFolderById(
  state: FoldersState,
  id: FolderId
): Folder | null {
  const f = state.byId[id];
  return f && f.deletedAt === null ? f : null;
}

export function selectFolderDepth(state: FoldersState, id: FolderId): number {
  let depth = 0;
  let current = state.byId[id];
  while (current && current.parentId !== null) {
    current = state.byId[current.parentId];
    depth++;
    if (depth > 10) return depth; // defensive — should never happen
  }
  return depth;
}

export function selectFolderSubtreeIds(
  state: FoldersState,
  rootId: FolderId
): Set<FolderId> {
  const out = new Set<FolderId>();
  const stack: FolderId[] = [rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    const children = state.childrenByParent[id] ?? [];
    for (const c of children) stack.push(c);
  }
  return out;
}

export function selectFolderByNameInParent(
  state: FoldersState,
  parentId: FolderId | null,
  name: string
): Folder | null {
  const candidates =
    parentId === null
      ? state.rootIds
      : (state.childrenByParent[parentId] ?? []);
  for (const id of candidates) {
    const f = state.byId[id];
    if (f && f.name === name) return f;
  }
  return null;
}

export function selectFolderAncestors(
  state: FoldersState,
  id: FolderId
): Folder[] {
  const chain: Folder[] = [];
  let current = state.byId[id];
  while (current) {
    chain.unshift(current);
    if (current.parentId === null) break;
    current = state.byId[current.parentId];
  }
  return chain;
}

export function selectVisibleFolderRows(
  state: FoldersState,
  collapsed: Set<FolderId>
): FolderRow[] {
  const out: FolderRow[] = [];

  function walk(id: FolderId, depth: number) {
    const folder = state.byId[id];
    if (!folder) return;
    const children = state.childrenByParent[id] ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsed.has(id);
    out.push({ folder, depth, hasChildren, collapsed: isCollapsed });
    if (!isCollapsed) {
      for (const c of children) walk(c, depth + 1);
    }
  }

  for (const id of state.rootIds) walk(id, 0);
  return out;
}

/* ---------- Apply* helpers (effectful — slice + adapter) ---------- */

import { FolderInputSchema, buildFolder, FOLDER_MAX_DEPTH } from "@/types";
import type { FolderInput } from "@/types";
import type { FoldersAdapter } from "@/lib/db/folders-adapter";

export interface ApplyFolderOptions {
  adapter: FoldersAdapter;
  now?: () => number;
  id?: () => FolderId;
  sync?: import("@/lib/sync/types").SyncAdapter;
  userId?: string;
  onSyncError?: (err: unknown) => void;
}

function fireSyncFolder(
  f: Folder,
  opts: {
    sync?: import("@/lib/sync/types").SyncAdapter;
    userId?: string;
    onSyncError?: (err: unknown) => void;
  }
) {
  if (!opts.sync || !opts.userId) return;
  opts.sync.putFolder(opts.userId, f).catch((err) => {
    opts.onSyncError?.(err);
  });
}

export type CreateFolderOutcome =
  | { kind: "added"; folder: Folder; state: FoldersState }
  | { kind: "duplicate"; existing: Folder; state: FoldersState }
  | { kind: "depth-error"; state: FoldersState }
  | { kind: "error"; error: Error; state: FoldersState };

export async function applyCreateFolder(
  state: FoldersState,
  input: FolderInput,
  ctx: ApplyFolderOptions
): Promise<CreateFolderOutcome> {
  const parsed = FolderInputSchema.parse(input);
  const candidate: FolderInput = {
    name: parsed.name,
    parentId: input.parentId,
  };

  if (candidate.parentId !== null) {
    const depth = selectFolderDepth(state, candidate.parentId);
    if (depth + 1 >= FOLDER_MAX_DEPTH) {
      return { kind: "depth-error", state };
    }
  }

  const dup = selectFolderByNameInParent(
    state,
    candidate.parentId,
    candidate.name
  );
  if (dup) return { kind: "duplicate", existing: dup, state };

  const folder = buildFolder(candidate, { now: ctx.now, id: ctx.id });
  const { next, inverse } = addFolder(state, folder);
  try {
    await ctx.adapter.put(folder);
    fireSyncFolder(folder, ctx);
    return { kind: "added", folder, state: next };
  } catch (err) {
    return {
      kind: "error",
      error: err instanceof Error ? err : new Error(String(err)),
      state: inverse(next),
    };
  }
}

export async function applyRenameFolder(
  state: FoldersState,
  id: FolderId,
  name: string,
  ctx: ApplyFolderOptions
): Promise<{ state: FoldersState; rolledBack: boolean; error?: unknown }> {
  const now = (ctx.now ?? Date.now)();
  const trimmed = name.trim();
  if (!trimmed) return { state, rolledBack: false };
  const { next, inverse } = renameFolder(state, id, trimmed, now);
  if (next === state) return { state, rolledBack: false };
  const updated = next.byId[id];
  if (!updated) return { state, rolledBack: false };
  try {
    await ctx.adapter.put(updated);
    fireSyncFolder(updated, ctx);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

export async function applyTogglePinFolder(
  state: FoldersState,
  id: FolderId,
  ctx: ApplyFolderOptions
): Promise<{ state: FoldersState; rolledBack: boolean; error?: unknown }> {
  const now = (ctx.now ?? Date.now)();
  const { next, inverse } = togglePinFolder(state, id, now);
  if (next === state) return { state, rolledBack: false };
  const updated = next.byId[id];
  if (!updated) return { state, rolledBack: false };
  try {
    await ctx.adapter.put(updated);
    fireSyncFolder(updated, ctx);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

import type { BookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import {
  updateBookmark,
  type BookmarksState,
} from "@/store/slices/bookmarks-slice";
import type { BookmarkId } from "@/types";

export interface ApplyDeleteFolderOptions {
  adapter: FoldersAdapter;
  bookmarksAdapter: BookmarksAdapter;
  now?: () => number;
  sync?: import("@/lib/sync/types").SyncAdapter;
  userId?: string;
  onSyncError?: (err: unknown) => void;
}

export interface DeleteFolderResult {
  foldersState: FoldersState;
  bookmarksState: BookmarksState;
  deletedFolderIds: FolderId[];
  reassignedBookmarkIds: BookmarkId[];
  rolledBack: boolean;
  error?: unknown;
}

export async function applyDeleteFolder(
  foldersState: FoldersState,
  bookmarksState: BookmarksState,
  id: FolderId,
  ctx: ApplyDeleteFolderOptions
): Promise<DeleteFolderResult> {
  const root = selectFolderById(foldersState, id);
  if (!root) {
    return {
      foldersState,
      bookmarksState,
      deletedFolderIds: [],
      reassignedBookmarkIds: [],
      rolledBack: false,
    };
  }

  const subtree = selectFolderSubtreeIds(foldersState, id);
  const now = (ctx.now ?? Date.now)();

  // 1. Plan the bookmark reassignments.
  const reassignedIds: BookmarkId[] = [];
  let nextBookmarks = bookmarksState;
  const bookmarkInverses: Array<{
    id: BookmarkId;
    inverse: (s: BookmarksState) => BookmarksState;
  }> = [];

  for (const bId of bookmarksState.order) {
    const b = bookmarksState.byId[bId];
    if (!b) continue;
    if (b.folderId === null || !subtree.has(b.folderId)) continue;
    const { next: nextB, inverse } = updateBookmark(
      nextBookmarks,
      b.id,
      { folderId: null },
      now
    );
    nextBookmarks = nextB;
    reassignedIds.push(b.id);
    bookmarkInverses.push({ id: b.id, inverse });
  }

  // 2. Plan the folder tombstones (deepest-first to keep indices consistent).
  const subtreeArray = Array.from(subtree);
  subtreeArray.sort(
    (a, b) =>
      selectFolderDepth(foldersState, b) - selectFolderDepth(foldersState, a)
  );

  let nextFolders = foldersState;
  const folderInverses: Inverse[] = [];
  const tombstonedFolders: Folder[] = [];
  for (const fid of subtreeArray) {
    const { next: nextF, inverse } = tombstoneFolder(nextFolders, fid, now);
    nextFolders = nextF;
    folderInverses.push(inverse);
    const tomb = nextF.byId[fid];
    if (tomb) tombstonedFolders.push(tomb);
  }

  // 3. Persist — bookmark writes first (reversible if folder writes later fail).
  //    Folder tombstones via adapter.put (NOT adapter.remove). Sync fires
  //    per tombstone so cross-device deletes propagate.
  const bookmarkPutsDone: BookmarkId[] = [];
  const folderPutsDone: FolderId[] = [];

  try {
    for (const bId of reassignedIds) {
      const updated = nextBookmarks.byId[bId];
      if (!updated) continue;
      await ctx.bookmarksAdapter.put(updated);
      bookmarkPutsDone.push(bId);
    }
    for (const tomb of tombstonedFolders) {
      await ctx.adapter.put(tomb);
      fireSyncFolder(tomb, ctx);
      folderPutsDone.push(tomb.id);
    }
    return {
      foldersState: nextFolders,
      bookmarksState: nextBookmarks,
      deletedFolderIds: subtreeArray,
      reassignedBookmarkIds: reassignedIds,
      rolledBack: false,
    };
  } catch (err) {
    // Rollback. Bookmarks first (restore original folderId), then folders.
    let restoredBookmarks = nextBookmarks;
    for (const { id: bId, inverse } of bookmarkInverses) {
      restoredBookmarks = inverse(restoredBookmarks);
      if (bookmarkPutsDone.includes(bId)) {
        const restored = restoredBookmarks.byId[bId];
        if (restored) {
          try {
            await ctx.bookmarksAdapter.put(restored);
          } catch {
            /* best-effort */
          }
        }
      }
    }
    let restoredFolders = nextFolders;
    for (const inverse of [...folderInverses].reverse()) {
      restoredFolders = inverse(restoredFolders);
    }
    // Best-effort re-put restored (deletedAt = null) folder rows.
    for (const fid of folderPutsDone) {
      const restored = restoredFolders.byId[fid];
      if (restored) {
        try {
          await ctx.adapter.put(restored);
        } catch {
          /* best-effort */
        }
      }
    }
    return {
      foldersState: restoredFolders,
      bookmarksState: restoredBookmarks,
      deletedFolderIds: [],
      reassignedBookmarkIds: [],
      rolledBack: true,
      error: err,
    };
  }
}

/* ---------- Reorder + nest apply helpers (feature 05) ---------- */

export async function applyReorderFolder(
  state: FoldersState,
  args: {
    id: FolderId;
    fromIdx: number;
    toIdx: number;
    parentId: FolderId | null;
  },
  opts: ApplyFolderOptions
): Promise<{ state: FoldersState; rolledBack: boolean; error?: unknown }> {
  const { next, inverse } = reorderFolder(state, args);
  if (next === state) return { state, rolledBack: false };
  const folder = next.byId[args.id];
  if (!folder) return { state, rolledBack: false };
  try {
    await opts.adapter.put(folder);
    fireSyncFolder(folder, opts);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

export async function applyNestFolder(
  state: FoldersState,
  args: { id: FolderId; newParentId: FolderId | null },
  opts: ApplyFolderOptions
): Promise<{ state: FoldersState; rolledBack: boolean; error?: unknown }> {
  const { next, inverse } = nestFolder(state, args);
  if (next === state) return { state, rolledBack: false };
  const folder = next.byId[args.id];
  if (!folder) return { state, rolledBack: false };
  try {
    await opts.adapter.put(folder);
    fireSyncFolder(folder, opts);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

/**
 * Sync-driven inbound upsert (no inverse — cloud is canonical when called).
 * Used by sync-bootstrap.mergeLwwIntoLocal to hydrate slice from cloud rows.
 */
export function upsertFromSync(state: FoldersState, f: Folder): FoldersState {
  const exists = state.byId[f.id];
  if (exists && exists.updatedAt >= f.updatedAt) return state; // LWW guard (F13)
  if (f.deletedAt !== null) {
    if (state.byId[f.id]) {
      return tombstoneFolder(state, f.id, f.deletedAt).next;
    }
    return state;
  }
  return addFolder(state, f).next;
}
