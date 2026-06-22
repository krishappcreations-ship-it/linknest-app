"use client";

/**
 * useBookmarks — the only API components see for bookmark state.
 *
 * Internal getUseBookmarksApi(ctx) accepts injectable `now` / `id` so vitest
 * can exercise every code path without rendering React. The React hook
 * subscribes to the relevant slices so components re-render on changes.
 *
 * Side effects this hook owns (so components stay dumb):
 *   - Emitting toasts for duplicate (info) and error (error) outcomes of add.
 *   - Emitting Undo toast on soft-delete + scheduling 5s hard-delete via
 *     the eviction queue. Cancelling that timer on restore.
 *   - Setting focusBookmarkId on duplicate so the existing card highlights.
 */

import { useStore } from "@/store";
import { getSyncOpts } from "@/lib/sync/sync-runtime";
import { evictionQueue } from "@/store/eviction-queue";
import { removeHighlightsForBookmark } from "@/store/slices/highlights-slice";
import {
  applyAddBookmark,
  applyAddAsset,
  applyUpdateBookmark,
  applySoftRemoveBookmark,
  applyRestoreBookmark,
  applyEvictBookmark,
  applySetReadState,
  bumpPreviewAttempt,
  bumpCaptureAttempt,
  selectVisibleBookmarks,
  selectBookmarkById,
  selectVisibleCount,
} from "@/store/slices/bookmarks-slice";
import { previewWorker } from "@/store/preview-worker";
import { captureWorker } from "@/store/capture-worker";
import { embedWorker } from "@/store/embed-worker";
import {
  pushToast,
  setFocusBookmark,
  toggleSelection,
  selectRange,
  selectAll as uiSelectAll,
  clearSelection as uiClearSelection,
} from "@/store/slices/ui-slice";
import type {
  Bookmark,
  BookmarkId,
  BookmarkInput,
  ReadState,
  LinkPatch,
  FolderId,
  TagId,
} from "@/types";
import { buildAsset, buildPrompt, asBookmarkId } from "@/types";
import { uploadAsset } from "@/lib/storage/upload-asset";

const SOFT_DELETE_WINDOW_MS = 5000;

export interface AddResult {
  ok: boolean;
  reason?: "duplicate" | "error";
  bookmark?: Bookmark;
  existing?: Bookmark;
  error?: Error;
}

export interface UseBookmarks {
  bookmarks: Bookmark[];
  byId: (id: BookmarkId) => Bookmark | null;
  count: number;
  selection: BookmarkId[];
  focusBookmarkId: BookmarkId | null;

  add: (input: BookmarkInput) => Promise<AddResult>;
  addAsset: (input: {
    file: File;
    title?: string;
    folderId?: FolderId | null;
    tagIds?: TagId[];
  }) => Promise<AddResult>;
  addPrompt: (input: {
    title: string;
    body: string;
    category?: string | null;
    tagIds?: TagId[];
  }) => Promise<AddResult>;
  updatePrompt: (
    id: BookmarkId,
    patch: {
      title?: string;
      body?: string;
      category?: string | null;
      tagIds?: TagId[];
    }
  ) => Promise<void>;
  update: (
    id: BookmarkId,
    patch: Partial<BookmarkInput> & Partial<LinkPatch>
  ) => Promise<void>;
  remove: (id: BookmarkId) => Promise<void>;
  restore: (id: BookmarkId) => Promise<void>;
  removeMany: (ids: BookmarkId[]) => Promise<void>;
  refreshPreview: (id: BookmarkId) => Promise<void>;
  refreshMissingPreviews: () => Promise<number>;
  recaptureArticle: (id: BookmarkId) => Promise<void>;
  setReadState: (id: BookmarkId, readState: ReadState) => Promise<void>;
  setReadProgress: (id: BookmarkId, progress: number) => Promise<void>;

  toggle: (id: BookmarkId, modifier: "single" | "range") => void;
  clearSelection: () => void;
  selectAll: () => void;

  focusBookmark: (id: BookmarkId | null) => void;
}

interface InjectableContext {
  now?: () => number;
  id?: () => BookmarkId;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Imperative API — called by both the React hook and tests. Reads the store
 * lazily via useStore.getState() on every invocation so it always sees the
 * latest state.
 */
export function getUseBookmarksApi(ctx: InjectableContext = {}): UseBookmarks {
  const now = ctx.now ?? Date.now;
  const adapter = () => useStore.getState().bookmarksAdapter;
  const readBookmarks = () => useStore.getState().bookmarks;

  return {
    get bookmarks() {
      return selectVisibleBookmarks(useStore.getState().bookmarks);
    },
    byId: (id) => selectBookmarkById(useStore.getState().bookmarks, id),
    get count() {
      return selectVisibleCount(useStore.getState().bookmarks);
    },
    get selection() {
      return Array.from(useStore.getState().ui.selection);
    },
    get focusBookmarkId() {
      return useStore.getState().ui.focusBookmarkId;
    },

    async add(input) {
      const outcome = await applyAddBookmark(readBookmarks(), input, {
        adapter: adapter(),
        now,
        id: ctx.id,
        ...getSyncOpts(),
      });
      useStore.setState({ bookmarks: outcome.state });
      if (outcome.kind === "duplicate") {
        useStore.setState((s) => ({
          ui: pushToast(setFocusBookmark(s.ui, outcome.existing.id), {
            tone: "info",
            title: "Already saved",
            description: `“${truncate(outcome.existing.title, 40)}”`,
            action: {
              label: "View",
              intent: "view",
              payload: outcome.existing.id,
            },
            ttlMs: 4000,
          }),
        }));
        return { ok: false, reason: "duplicate", existing: outcome.existing };
      }
      if (outcome.kind === "error") {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not save bookmark",
            description: outcome.error.message,
            ttlMs: 6000,
          }),
        }));
        return { ok: false, reason: "error", error: outcome.error };
      }
      previewWorker().enqueue(outcome.bookmark.id);
      captureWorker().enqueue(outcome.bookmark.id);
      embedWorker().enqueue(outcome.bookmark.id);
      return { ok: true, bookmark: outcome.bookmark };
    },

    async addAsset(input) {
      const id = (
        ctx.id ?? (() => asBookmarkId(`bk_${crypto.randomUUID()}`))
      )();
      const up = await uploadAsset(input.file, id);
      if (!up.ok) {
        const title =
          up.error === "unauthenticated"
            ? "Sign in to add files"
            : up.error === "too_large"
              ? "File is too large (max 25 MB)"
              : up.error === "unsupported"
                ? "Unsupported file type"
                : "Could not upload file";
        useStore.setState((s) => ({
          ui: pushToast(s.ui, { tone: "error", title, ttlMs: 5000 }),
        }));
        return { ok: false, reason: "error" };
      }
      const asset = buildAsset(
        {
          kind: up.kind,
          assetPath: up.assetPath,
          title: input.title ?? input.file.name,
          folderId: input.folderId ?? null,
          tagIds: input.tagIds ?? [],
        },
        { now, id: () => id }
      );
      const r = await applyAddAsset(readBookmarks(), asset, {
        adapter: adapter(),
        now,
        ...getSyncOpts(),
      });
      useStore.setState({ bookmarks: r.state });
      if (r.kind === "error") {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not save file",
            ttlMs: 5000,
          }),
        }));
        return { ok: false, reason: "error" };
      }
      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "info",
          title: `Added “${truncate(asset.title, 32)}”`,
          ttlMs: 3000,
        }),
      }));
      return { ok: true, bookmark: asset };
    },

    async addPrompt(input) {
      const prompt = buildPrompt(
        {
          title: input.title,
          body: input.body,
          category: input.category ?? null,
          tagIds: input.tagIds,
        },
        { now, id: ctx.id }
      );
      const r = await applyAddAsset(readBookmarks(), prompt, {
        adapter: adapter(),
        now,
        ...getSyncOpts(),
      });
      useStore.setState({ bookmarks: r.state });
      if (r.kind === "error") {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not save prompt",
            ttlMs: 5000,
          }),
        }));
        return { ok: false, reason: "error" };
      }
      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "info",
          title: `Saved prompt “${truncate(prompt.title, 32)}”`,
          ttlMs: 3000,
        }),
      }));
      return { ok: true, bookmark: prompt };
    },

    async updatePrompt(id, patch) {
      const p: Partial<Bookmark> = {};
      if (patch.title !== undefined)
        p.title = patch.title.trim() || "Untitled prompt";
      if (patch.body !== undefined) p.promptBody = patch.body;
      if (patch.category !== undefined)
        p.promptCategory = patch.category?.trim() || null;
      if (patch.tagIds !== undefined) p.tagIds = patch.tagIds;
      const r = await applyUpdateBookmark(readBookmarks(), id, p, {
        adapter: adapter(),
        now,
        ...getSyncOpts(),
      });
      useStore.setState({ bookmarks: r.state });
      if (r.rolledBack) {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not update prompt",
            ttlMs: 6000,
          }),
        }));
      }
    },

    async update(id, patch) {
      const parsed: Partial<Bookmark> = {};
      if (patch.url !== undefined) parsed.url = patch.url;
      if (patch.title !== undefined) parsed.title = patch.title;
      if (patch.description !== undefined)
        parsed.description = patch.description ?? null;
      if (patch.folderId !== undefined)
        parsed.folderId = patch.folderId as Bookmark["folderId"];
      if (patch.tagIds !== undefined)
        parsed.tagIds = patch.tagIds as Bookmark["tagIds"];
      if (patch.note !== undefined) parsed.note = patch.note;
      if (patch.linkStatus !== undefined) parsed.linkStatus = patch.linkStatus;
      if (patch.linkCheckedAt !== undefined)
        parsed.linkCheckedAt = patch.linkCheckedAt;
      if (patch.linkRedirectUrl !== undefined)
        parsed.linkRedirectUrl = patch.linkRedirectUrl;
      const r = await applyUpdateBookmark(readBookmarks(), id, parsed, {
        adapter: adapter(),
        now,
        ...getSyncOpts(),
      });
      useStore.setState({ bookmarks: r.state });
      if (r.rolledBack) {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not update bookmark",
            ttlMs: 6000,
          }),
        }));
      }
    },

    async remove(id) {
      const bookmark = selectBookmarkById(readBookmarks(), id);
      if (!bookmark) return;
      const r = await applySoftRemoveBookmark(readBookmarks(), id, {
        adapter: adapter(),
        now,
        ...getSyncOpts(),
      });
      useStore.setState({ bookmarks: r.state });
      if (r.rolledBack) {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not delete bookmark",
            ttlMs: 6000,
          }),
        }));
        return;
      }

      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "info",
          title: `Deleted “${truncate(bookmark.title, 32)}”`,
          description: "Will be removed in 5 seconds",
          action: { label: "Undo", intent: "undo", payload: id },
          ttlMs: SOFT_DELETE_WINDOW_MS,
        }),
      }));

      evictionQueue.schedule(id, SOFT_DELETE_WINDOW_MS, async () => {
        const r2 = await applyEvictBookmark(readBookmarks(), id, {
          adapter: adapter(),
        });
        useStore.setState({ bookmarks: r2.state });
        // F23: drop the captured article snapshot alongside the bookmark.
        await useStore.getState().articlesAdapter.remove(id);
        // F28: drop the embedding alongside the bookmark.
        await useStore.getState().embeddingsAdapter.remove(id);
        // F30: drop highlights alongside the bookmark.
        await useStore.getState().highlightsAdapter.removeByBookmark(id);
        // F31: drop the generated snapshot alongside the bookmark.
        await useStore.getState().snapshotsAdapter.remove(id);
        // F26/F27/F28/F30/F31: drop it from the in-memory corpora.
        useStore.setState((s) => {
          const text = { ...s.articleText };
          const mins = { ...s.articleReadingMinutes };
          const vecs = { ...s.embeddingById };
          const snaps = { ...s.snapshotByBookmarkId };
          delete text[id];
          delete mins[id];
          delete vecs[id];
          delete snaps[id];
          return {
            articleText: text,
            articleReadingMinutes: mins,
            embeddingById: vecs,
            highlights: removeHighlightsForBookmark(s.highlights, id),
            snapshotByBookmarkId: snaps,
          };
        });
      });
    },

    async restore(id) {
      evictionQueue.cancel(id);
      const r = await applyRestoreBookmark(readBookmarks(), id, {
        adapter: adapter(),
        now,
        ...getSyncOpts(),
      });
      useStore.setState({ bookmarks: r.state });
    },

    async removeMany(ids) {
      let state = readBookmarks();
      for (const id of ids) {
        const r = await applyEvictBookmark(state, id, {
          adapter: adapter(),
        });
        state = r.state;
        // F23: drop the captured article snapshot alongside each bookmark.
        await useStore.getState().articlesAdapter.remove(id);
        // F28: drop the embedding alongside each bookmark.
        await useStore.getState().embeddingsAdapter.remove(id);
        // F30: drop highlights alongside each bookmark.
        await useStore.getState().highlightsAdapter.removeByBookmark(id);
        // F31: drop the generated snapshot alongside each bookmark.
        await useStore.getState().snapshotsAdapter.remove(id);
        // F26/F27/F28/F30/F31: drop it from the in-memory corpora.
        useStore.setState((s) => {
          const text = { ...s.articleText };
          const mins = { ...s.articleReadingMinutes };
          const vecs = { ...s.embeddingById };
          const snaps = { ...s.snapshotByBookmarkId };
          delete text[id];
          delete mins[id];
          delete vecs[id];
          delete snaps[id];
          return {
            articleText: text,
            articleReadingMinutes: mins,
            embeddingById: vecs,
            highlights: removeHighlightsForBookmark(s.highlights, id),
            snapshotByBookmarkId: snaps,
          };
        });
      }
      useStore.setState({ bookmarks: state });
      useStore.setState((s) => ({ ui: uiClearSelection(s.ui) }));
    },

    async refreshPreview(id) {
      const bookmark = selectBookmarkById(readBookmarks(), id);
      if (!bookmark || bookmark.deletedAt !== null) return;
      const { next } = bumpPreviewAttempt(readBookmarks(), id, now());
      if (next === readBookmarks()) return;
      const updated = next.byId[id];
      if (!updated) return;
      try {
        await adapter().put(updated);
      } catch {
        return;
      }
      useStore.setState({ bookmarks: next });
      try {
        await useStore.getState().previewCacheAdapter.delete(bookmark.url);
      } catch {
        // Non-fatal — worker will refetch anyway since cache TTL check sees missing row.
      }
      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "info",
          title: "Refreshing preview…",
          ttlMs: 3000,
        }),
      }));
      previewWorker().enqueue(id);
    },

    // Bulk-refetch every visible bookmark that has no preview image — for
    // cards saved before a preview improvement (e.g. the screenshot fallback)
    // that hold a stale null. Reuses the refreshPreview path per id (bump
    // attempt → drop cache row → enqueue) with a single summary toast.
    async refreshMissingPreviews() {
      const ids = selectVisibleBookmarks(readBookmarks())
        .filter(
          (b) => b.previewImageUrl === null && b.previewStatus !== "pending"
        )
        .map((b) => b.id);
      if (ids.length === 0) {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "info",
            title: "All previews up to date",
            ttlMs: 2500,
          }),
        }));
        return 0;
      }
      // Batch: bump all attempts into ONE state update, then run the IndexedDB
      // puts + cache-row deletes in parallel (was serial awaits → seconds of
      // blocking on large libraries). The viewport-first worker + raised rate
      // limit then refetch them.
      const targets = ids
        .map((id) => selectBookmarkById(readBookmarks(), id))
        .filter((b): b is NonNullable<typeof b> => !!b && b.deletedAt === null);
      let next = readBookmarks();
      for (const b of targets)
        next = bumpPreviewAttempt(next, b.id, now()).next;
      useStore.setState({ bookmarks: next });
      const cacheAdapter = useStore.getState().previewCacheAdapter;
      await Promise.all(
        targets.flatMap((b) => {
          const updated = next.byId[b.id];
          return [
            updated
              ? adapter()
                  .put(updated)
                  .catch(() => {})
              : Promise.resolve(),
            cacheAdapter.delete(b.url).catch(() => {}),
          ];
        })
      );
      for (const b of targets) previewWorker().enqueue(b.id);
      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "info",
          title: `Refreshing ${ids.length} preview${ids.length > 1 ? "s" : ""}…`,
          ttlMs: 3000,
        }),
      }));
      return ids.length;
    },

    async setReadState(id, readState) {
      const r = await applySetReadState(
        readBookmarks(),
        { id, readState },
        { adapter: adapter(), now, ...getSyncOpts() }
      );
      if (r.state === readBookmarks()) return; // no-op (missing or unchanged)
      useStore.setState({ bookmarks: r.state });
      const title = {
        inbox: "Moved to Inbox",
        reading: "Moved to Reading",
        finished: "Marked finished",
        archived: "Archived",
      }[readState];
      useStore.setState((s) => ({
        ui: pushToast(s.ui, { tone: "info", title, ttlMs: 3000 }),
      }));
    },

    async setReadProgress(id, progress) {
      const prev = selectBookmarkById(readBookmarks(), id);
      if (!prev || prev.deletedAt !== null) return;
      const clamped = Math.max(0, Math.min(1, progress));
      const updated = { ...prev, readProgress: clamped, updatedAt: now() };
      try {
        await adapter().put(updated);
      } catch {
        return;
      }
      useStore.setState((s) => ({
        bookmarks: {
          byId: {
            ...s.bookmarks.byId,
            [id]: {
              ...s.bookmarks.byId[id]!,
              readProgress: clamped,
              updatedAt: updated.updatedAt,
            },
          },
          order: s.bookmarks.order,
        },
      }));
    },

    async recaptureArticle(id) {
      const bookmark = selectBookmarkById(readBookmarks(), id);
      if (!bookmark || bookmark.deletedAt !== null) return;
      const { next } = bumpCaptureAttempt(readBookmarks(), id, now());
      if (next === readBookmarks()) return;
      const updated = next.byId[id];
      if (!updated) return;
      try {
        await adapter().put(updated);
      } catch {
        return;
      }
      useStore.setState({ bookmarks: next });
      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "info",
          title: "Capturing article…",
          ttlMs: 3000,
        }),
      }));
      captureWorker().enqueue(id);
    },

    toggle(id, modifier) {
      useStore.setState((s) => {
        if (modifier === "range" && s.ui.lastSelectionAnchor) {
          return {
            ui: selectRange(
              s.ui,
              s.ui.lastSelectionAnchor,
              id,
              s.bookmarks.order
            ),
          };
        }
        return { ui: toggleSelection(s.ui, id) };
      });
    },
    clearSelection() {
      useStore.setState((s) => ({ ui: uiClearSelection(s.ui) }));
    },
    selectAll() {
      useStore.setState((s) => ({
        ui: uiSelectAll(
          s.ui,
          selectVisibleBookmarks(s.bookmarks).map((b) => b.id)
        ),
      }));
    },
    focusBookmark(id) {
      useStore.setState((s) => ({ ui: setFocusBookmark(s.ui, id) }));
    },
  };
}

/**
 * React hook — subscribes to the relevant slices so components re-render
 * on store changes. Returns the same API as getUseBookmarksApi.
 */
export function useBookmarks(): UseBookmarks {
  useStore((s) => s.bookmarks);
  useStore((s) => s.ui.selection);
  useStore((s) => s.ui.focusBookmarkId);
  return getUseBookmarksApi();
}
