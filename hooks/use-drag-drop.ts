"use client";

/**
 * useDragDrop — single orchestrator for the dnd-kit DndContext.
 *
 * Routes drag events by parsing the colon-delimited id scheme:
 *   bookmark:<id>:sortable
 *   folder:<id>:sortable
 *   folder:<id>:body
 *
 * Dispatches the matching apply* helper and merges the result into the
 * store. Emits aria-live announcement strings for accessibility.
 */

import { useMemo } from "react";
import {
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useStore } from "@/store";
import {
  applyReorderBookmark,
  applyMoveBookmarkToFolder,
  selectBookmarkById,
} from "@/store/slices/bookmarks-slice";
import {
  applyReorderFolder,
  applyNestFolder,
} from "@/store/slices/folders-slice";
import {
  pushToast,
  clearSelection as uiClearSelection,
} from "@/store/slices/ui-slice";
import { getSyncOpts } from "@/lib/sync/sync-runtime";
import {
  asBookmarkId,
  asFolderId,
  type BookmarkId,
  type FolderId,
} from "@/types";

// Module-scoped to survive across the React-managed handler closures.
// Captured on dragStart when active is in a 2+ selection; consumed in
// handleDragEnd's folder-drop branch. Cleared on dragEnd + dragCancel.
let batchIds: BookmarkId[] | null = null;

type ParsedId =
  | { kind: "bookmark"; id: BookmarkId; role: "sortable" }
  | { kind: "folder"; id: FolderId; role: "sortable" | "body" }
  | null;

function parseId(raw: unknown): ParsedId {
  if (typeof raw !== "string") return null;
  const parts = raw.split(":");
  if (parts.length !== 3) return null;
  const [kind, id, role] = parts;
  if (kind === "bookmark" && role === "sortable") {
    return { kind, id: asBookmarkId(id!), role };
  }
  if (kind === "folder" && (role === "sortable" || role === "body")) {
    return { kind, id: asFolderId(id!), role };
  }
  return null;
}

function bookmarkTitle(id: BookmarkId): string {
  const b = selectBookmarkById(useStore.getState().bookmarks, id);
  return b?.title ?? "bookmark";
}

function folderName(id: FolderId): string {
  return useStore.getState().folders.byId[id]?.name ?? "folder";
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

interface AnnouncementEvent {
  active: { id: unknown };
  over?: { id: unknown } | null;
}

export interface DragDropHandlers {
  handleDragStart: (e: DragStartEvent) => void;
  handleDragEnd: (e: DragEndEvent) => Promise<void>;
  handleDragCancel: (e: DragCancelEvent) => void;
  announcements: {
    onDragStart: (e: AnnouncementEvent) => string;
    onDragOver: (e: AnnouncementEvent) => string;
    onDragEnd: (e: AnnouncementEvent) => string;
    onDragCancel: (e: AnnouncementEvent) => string;
  };
}

export interface UseDragDrop extends DragDropHandlers {
  sensors: ReturnType<typeof useSensors>;
}

/**
 * Pure factory — returns handlers + announcements. No React hooks called.
 * Used by tests AND by useDragDrop (which adds sensors).
 */
export function getUseDragDropApi(): DragDropHandlers {
  return {
    handleDragStart(e) {
      const active = parseId(e.active.id);
      if (!active || active.kind !== "bookmark") {
        batchIds = null;
        return;
      }
      const selection = useStore.getState().ui.selection;
      if (selection.size >= 2 && selection.has(active.id)) {
        batchIds = Array.from(selection);
      } else {
        batchIds = null;
      }
    },

    async handleDragEnd(e) {
      const active = parseId(e.active.id);
      const over = e.over ? parseId(e.over.id) : null;
      if (!active || !over) return;

      const state = useStore.getState();

      // 1) bookmark dropped on bookmark sortable → reorder
      if (
        active.kind === "bookmark" &&
        over.kind === "bookmark" &&
        over.role === "sortable"
      ) {
        const order = state.bookmarks.order;
        const fromIdx = order.indexOf(active.id);
        const toIdx = order.indexOf(over.id);
        if (fromIdx === -1 || toIdx === -1) return;
        const r = await applyReorderBookmark(
          state.bookmarks,
          { fromIdx, toIdx },
          { adapter: state.bookmarksAdapter }
        );
        useStore.setState({ bookmarks: r.state });
        return;
      }

      // 2) bookmark dropped on folder:<id>:body → move into folder
      //    Batch mode (per spec §5.4): if batchIds was captured on dragStart,
      //    loop applyMoveBookmarkToFolder per id with best-effort semantics.
      if (
        active.kind === "bookmark" &&
        over.kind === "folder" &&
        over.role === "body"
      ) {
        const ids = batchIds && batchIds.length >= 2 ? batchIds : [active.id];
        const targetFolder = state.folders.byId[over.id];
        const targetName = targetFolder?.name ?? "folder";

        let currentBookmarks = state.bookmarks;
        const successful: BookmarkId[] = [];
        const failed: BookmarkId[] = [];

        for (const id of ids) {
          const r = await applyMoveBookmarkToFolder(
            currentBookmarks,
            { id, folderId: over.id, insertAfterId: null },
            { adapter: state.bookmarksAdapter, ...getSyncOpts() }
          );
          currentBookmarks = r.state;
          if (r.rolledBack) failed.push(id);
          else successful.push(id);
        }

        useStore.setState({ bookmarks: currentBookmarks });

        // Selection cleanup per spec §5.4 + Q3.
        if (ids.length >= 2) {
          if (failed.length === 0) {
            useStore.setState((s) => ({ ui: uiClearSelection(s.ui) }));
          } else {
            useStore.setState((s) => ({
              ui: {
                ...s.ui,
                selection: new Set(failed),
                lastSelectionAnchor: null,
              },
            }));
          }
        }

        // Toast feedback (batch only — single-mode keeps F05 silent-success).
        if (ids.length >= 2) {
          if (failed.length === 0) {
            useStore.setState((s) => ({
              ui: pushToast(s.ui, {
                tone: "info",
                title: `Moved ${successful.length} bookmarks to "${truncate(targetName, 24)}"`,
                ttlMs: 4000,
              }),
            }));
          } else {
            useStore.setState((s) => ({
              ui: pushToast(s.ui, {
                tone: "warn",
                title: `Moved ${successful.length} of ${ids.length}`,
                description: `${failed.length} failed`,
                ttlMs: 6000,
              }),
            }));
          }
        }

        batchIds = null;
        return;
      }

      // 3) folder dropped on folder sortable → reorder within siblings
      if (
        active.kind === "folder" &&
        over.kind === "folder" &&
        over.role === "sortable"
      ) {
        const activeFolder = state.folders.byId[active.id];
        if (!activeFolder) return;
        const parentId = activeFolder.parentId;
        const list =
          parentId === null
            ? state.folders.rootIds
            : (state.folders.childrenByParent[parentId] ?? []);
        const fromIdx = list.indexOf(active.id);
        const toIdx = list.indexOf(over.id);
        if (fromIdx === -1 || toIdx === -1) return;
        const r = await applyReorderFolder(
          state.folders,
          { id: active.id, fromIdx, toIdx, parentId },
          { adapter: state.foldersAdapter }
        );
        useStore.setState({ folders: r.state });
        return;
      }

      // 4) folder dropped on folder:<id>:body → nest under
      if (
        active.kind === "folder" &&
        over.kind === "folder" &&
        over.role === "body"
      ) {
        const r = await applyNestFolder(
          state.folders,
          { id: active.id, newParentId: over.id },
          { adapter: state.foldersAdapter }
        );
        useStore.setState({ folders: r.state });
        return;
      }
    },

    handleDragCancel() {
      batchIds = null;
      // dnd-kit returns the overlay to origin internally
    },

    announcements: {
      onDragStart(e) {
        const active = parseId(e.active.id);
        if (!active) return "";
        const label =
          active.kind === "bookmark"
            ? bookmarkTitle(active.id)
            : folderName(active.id);
        return `Picked up ${label}. Use arrow keys to move. Press space to drop, escape to cancel.`;
      },
      onDragOver(e) {
        const active = parseId(e.active.id);
        const over = e.over ? parseId(e.over.id) : null;
        if (!active) return "";
        const activeLabel =
          active.kind === "bookmark"
            ? bookmarkTitle(active.id)
            : folderName(active.id);
        if (!over) return `${activeLabel} is no longer over a drop target.`;
        const target =
          over.kind === "bookmark"
            ? `bookmark ${bookmarkTitle(over.id)}`
            : over.role === "body"
              ? `folder ${folderName(over.id)} (drop to move in)`
              : `folder ${folderName(over.id)} (drop to reorder)`;
        return `${activeLabel} over ${target}.`;
      },
      onDragEnd(e) {
        const active = parseId(e.active.id);
        const over = e.over ? parseId(e.over.id) : null;
        if (!active) return "";
        const activeLabel =
          active.kind === "bookmark"
            ? bookmarkTitle(active.id)
            : folderName(active.id);
        if (!over)
          return `Drag cancelled. ${activeLabel} returned to original position.`;
        const target =
          over.kind === "bookmark"
            ? bookmarkTitle(over.id)
            : folderName(over.id);
        return `Dropped ${activeLabel} on ${target}.`;
      },
      onDragCancel(e) {
        const active = parseId(e.active.id);
        if (!active) return "";
        const activeLabel =
          active.kind === "bookmark"
            ? bookmarkTitle(active.id)
            : folderName(active.id);
        return `Drag cancelled. ${activeLabel} returned to original position.`;
      },
    },
  };
}

export function useDragDrop(): UseDragDrop {
  const sensors = useSensors(
    // MouseSensor (not PointerSensor) so touch input is handled solely by
    // TouchSensor below — PointerSensor also captures touch and would start a
    // drag mid-scroll, hijacking the page scroll on mobile.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const handlers = useMemo(() => getUseDragDropApi(), []);
  return { ...handlers, sensors };
}
