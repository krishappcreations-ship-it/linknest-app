"use client";

/**
 * useFolders — the only API components see for folder state.
 *
 * Mirrors useBookmarks pattern (getUseFoldersApi seam for tests).
 * Side effects this hook owns:
 *   - Inline edit lifecycle (beginCreate / beginRename / commitEdit / cancelEdit)
 *   - Toast emission on duplicate / depth-error / delete-success
 *   - Folder delete orchestration (auto-confirm for empty, dialog for non-empty)
 *   - Cross-slice bookmark reassignment via applyDeleteFolder
 */

import { useStore } from "@/store";
import { getSyncOpts } from "@/lib/sync/sync-runtime";
import {
  applyCreateFolder,
  applyRenameFolder,
  applyTogglePinFolder,
  applyDeleteFolder,
  selectFolderById,
  selectFolderAncestors,
  selectFolderSubtreeIds,
  selectVisibleFolderRows,
  type FolderRow,
} from "@/store/slices/folders-slice";
import {
  beginCreateFolder,
  beginRenameFolder,
  cancelFolderEdit,
  toggleFolderCollapsed,
  setFolderFilter,
  openFolderDeleteConfirm,
  pushToast,
} from "@/store/slices/ui-slice";
import {
  selectVisibleBookmarks,
  type SelectedFolderFilter,
} from "@/store/slices/bookmarks-slice";
import type { Folder, FolderId } from "@/types";

interface InjectableFolderContext {
  now?: () => number;
  id?: () => FolderId;
}

export interface UseFolders {
  rows: FolderRow[];
  selectedFilter: SelectedFolderFilter;
  editing: {
    id: FolderId | null;
    mode: "create" | "rename" | null;
    parentId: FolderId | null;
  };
  byId: (id: FolderId) => Folder | null;
  subtreeBookmarkCount: (id: FolderId) => number;
  ancestors: (id: FolderId) => Folder[];

  beginCreate: (parentId: FolderId | null) => void;
  beginRename: (id: FolderId) => void;
  commitEdit: (name: string) => Promise<void>;
  cancelEdit: () => void;

  togglePin: (id: FolderId) => Promise<void>;
  toggleCollapse: (id: FolderId) => void;
  remove: (id: FolderId, opts?: { confirmed?: boolean }) => Promise<void>;
  setFilter: (filter: SelectedFolderFilter) => void;
  /** F32 import: get-or-create a folder under a parent; null on depth-error/failure. */
  createFolder: (input: {
    name: string;
    parentId: FolderId | null;
  }) => Promise<Folder | null>;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function getUseFoldersApi(
  ctx: InjectableFolderContext = {}
): UseFolders {
  const now = ctx.now ?? Date.now;
  const foldersAdapter = () => useStore.getState().foldersAdapter;
  const bookmarksAdapter = () => useStore.getState().bookmarksAdapter;
  const foldersState = () => useStore.getState().folders;
  const bookmarksState = () => useStore.getState().bookmarks;
  const uiState = () => useStore.getState().ui;

  return {
    get rows() {
      const ui = uiState();
      return selectVisibleFolderRows(foldersState(), ui.collapsedFolderIds);
    },
    get selectedFilter() {
      return uiState().selectedFolderFilter;
    },
    get editing() {
      const ui = uiState();
      return {
        id: ui.editingFolderId,
        mode: ui.editingFolderMode,
        parentId: ui.editingFolderParentId,
      };
    },
    byId: (id) => selectFolderById(foldersState(), id),
    subtreeBookmarkCount: (id) => {
      const subtree = selectFolderSubtreeIds(foldersState(), id);
      const visible = selectVisibleBookmarks(bookmarksState());
      let n = 0;
      for (const b of visible) {
        if (
          b.folderId !== null &&
          subtree.has(b.folderId) &&
          b.kind !== "prompt"
        )
          n++;
      }
      return n;
    },
    ancestors: (id) => selectFolderAncestors(foldersState(), id),

    beginCreate(parentId) {
      useStore.setState((s) => ({ ui: beginCreateFolder(s.ui, parentId) }));
    },
    beginRename(id) {
      useStore.setState((s) => ({ ui: beginRenameFolder(s.ui, id) }));
    },
    cancelEdit() {
      useStore.setState((s) => ({ ui: cancelFolderEdit(s.ui) }));
    },
    async commitEdit(name) {
      const trimmed = name.trim();
      const ui = uiState();
      if (!trimmed) {
        useStore.setState((s) => ({ ui: cancelFolderEdit(s.ui) }));
        return;
      }
      if (ui.editingFolderMode === "create") {
        const outcome = await applyCreateFolder(
          foldersState(),
          { name: trimmed, parentId: ui.editingFolderParentId },
          { adapter: foldersAdapter(), now, id: ctx.id, ...getSyncOpts() }
        );
        if (outcome.kind === "added") {
          useStore.setState((s) => ({
            folders: outcome.state,
            ui: cancelFolderEdit(s.ui),
          }));
        } else if (outcome.kind === "duplicate") {
          useStore.setState((s) => ({
            ui: pushToast(s.ui, {
              tone: "info",
              title: "A folder with that name already exists",
              ttlMs: 4000,
            }),
          }));
        } else if (outcome.kind === "depth-error") {
          useStore.setState((s) => ({
            ui: pushToast(s.ui, {
              tone: "warn",
              title: "Folders can't be nested deeper than 3 levels",
              ttlMs: 4000,
            }),
          }));
        } else {
          useStore.setState((s) => ({
            ui: pushToast(s.ui, {
              tone: "error",
              title: "Could not create folder",
              description: outcome.error.message,
              ttlMs: 6000,
            }),
          }));
        }
      } else if (ui.editingFolderMode === "rename" && ui.editingFolderId) {
        const r = await applyRenameFolder(
          foldersState(),
          ui.editingFolderId,
          trimmed,
          { adapter: foldersAdapter(), now, ...getSyncOpts() }
        );
        useStore.setState((s) => ({
          folders: r.state,
          ui: cancelFolderEdit(s.ui),
        }));
        if (r.rolledBack) {
          useStore.setState((s) => ({
            ui: pushToast(s.ui, {
              tone: "error",
              title: "Could not rename folder",
              ttlMs: 6000,
            }),
          }));
        }
      }
    },

    async togglePin(id) {
      const r = await applyTogglePinFolder(foldersState(), id, {
        adapter: foldersAdapter(),
        now,
        ...getSyncOpts(),
      });
      useStore.setState({ folders: r.state });
      if (r.rolledBack) {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not pin folder",
            ttlMs: 6000,
          }),
        }));
      }
    },

    toggleCollapse(id) {
      useStore.setState((s) => ({ ui: toggleFolderCollapsed(s.ui, id) }));
    },

    async remove(id, opts) {
      const folder = selectFolderById(foldersState(), id);
      if (!folder) return;
      const subtree = selectFolderSubtreeIds(foldersState(), id);
      const hasSubfolders = subtree.size > 1;
      const ownedBookmarks = selectVisibleBookmarks(bookmarksState()).filter(
        (b) => b.folderId !== null && subtree.has(b.folderId)
      );
      const isEmpty = !hasSubfolders && ownedBookmarks.length === 0;

      if (!isEmpty && !opts?.confirmed) {
        useStore.setState((s) => ({
          ui: openFolderDeleteConfirm(s.ui, id),
        }));
        return;
      }

      const r = await applyDeleteFolder(foldersState(), bookmarksState(), id, {
        adapter: foldersAdapter(),
        bookmarksAdapter: bookmarksAdapter(),
        now,
      });
      if (r.rolledBack) {
        useStore.setState((s) => ({
          ui: pushToast(s.ui, {
            tone: "error",
            title: "Could not delete folder",
            ttlMs: 6000,
          }),
        }));
        return;
      }
      useStore.setState((s) => ({
        folders: r.foldersState,
        bookmarks: r.bookmarksState,
        ui: pushToast(
          { ...s.ui, dialog: { kind: "closed" } },
          {
            tone: "info",
            title: `Deleted “${truncate(folder.name, 32)}”`,
            description:
              r.reassignedBookmarkIds.length > 0
                ? `${r.reassignedBookmarkIds.length} bookmark${
                    r.reassignedBookmarkIds.length === 1 ? "" : "s"
                  } moved to root`
                : undefined,
            ttlMs: 4000,
          }
        ),
      }));
    },

    setFilter(filter) {
      useStore.setState((s) => ({ ui: setFolderFilter(s.ui, filter) }));
    },

    async createFolder({ name, parentId }) {
      const outcome = await applyCreateFolder(
        foldersState(),
        { name, parentId },
        { adapter: foldersAdapter(), now, id: ctx.id, ...getSyncOpts() }
      );
      if (outcome.kind === "added") {
        useStore.setState({ folders: outcome.state });
        return outcome.folder;
      }
      if (outcome.kind === "duplicate") return outcome.existing;
      return null; // depth-error | error
    },
  };
}

export function useFolders(): UseFolders {
  useStore((s) => s.folders);
  useStore((s) => s.ui.editingFolderId);
  useStore((s) => s.ui.editingFolderMode);
  useStore((s) => s.ui.collapsedFolderIds);
  useStore((s) => s.ui.selectedFolderFilter);
  return getUseFoldersApi();
}
