"use client";

/**
 * useTags — the only API components see for tag state.
 *
 * Mirrors useFolders shape. Owns:
 *   - Toast emission on collision / cascade-delete success
 *   - Auto-confirm-skip for empty tags
 *   - Cross-slice cascade delete via applyDeleteTag
 */

import { useStore } from "@/store";
import { getSyncOpts } from "@/lib/sync/sync-runtime";
import {
  applyCreateOrGetTag,
  applyRenameTag,
  applyDeleteTag,
  selectTagById,
  selectVisibleTags,
  selectTagsByIds,
} from "@/store/slices/tags-slice";
import {
  setTagFilter,
  openTagDeleteConfirm,
  pushToast,
} from "@/store/slices/ui-slice";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import type { Tag, TagId } from "@/types";

interface InjectableTagContext {
  now?: () => number;
  id?: () => TagId;
}

export interface UseTags {
  tags: Array<Tag & { count: number }>;
  selectedTagId: TagId | null;
  byId: (id: TagId) => Tag | null;
  byIds: (ids: TagId[]) => Tag[];
  createOrGet: (name: string) => Promise<Tag | null>;
  rename: (id: TagId, name: string) => Promise<void>;
  remove: (id: TagId, opts?: { confirmed?: boolean }) => Promise<void>;
  setFilter: (id: TagId | null) => void;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function getUseTagsApi(ctx: InjectableTagContext = {}): UseTags {
  const now = ctx.now ?? Date.now;
  const tagsAdapter = () => useStore.getState().tagsAdapter;
  const bookmarksAdapter = () => useStore.getState().bookmarksAdapter;
  const tagsState = () => useStore.getState().tags;
  const bookmarksState = () => useStore.getState().bookmarks;
  const uiState = () => useStore.getState().ui;

  function computeTagsWithCounts(): Array<Tag & { count: number }> {
    const tags = selectVisibleTags(tagsState());
    const visible = selectVisibleBookmarks(bookmarksState());
    return tags.map((tag) => ({
      ...tag,
      count: visible.filter((b) => b.tagIds.includes(tag.id)).length,
    }));
  }

  return {
    get tags() {
      return computeTagsWithCounts();
    },
    get selectedTagId() {
      return uiState().selectedTagId;
    },
    byId: (id) => selectTagById(tagsState(), id),
    byIds: (ids) => selectTagsByIds(tagsState(), ids),

    async createOrGet(name) {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const r = await applyCreateOrGetTag(
        tagsState(),
        { name: trimmed },
        { adapter: tagsAdapter(), now, id: ctx.id, ...getSyncOpts() }
      );
      if (r.kind === "added" || r.kind === "existing") {
        if (r.kind === "added") useStore.setState({ tags: r.state });
        return r.tag;
      }
      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "error",
          title: "Could not create tag",
          description: r.error.message,
          ttlMs: 6000,
        }),
      }));
      return null;
    },

    async rename(id, name) {
      const r = await applyRenameTag(tagsState(), id, name, {
        adapter: tagsAdapter(),
        now,
        ...getSyncOpts(),
      });
      useStore.setState({ tags: r.state });
      if (r.error === "collision") {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "info",
            title: "A tag with that name already exists",
            ttlMs: 4000,
          }),
        }));
      } else if (r.rolledBack) {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not rename tag",
            ttlMs: 6000,
          }),
        }));
      }
    },

    async remove(id, opts) {
      const tag = selectTagById(tagsState(), id);
      if (!tag) return;
      const visible = selectVisibleBookmarks(bookmarksState());
      const affected = visible.filter((b) => b.tagIds.includes(id));
      const isEmpty = affected.length === 0;

      if (!isEmpty && !opts?.confirmed) {
        useStore.setState((s) => ({
          ui: openTagDeleteConfirm(s.ui, id),
        }));
        return;
      }

      const r = await applyDeleteTag(tagsState(), id, {
        adapter: tagsAdapter(),
        now,
        ...getSyncOpts(),
      });
      if (r.rolledBack) {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not delete tag",
            ttlMs: 6000,
          }),
        }));
        return;
      }
      useStore.setState((s) => ({
        tags: r.state,
        ui: pushToast(
          {
            ...s.ui,
            dialog: { kind: "closed" },
            selectedTagId:
              s.ui.selectedTagId === id ? null : s.ui.selectedTagId,
          },
          {
            tone: "info",
            title: `Deleted "${truncate(tag.name, 32)}"`,
            ttlMs: 4000,
          }
        ),
      }));
    },

    setFilter(id) {
      useStore.setState((s) => ({ ui: setTagFilter(s.ui, id) }));
    },
  };
}

export function useTags(): UseTags {
  useStore((s) => s.tags);
  useStore((s) => s.bookmarks);
  useStore((s) => s.ui.selectedTagId);
  return getUseTagsApi();
}
