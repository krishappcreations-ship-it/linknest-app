/**
 * Bookmarks slice — domain CRUD with optimistic updates and inverse-mutation
 * rollback (per ADR-001).
 *
 * Phase 3 prototype: only the action shape + optimistic pattern. Real
 * implementation lands in Phase 5 (feature 01).
 *
 * The slice is intentionally adapter-agnostic — pass in any BookmarksAdapter
 * (Dexie in prod, memory in tests). This is the seam that lets us prove
 * optimistic + rollback without a real IndexedDB.
 */

import {
  BookmarkInputSchema,
  buildBookmark,
  type Bookmark,
  type BookmarkId,
  type BookmarkInput,
} from "@/types";
import { canonicalizeUrl } from "@/lib/dedupe/canonicalize";
import type { BookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import type { SyncAdapter } from "@/lib/sync/types";

interface SyncOpts {
  sync?: SyncAdapter;
  userId?: string;
  onSyncError?: (err: unknown) => void;
}

function fireSyncBookmark(b: Bookmark, opts: SyncOpts) {
  if (!opts.sync || !opts.userId) return;
  opts.sync.putBookmark(opts.userId, b).catch((err) => {
    opts.onSyncError?.(err);
  });
}

/* ---------- Slice state shape ---------- */

export interface BookmarksState {
  /** Indexed by id for O(1) selectors. */
  byId: Record<string, Bookmark>;
  /** Insertion order (most-recent first) for default list rendering. */
  order: BookmarkId[];
}

export const initialBookmarksState: BookmarksState = {
  byId: {},
  order: [],
};

/* ---------- Inverse mutations ----------
 *
 * Every action returns a closure that undoes it. On Phase 8 (Supabase sync),
 * if a remote write fails, we call the inverse before surfacing the error
 * to the user — the UI never lies for more than a frame.
 */

export type Inverse = (state: BookmarksState) => BookmarksState;

/* ---------- Pure reducers ---------- */

export function addBookmark(
  state: BookmarksState,
  b: Bookmark
): { next: BookmarksState; inverse: Inverse } {
  const existed = state.byId[b.id];
  const next: BookmarksState = {
    byId: { ...state.byId, [b.id]: b },
    order: existed ? state.order : [b.id, ...state.order],
  };
  const inverse: Inverse = (s) =>
    existed
      ? { byId: { ...s.byId, [b.id]: existed }, order: s.order }
      : {
          byId: dropKey(s.byId, b.id),
          order: s.order.filter((id) => id !== b.id),
        };
  return { next, inverse };
}

export function removeBookmark(
  state: BookmarksState,
  id: BookmarkId
): { next: BookmarksState; inverse: Inverse } {
  const existing = state.byId[id];
  if (!existing) {
    return { next: state, inverse: (s) => s };
  }
  const next: BookmarksState = {
    byId: dropKey(state.byId, id),
    order: state.order.filter((x) => x !== id),
  };
  const oldIndex = state.order.indexOf(id);
  const inverse: Inverse = (s) => {
    const order = [...s.order];
    order.splice(oldIndex, 0, id);
    return {
      byId: { ...s.byId, [id]: existing },
      order,
    };
  };
  return { next, inverse };
}

export function updateBookmark(
  state: BookmarksState,
  id: BookmarkId,
  patch: Partial<Omit<Bookmark, "id">>,
  now: number
): { next: BookmarksState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) {
    return { next: state, inverse: (s) => s };
  }
  const updated: Bookmark = { ...prev, ...patch, id: prev.id, updatedAt: now };
  const next: BookmarksState = {
    byId: { ...state.byId, [id]: updated },
    order: state.order,
  };
  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: s.order,
  });
  return { next, inverse };
}

/* ---------- Soft delete + restore (feature 01) ---------- */

export function softRemoveBookmark(
  state: BookmarksState,
  id: BookmarkId,
  now: number
): { next: BookmarksState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  if (prev.deletedAt !== null) return { next: state, inverse: (s) => s };
  const tombstoned: Bookmark = { ...prev, deletedAt: now, updatedAt: now };
  const next: BookmarksState = {
    byId: { ...state.byId, [id]: tombstoned },
    order: state.order,
  };
  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: s.order,
  });
  return { next, inverse };
}

export function restoreBookmark(
  state: BookmarksState,
  id: BookmarkId,
  now: number
): { next: BookmarksState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  if (prev.deletedAt === null) return { next: state, inverse: (s) => s };
  const restored: Bookmark = { ...prev, deletedAt: null, updatedAt: now };
  const next: BookmarksState = {
    byId: { ...state.byId, [id]: restored },
    order: state.order,
  };
  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: s.order,
  });
  return { next, inverse };
}

/* ---------- Reorder + move (feature 05) ---------- */

export function reorderBookmark(
  state: BookmarksState,
  args: { fromIdx: number; toIdx: number }
): { next: BookmarksState; inverse: Inverse } {
  const { fromIdx, toIdx } = args;
  if (
    fromIdx === toIdx ||
    fromIdx < 0 ||
    fromIdx >= state.order.length ||
    toIdx < 0 ||
    toIdx >= state.order.length
  ) {
    return { next: state, inverse: (s) => s };
  }
  const order = [...state.order];
  const [moved] = order.splice(fromIdx, 1);
  order.splice(toIdx, 0, moved!);
  const next: BookmarksState = { byId: state.byId, order };
  const inverse: Inverse = (s) => {
    const undo = [...s.order];
    const [m] = undo.splice(toIdx, 1);
    undo.splice(fromIdx, 0, m!);
    return { byId: s.byId, order: undo };
  };
  return { next, inverse };
}

export function moveBookmarkToFolder(
  state: BookmarksState,
  args: {
    id: BookmarkId;
    folderId: FolderId | null;
    insertAfterId: BookmarkId | null;
  }
): { next: BookmarksState; inverse: Inverse } {
  const { id, folderId, insertAfterId } = args;
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };

  const updated: Bookmark = { ...prev, folderId };

  const without = state.order.filter((x) => x !== id);

  let insertAt: number;
  if (insertAfterId !== null) {
    const i = without.indexOf(insertAfterId);
    insertAt = i === -1 ? without.length : i + 1;
  } else {
    const firstSibling = without.find(
      (otherId) => state.byId[otherId]?.folderId === folderId
    );
    insertAt =
      firstSibling === undefined
        ? without.length
        : without.indexOf(firstSibling);
  }

  const order = [...without];
  order.splice(insertAt, 0, id);

  const next: BookmarksState = {
    byId: { ...state.byId, [id]: updated },
    order,
  };

  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: state.order,
  });

  return { next, inverse };
}

/* ---------- Duplicate detection (feature 01; canonical key F29) ----------
 *
 * Matches via canonicalizeUrl (normalizeUrl + tracking-param + fragment strip)
 * so utm/fbclid/share-fragment variants of the same page collide. Tombstoned
 * rows are SKIPPED so re-adding a recently-deleted url during the 5s undo
 * window is treated as a fresh add. Acceptable edge: brief presence of two rows
 * in rare rapid-fire flow; user sees only one (tombstone filtered from reads).
 */

export function findBookmarkByUrl(
  state: BookmarksState,
  url: string
): Bookmark | null {
  let canonical: string;
  try {
    canonical = canonicalizeUrl(url);
  } catch {
    return null;
  }
  for (const id of state.order) {
    const b = state.byId[id];
    if (!b || b.deletedAt !== null) continue;
    try {
      if (canonicalizeUrl(b.url) === canonical) return b;
    } catch {
      // skip malformed stored url
    }
  }
  return null;
}

/* ---------- Helpers ---------- */

function dropKey<T extends Record<string, unknown>>(obj: T, key: string): T {
  const next = { ...obj } as Record<string, unknown>;
  delete next[key];
  return next as T;
}

/* ---------- Effectful action — orchestrates pure reducer + adapter ----------
 *
 * Pattern: apply optimistic mutation; persist; on failure call inverse.
 * Returns the final state (with inverse already applied if rollback occurred).
 *
 * The Phase 5 Zustand slice will wrap these in `set()` calls; for Phase 3 we
 * keep them pure to exercise the contract under vitest.
 */

export interface ApplyOptions {
  adapter: BookmarksAdapter;
  /** Override Date.now() for deterministic tests. */
  now?: () => number;
  /** Optional cloud sync — provided by store when signed in. */
  sync?: SyncAdapter;
  /** Required when sync is present. */
  userId?: string;
  /** Called on sync failure (fire-and-forget); typically emits a toast. */
  onSyncError?: (err: unknown) => void;
}

/**
 * applyAddBookmark — feature 01.
 *
 * Takes a BookmarkInput (form values) instead of a fully-built Bookmark,
 * runs duplicate detection against the slice via findBookmarkByUrl,
 * builds the Bookmark with optional now/id seams, and persists optimistically.
 *
 * Returns a tagged union so callers branch declaratively on outcome.
 */
export type AddBookmarkOutcome =
  | { kind: "added"; bookmark: Bookmark; state: BookmarksState }
  | { kind: "duplicate"; existing: Bookmark; state: BookmarksState }
  | { kind: "error"; error: Error; state: BookmarksState };

export interface ApplyAddContext {
  adapter: BookmarksAdapter;
  now?: () => number;
  id?: () => BookmarkId;
  sync?: SyncAdapter;
  userId?: string;
  onSyncError?: (err: unknown) => void;
}

export async function applyAddBookmark(
  state: BookmarksState,
  input: BookmarkInput,
  ctx: ApplyAddContext
): Promise<AddBookmarkOutcome> {
  const parsed = BookmarkInputSchema.parse(input);
  const dup = findBookmarkByUrl(state, parsed.url);
  if (dup) {
    return { kind: "duplicate", existing: dup, state };
  }
  const bookmark = buildBookmark(parsed, { now: ctx.now, id: ctx.id });
  const { next, inverse } = addBookmark(state, bookmark);
  try {
    await ctx.adapter.put(bookmark);
    fireSyncBookmark(bookmark, ctx);
    return { kind: "added", bookmark, state: next };
  } catch (err) {
    return {
      kind: "error",
      error: err instanceof Error ? err : new Error(String(err)),
      state: inverse(next),
    };
  }
}

/**
 * Commit a prebuilt asset (image/pdf) bookmark — already uploaded to Storage.
 * Same persist + sync path as applyAddBookmark; no URL dedup (assets have none).
 */
export async function applyAddAsset(
  state: BookmarksState,
  asset: Bookmark,
  ctx: ApplyAddContext
): Promise<
  | { kind: "added"; bookmark: Bookmark; state: BookmarksState }
  | { kind: "error"; error: Error; state: BookmarksState }
> {
  const { next, inverse } = addBookmark(state, asset);
  try {
    await ctx.adapter.put(asset);
    fireSyncBookmark(asset, ctx);
    return { kind: "added", bookmark: asset, state: next };
  } catch (err) {
    return {
      kind: "error",
      error: err instanceof Error ? err : new Error(String(err)),
      state: inverse(next),
    };
  }
}

export async function applyRemoveBookmark(
  state: BookmarksState,
  id: BookmarkId,
  opts: ApplyOptions
): Promise<{ state: BookmarksState; rolledBack: boolean; error?: unknown }> {
  const prev = state.byId[id];
  const { next, inverse } = removeBookmark(state, id);
  if (next === state) return { state, rolledBack: false };
  try {
    await opts.adapter.remove(id);
    // Bulk hard-delete: build tombstone so cloud + other devices learn of delete.
    if (prev) {
      const now = (opts.now ?? Date.now)();
      const tombstone: Bookmark = { ...prev, deletedAt: now, updatedAt: now };
      fireSyncBookmark(tombstone, opts);
    }
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

/* ---------- Apply* actions for feature 01 ----------
 *
 * Each follows the canonical pattern:
 *   1. Pure reducer produces { next, inverse }.
 *   2. If next === state (no-op), return early without touching the adapter.
 *   3. Optimistic state already in `next`; await adapter.put or .remove.
 *   4. On throw, return inverse(next) and rolledBack=true.
 *
 * Soft-remove and restore both persist via adapter.put because they update
 * an existing row (deletedAt field flip). Evict uses adapter.remove because
 * the row is gone for good.
 */

export async function applyUpdateBookmark(
  state: BookmarksState,
  id: BookmarkId,
  patch: Partial<Omit<Bookmark, "id" | "createdAt">>,
  opts: ApplyOptions
): Promise<{ state: BookmarksState; rolledBack: boolean; error?: unknown }> {
  const now = (opts.now ?? Date.now)();
  const { next, inverse } = updateBookmark(state, id, patch, now);
  if (next === state) return { state, rolledBack: false };
  const updated = next.byId[id];
  if (!updated) return { state, rolledBack: false };
  try {
    await opts.adapter.put(updated);
    fireSyncBookmark(updated, opts);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

export async function applySoftRemoveBookmark(
  state: BookmarksState,
  id: BookmarkId,
  opts: ApplyOptions
): Promise<{ state: BookmarksState; rolledBack: boolean; error?: unknown }> {
  const now = (opts.now ?? Date.now)();
  const { next, inverse } = softRemoveBookmark(state, id, now);
  if (next === state) return { state, rolledBack: false };
  const tombstoned = next.byId[id];
  if (!tombstoned) return { state, rolledBack: false };
  try {
    await opts.adapter.put(tombstoned);
    fireSyncBookmark(tombstoned, opts);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

export async function applyRestoreBookmark(
  state: BookmarksState,
  id: BookmarkId,
  opts: ApplyOptions
): Promise<{ state: BookmarksState; rolledBack: boolean; error?: unknown }> {
  const now = (opts.now ?? Date.now)();
  const { next, inverse } = restoreBookmark(state, id, now);
  if (next === state) return { state, rolledBack: false };
  const restored = next.byId[id];
  if (!restored) return { state, rolledBack: false };
  try {
    await opts.adapter.put(restored);
    fireSyncBookmark(restored, opts);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

export async function applyEvictBookmark(
  state: BookmarksState,
  id: BookmarkId,
  ctx: { adapter: BookmarksAdapter }
): Promise<{ state: BookmarksState; rolledBack: boolean; error?: unknown }> {
  // Evict is the hard-delete tail of soft-delete (5s undo timer expired).
  // Tombstone already crossed to cloud during applySoftRemoveBookmark,
  // so no sync fire needed here.
  const { next, inverse } = removeBookmark(state, id);
  if (next === state) return { state, rolledBack: false };
  try {
    await ctx.adapter.remove(id);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

/* ---------- Selectors (feature 01) ----------
 *
 * All selectors filter out tombstoned rows so callers never see them.
 * Tombstone visibility is an implementation detail of soft-delete.
 */

export function selectVisibleBookmarks(state: BookmarksState): Bookmark[] {
  const out: Bookmark[] = [];
  for (const id of state.order) {
    const b = state.byId[id];
    if (b && b.deletedAt === null) out.push(b);
  }
  return out;
}

export function selectBookmarkById(
  state: BookmarksState,
  id: BookmarkId
): Bookmark | null {
  return state.byId[id] ?? null;
}

export function selectVisibleCount(state: BookmarksState): number {
  let n = 0;
  for (const id of state.order) {
    const b = state.byId[id];
    if (b && b.deletedAt === null) n++;
  }
  return n;
}

/** F34: count of non-tombstoned bookmarks whose last check found them broken. */
export function selectBrokenCount(state: BookmarksState): number {
  let n = 0;
  for (const id of state.order) {
    const b = state.byId[id];
    if (b && b.deletedAt === null && b.linkStatus === "broken") n++;
  }
  return n;
}

/* ---------- Preview helpers (feature 02) ----------
 *
 * Bumps the previewAttempt counter so worker results that started before
 * a manual refresh are discarded on write-back. applyUpdatePreviewSuccess
 * and applyUpdatePreviewFailure both no-op when:
 *   - the bookmark is gone
 *   - the bookmark is tombstoned (deletedAt !== null)
 *   - the expectedAttempt doesn't match the stored attempt
 * This is the ghost-write guard from spec §5.4.2 + §5.4.3.
 *
 * Note the result shape: { state, wrote, error? } — NOT the
 * { state, rolledBack } shape of sibling apply* methods. The guards run
 * BEFORE optimistic state assembly, so on adapter throw there is no
 * rollback to perform — we just return the original state with wrote=false.
 */

export function bumpPreviewAttempt(
  state: BookmarksState,
  id: BookmarkId,
  now: number
): { next: BookmarksState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const updated: Bookmark = {
    ...prev,
    previewStatus: "pending",
    previewFailureKind: null,
    previewAttempt: prev.previewAttempt + 1,
    updatedAt: now,
  };
  const next: BookmarksState = {
    byId: { ...state.byId, [id]: updated },
    order: state.order,
  };
  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: s.order,
  });
  return { next, inverse };
}

export interface ApplyPreviewSuccessArgs {
  id: BookmarkId;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  faviconUrl: string | null;
  expectedAttempt: number;
}

export async function applyUpdatePreviewSuccess(
  state: BookmarksState,
  args: ApplyPreviewSuccessArgs,
  opts: ApplyOptions
): Promise<{ state: BookmarksState; wrote: boolean; error?: unknown }> {
  const prev = state.byId[args.id];
  if (!prev || prev.deletedAt !== null) {
    return { state, wrote: false };
  }
  if (prev.previewAttempt !== args.expectedAttempt) {
    return { state, wrote: false };
  }
  const now = (opts.now ?? Date.now)();
  const updated: Bookmark = {
    ...prev,
    title: args.title?.trim() || prev.title,
    description: args.description?.trim() || prev.description,
    previewImageUrl: args.imageUrl,
    faviconUrl: args.faviconUrl ?? prev.faviconUrl,
    previewStatus: "ready",
    previewFailureKind: null,
    updatedAt: now,
  };
  const next: BookmarksState = {
    byId: { ...state.byId, [args.id]: updated },
    order: state.order,
  };
  try {
    await opts.adapter.put(updated);
    fireSyncBookmark(updated, opts);
    return { state: next, wrote: true };
  } catch (err) {
    return { state, wrote: false, error: err };
  }
}

export interface ApplyPreviewFailureArgs {
  id: BookmarkId;
  kind: "transient" | "permanent";
  expectedAttempt: number;
}

export async function applyUpdatePreviewFailure(
  state: BookmarksState,
  args: ApplyPreviewFailureArgs,
  opts: ApplyOptions
): Promise<{ state: BookmarksState; wrote: boolean; error?: unknown }> {
  const prev = state.byId[args.id];
  if (!prev || prev.deletedAt !== null) {
    return { state, wrote: false };
  }
  if (prev.previewAttempt !== args.expectedAttempt) {
    return { state, wrote: false };
  }
  const now = (opts.now ?? Date.now)();
  const updated: Bookmark = {
    ...prev,
    previewStatus: "failed",
    previewFailureKind: args.kind,
    updatedAt: now,
  };
  const next: BookmarksState = {
    byId: { ...state.byId, [args.id]: updated },
    order: state.order,
  };
  try {
    await opts.adapter.put(updated);
    fireSyncBookmark(updated, opts);
    return { state: next, wrote: true };
  } catch (err) {
    return { state, wrote: false, error: err };
  }
}

import type { FoldersState } from "@/store/slices/folders-slice";
import { selectFolderSubtreeIds } from "@/store/slices/folders-slice";
import type { FolderId, TagId, ReadState } from "@/types";

export type SelectedFolderFilter =
  | { kind: "all" }
  | { kind: "unfiled" }
  | { kind: "subtree"; id: FolderId };

/** Content type used by the in-folder Links/Images/PDFs filter. */
export type ContentKind = "link" | "image" | "pdf";

/** Maps a bookmark to its content type; undefined/"link" both ⇒ "link". */
export function effectiveContentKind(b: Bookmark): ContentKind {
  return b.kind === "image" || b.kind === "pdf" ? b.kind : "link";
}

export function selectFilteredBookmarks(args: {
  bookmarks: BookmarksState;
  folders: FoldersState;
  filter: SelectedFolderFilter;
  tagFilter?: TagId | null;
  readStateFilter?: ReadState | null;
  /** "prompt" = only prompts (Prompts view); default = exclude prompts. */
  kindFilter?: "prompt" | null;
  /** Within the Prompts view, narrow to a category. */
  promptCategory?: string | null;
  /** Within non-prompt views, narrow to a content type (link/image/pdf). */
  contentType?: ContentKind | null;
}): Bookmark[] {
  const onlyPrompts = args.kindFilter === "prompt";
  let filtered = selectVisibleBookmarks(args.bookmarks).filter((b) =>
    onlyPrompts ? b.kind === "prompt" : b.kind !== "prompt"
  );
  if (!onlyPrompts && args.contentType != null) {
    const ct = args.contentType;
    filtered = filtered.filter((b) => effectiveContentKind(b) === ct);
  }
  switch (args.filter.kind) {
    case "all":
      break;
    case "unfiled":
      filtered = filtered.filter((b) => b.folderId === null);
      break;
    case "subtree": {
      const subtree = selectFolderSubtreeIds(args.folders, args.filter.id);
      filtered = filtered.filter(
        (b) => b.folderId !== null && subtree.has(b.folderId)
      );
      break;
    }
  }
  if (onlyPrompts && args.promptCategory != null) {
    filtered = filtered.filter((b) => b.promptCategory === args.promptCategory);
  }
  if (args.tagFilter !== null && args.tagFilter !== undefined) {
    const tagId = args.tagFilter;
    filtered = filtered.filter((b) => b.tagIds.includes(tagId));
  }
  if (args.readStateFilter == null) {
    filtered = filtered.filter((b) => b.readState !== "archived");
  } else {
    const rs = args.readStateFilter;
    filtered = filtered.filter((b) => b.readState === rs);
  }
  return filtered;
}

export function setBookmarkTags(
  state: BookmarksState,
  id: BookmarkId,
  tagIds: TagId[],
  now: number
): { next: BookmarksState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const updated: Bookmark = { ...prev, tagIds, updatedAt: now };
  const next: BookmarksState = {
    byId: { ...state.byId, [id]: updated },
    order: state.order,
  };
  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: s.order,
  });
  return { next, inverse };
}

/* ---------- Capture state (feature 23) ---------- */

export function bumpCaptureAttempt(
  state: BookmarksState,
  id: BookmarkId,
  now: number
): { next: BookmarksState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const updated: Bookmark = {
    ...prev,
    captureStatus: "pending",
    captureFailureKind: null,
    captureAttempt: prev.captureAttempt + 1,
    updatedAt: now,
  };
  const next: BookmarksState = {
    byId: { ...state.byId, [id]: updated },
    order: state.order,
  };
  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: s.order,
  });
  return { next, inverse };
}

export interface ApplyCaptureSuccessArgs {
  id: BookmarkId;
  expectedAttempt: number;
}

export async function applyUpdateCaptureSuccess(
  state: BookmarksState,
  args: ApplyCaptureSuccessArgs,
  opts: ApplyOptions
): Promise<{ state: BookmarksState; wrote: boolean; error?: unknown }> {
  const prev = state.byId[args.id];
  if (!prev || prev.deletedAt !== null) return { state, wrote: false };
  if (prev.captureAttempt !== args.expectedAttempt)
    return { state, wrote: false };
  const now = (opts.now ?? Date.now)();
  const updated: Bookmark = {
    ...prev,
    captureStatus: "ready",
    captureFailureKind: null,
    updatedAt: now,
  };
  const next: BookmarksState = {
    byId: { ...state.byId, [args.id]: updated },
    order: state.order,
  };
  try {
    await opts.adapter.put(updated);
    fireSyncBookmark(updated, opts);
    return { state: next, wrote: true };
  } catch (err) {
    return { state, wrote: false, error: err };
  }
}

export interface ApplyCaptureFailureArgs {
  id: BookmarkId;
  kind: "transient" | "permanent";
  expectedAttempt: number;
}

export async function applyUpdateCaptureFailure(
  state: BookmarksState,
  args: ApplyCaptureFailureArgs,
  opts: ApplyOptions
): Promise<{ state: BookmarksState; wrote: boolean; error?: unknown }> {
  const prev = state.byId[args.id];
  if (!prev || prev.deletedAt !== null) return { state, wrote: false };
  if (prev.captureAttempt !== args.expectedAttempt)
    return { state, wrote: false };
  const now = (opts.now ?? Date.now)();
  const updated: Bookmark = {
    ...prev,
    captureStatus: "failed",
    captureFailureKind: args.kind,
    updatedAt: now,
  };
  const next: BookmarksState = {
    byId: { ...state.byId, [args.id]: updated },
    order: state.order,
  };
  try {
    await opts.adapter.put(updated);
    fireSyncBookmark(updated, opts);
    return { state: next, wrote: true };
  } catch (err) {
    return { state, wrote: false, error: err };
  }
}

/* ---------- Read-state transition (feature 22) ---------- */

export function setReadState(
  state: BookmarksState,
  id: BookmarkId,
  readState: ReadState,
  now: number
): { next: BookmarksState; inverse: Inverse } {
  const prev = state.byId[id];
  if (!prev) return { next: state, inverse: (s) => s };
  const updated: Bookmark = { ...prev, readState, updatedAt: now };
  const next: BookmarksState = {
    byId: { ...state.byId, [id]: updated },
    order: state.order,
  };
  const inverse: Inverse = (s) => ({
    byId: { ...s.byId, [id]: prev },
    order: s.order,
  });
  return { next, inverse };
}

export async function applySetReadState(
  state: BookmarksState,
  args: { id: BookmarkId; readState: ReadState },
  opts: ApplyOptions
): Promise<{ state: BookmarksState; rolledBack: boolean; error?: unknown }> {
  const prev = state.byId[args.id];
  if (!prev || prev.readState === args.readState) {
    return { state, rolledBack: false };
  }
  const now = (opts.now ?? Date.now)();
  const { next, inverse } = setReadState(state, args.id, args.readState, now);
  const moved = next.byId[args.id]!;
  try {
    await opts.adapter.put(moved);
    fireSyncBookmark(moved, opts);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

/* ---------- Reorder + move apply helpers (feature 05) ---------- */

export async function applyReorderBookmark(
  state: BookmarksState,
  args: { fromIdx: number; toIdx: number },
  opts: ApplyOptions
): Promise<{ state: BookmarksState; rolledBack: boolean; error?: unknown }> {
  const { next, inverse } = reorderBookmark(state, args);
  if (next === state) return { state, rolledBack: false };
  const movedId = next.order[args.toIdx]!;
  const moved = next.byId[movedId];
  if (!moved) return { state, rolledBack: false };
  try {
    await opts.adapter.put(moved);
    fireSyncBookmark(moved, opts);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

export async function applyMoveBookmarkToFolder(
  state: BookmarksState,
  args: {
    id: BookmarkId;
    folderId: FolderId | null;
    insertAfterId: BookmarkId | null;
  },
  opts: ApplyOptions
): Promise<{ state: BookmarksState; rolledBack: boolean; error?: unknown }> {
  const { next, inverse } = moveBookmarkToFolder(state, args);
  if (next === state) return { state, rolledBack: false };
  const moved = next.byId[args.id];
  if (!moved) return { state, rolledBack: false };
  try {
    await opts.adapter.put(moved);
    fireSyncBookmark(moved, opts);
    return { state: next, rolledBack: false };
  } catch (err) {
    return { state: inverse(next), rolledBack: true, error: err };
  }
}

/**
 * Sync-driven inbound upsert (no inverse — cloud is canonical when called).
 * Used by sync-bootstrap.mergeLwwIntoLocal to hydrate slice from cloud rows.
 */
export function upsertFromSync(
  state: BookmarksState,
  b: Bookmark
): BookmarksState {
  const exists = state.byId[b.id];
  if (exists && exists.updatedAt >= b.updatedAt) return state; // LWW guard (F13)
  const order = exists ? state.order : [...state.order, b.id];
  return {
    byId: { ...state.byId, [b.id]: b },
    order,
  };
}
