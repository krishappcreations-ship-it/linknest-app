/**
 * UI slice — ephemeral, NOT persisted.
 *
 * Owns selection, toast queue, dialog state, and the "duplicate, jump to
 * existing card" focus highlight. Every reducer returns a fresh state
 * object (never mutates Set in place) so Zustand selectors see the change.
 */

import type {
  BookmarkId,
  FolderId,
  TagId,
  ReadState,
  SmartCollectionId,
} from "@/types";
import type {
  SelectedFolderFilter,
  ContentKind,
} from "@/store/slices/bookmarks-slice";

export type ToastTone = "info" | "success" | "warn" | "error";

export interface ToastAction {
  label: string;
  intent: "undo" | "view";
  payload: BookmarkId;
}

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
  expiresAt: number;
}

export type DialogState =
  | { kind: "closed" }
  | { kind: "add"; initialUrl?: string }
  | { kind: "edit"; bookmarkId: BookmarkId }
  | { kind: "bulk-delete-confirm"; ids: BookmarkId[] }
  | { kind: "folder-delete-confirm"; id: FolderId }
  | { kind: "tag-delete-confirm"; id: TagId }
  | { kind: "sync-queue" } // F14
  | { kind: "smart-collection"; id: SmartCollectionId | null } // F27
  | { kind: "import-export" }; // F32

export interface UiState {
  selection: Set<BookmarkId>;
  lastSelectionAnchor: BookmarkId | null;
  toasts: Toast[];
  dialog: DialogState;
  focusBookmarkId: BookmarkId | null;
  editingFolderId: FolderId | null;
  editingFolderMode: "create" | "rename" | null;
  editingFolderParentId: FolderId | null;
  collapsedFolderIds: Set<FolderId>;
  selectedFolderFilter: SelectedFolderFilter;
  selectedTagId: TagId | null;
  readStateFilter: ReadState | null;
  activeSmartCollectionId: SmartCollectionId | null;
  similarToBookmarkId: BookmarkId | null;
  linkStatusFilter: "broken" | null;
  /** Prompts section: "prompt" shows only prompts; null = normal bookmark views. */
  selectedKindFilter: "prompt" | null;
  /** Within the Prompts section, narrow to a category (null = all prompts). */
  selectedPromptCategory: string | null;
  /** Within non-prompt views, narrow to a content type (null = all). */
  selectedContentType: ContentKind | null;
  commandPaletteOpen: boolean;
  mobileDrawerOpen: boolean;
}

export const initialUiState: UiState = {
  selection: new Set(),
  lastSelectionAnchor: null,
  toasts: [],
  dialog: { kind: "closed" },
  focusBookmarkId: null,
  editingFolderId: null,
  editingFolderMode: null,
  editingFolderParentId: null,
  collapsedFolderIds: new Set(),
  selectedFolderFilter: { kind: "all" },
  selectedTagId: null,
  readStateFilter: null,
  activeSmartCollectionId: null,
  similarToBookmarkId: null,
  linkStatusFilter: null,
  selectedKindFilter: null,
  selectedPromptCategory: null,
  selectedContentType: null,
  commandPaletteOpen: false,
  mobileDrawerOpen: false,
};

/* ---------- Selection ---------- */

export function toggleSelection(state: UiState, id: BookmarkId): UiState {
  const selection = new Set(state.selection);
  if (selection.has(id)) selection.delete(id);
  else selection.add(id);
  return { ...state, selection, lastSelectionAnchor: id };
}

export function selectRange(
  state: UiState,
  from: BookmarkId,
  to: BookmarkId,
  order: BookmarkId[]
): UiState {
  const fromIdx = order.indexOf(from);
  const toIdx = order.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) {
    return toggleSelection(state, to);
  }
  const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
  const selection = new Set(state.selection);
  for (let i = lo; i <= hi; i++) {
    const id = order[i];
    if (id) selection.add(id);
  }
  return { ...state, selection, lastSelectionAnchor: to };
}

export function selectAll(state: UiState, ids: BookmarkId[]): UiState {
  return {
    ...state,
    selection: new Set(ids),
    lastSelectionAnchor: ids.length > 0 ? ids[ids.length - 1]! : null,
  };
}

export function clearSelection(state: UiState): UiState {
  return { ...state, selection: new Set(), lastSelectionAnchor: null };
}

/* ---------- Toasts ---------- */

function makeToastId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function pushToast(
  state: UiState,
  input: Omit<Toast, "id" | "expiresAt"> & { ttlMs: number }
): UiState {
  const { ttlMs, ...rest } = input;
  const toast: Toast = {
    ...rest,
    id: makeToastId(),
    expiresAt: Date.now() + ttlMs,
  };
  return { ...state, toasts: [...state.toasts, toast] };
}

export function dismissToast(state: UiState, id: string): UiState {
  return { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
}

/* ---------- Dialog ---------- */

export function openAddDialog(state: UiState, initialUrl?: string): UiState {
  return { ...state, dialog: { kind: "add", initialUrl } };
}

export function openEditDialog(
  state: UiState,
  bookmarkId: BookmarkId
): UiState {
  return { ...state, dialog: { kind: "edit", bookmarkId } };
}

export function openBulkDeleteConfirm(
  state: UiState,
  ids: BookmarkId[]
): UiState {
  return { ...state, dialog: { kind: "bulk-delete-confirm", ids } };
}

export function closeDialog(state: UiState): UiState {
  return { ...state, dialog: { kind: "closed" } };
}

/* ---------- Focus ---------- */

export function setFocusBookmark(
  state: UiState,
  id: BookmarkId | null
): UiState {
  return { ...state, focusBookmarkId: id };
}

/* ---------- Folder editing + collapse + filter ---------- */

export function beginCreateFolder(
  state: UiState,
  parentId: FolderId | null
): UiState {
  return {
    ...state,
    editingFolderId: null,
    editingFolderMode: "create",
    editingFolderParentId: parentId,
  };
}

export function beginRenameFolder(state: UiState, id: FolderId): UiState {
  return {
    ...state,
    editingFolderId: id,
    editingFolderMode: "rename",
    editingFolderParentId: null,
  };
}

export function cancelFolderEdit(state: UiState): UiState {
  return {
    ...state,
    editingFolderId: null,
    editingFolderMode: null,
    editingFolderParentId: null,
  };
}

export function toggleFolderCollapsed(state: UiState, id: FolderId): UiState {
  const next = new Set(state.collapsedFolderIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return { ...state, collapsedFolderIds: next };
}

export function setFolderFilter(
  state: UiState,
  filter: SelectedFolderFilter
): UiState {
  return {
    ...state,
    selectedFolderFilter: filter,
    activeSmartCollectionId: null,
    similarToBookmarkId: null,
    linkStatusFilter: null,
    selectedKindFilter: null,
    selectedPromptCategory: null,
  };
}

export function setReadStateFilter(
  state: UiState,
  filter: ReadState | null
): UiState {
  return {
    ...state,
    readStateFilter: filter,
    activeSmartCollectionId: null,
    similarToBookmarkId: null,
    linkStatusFilter: null,
    selectedKindFilter: null,
    selectedPromptCategory: null,
  };
}

/* ---------- Link health filter (feature 34) ---------- */

export function setLinkStatusFilter(
  state: UiState,
  filter: "broken" | null
): UiState {
  return {
    ...state,
    linkStatusFilter: filter,
    // Mutually exclusive with folder/tag/read-state/smart/similar filters.
    selectedFolderFilter: { kind: "all" },
    selectedTagId: null,
    readStateFilter: null,
    activeSmartCollectionId: null,
    similarToBookmarkId: null,
    selectedKindFilter: null,
    selectedPromptCategory: null,
  };
}

/* ---------- Prompts section filter ---------- */

export function setKindFilter(state: UiState, kind: "prompt" | null): UiState {
  return {
    ...state,
    selectedKindFilter: kind,
    selectedPromptCategory: null,
    // Mutually exclusive with all bookmark filters.
    selectedFolderFilter: { kind: "all" },
    selectedTagId: null,
    readStateFilter: null,
    activeSmartCollectionId: null,
    similarToBookmarkId: null,
    linkStatusFilter: null,
    // The Links/Images/PDFs filter doesn't apply to prompts.
    selectedContentType: null,
  };
}

export function setPromptCategory(
  state: UiState,
  category: string | null
): UiState {
  return { ...state, selectedPromptCategory: category };
}

/* ---------- Content-type filter (links / images / pdfs) ---------- */

export function setContentType(
  state: UiState,
  contentType: ContentKind | null
): UiState {
  return { ...state, selectedContentType: contentType };
}

/* ---------- Smart collection filter (feature 27) ---------- */

export function setActiveSmartCollection(
  state: UiState,
  id: SmartCollectionId | null
): UiState {
  return {
    ...state,
    activeSmartCollectionId: id,
    // Mutually exclusive with folder/tag/read-state filters.
    selectedFolderFilter: { kind: "all" },
    selectedTagId: null,
    readStateFilter: null,
    similarToBookmarkId: null,
    linkStatusFilter: null,
    selectedKindFilter: null,
    selectedPromptCategory: null,
  };
}

/* ---------- Similar filter (feature 29) ---------- */

export function setSimilarTo(state: UiState, id: BookmarkId | null): UiState {
  return {
    ...state,
    similarToBookmarkId: id,
    // Mutually exclusive with folder/tag/read-state/smart-collection filters.
    selectedFolderFilter: { kind: "all" },
    selectedTagId: null,
    readStateFilter: null,
    activeSmartCollectionId: null,
    linkStatusFilter: null,
    selectedKindFilter: null,
    selectedPromptCategory: null,
  };
}

export function openSmartCollectionDialog(
  state: UiState,
  id: SmartCollectionId | null
): UiState {
  return { ...state, dialog: { kind: "smart-collection", id } };
}

export function openFolderDeleteConfirm(state: UiState, id: FolderId): UiState {
  return { ...state, dialog: { kind: "folder-delete-confirm", id } };
}

export function openImportExportDialog(state: UiState): UiState {
  return { ...state, dialog: { kind: "import-export" } };
}

/* ---------- Tag filter + delete dialog ---------- */

export function setTagFilter(state: UiState, id: TagId | null): UiState {
  return {
    ...state,
    selectedTagId: id,
    activeSmartCollectionId: null,
    similarToBookmarkId: null,
    linkStatusFilter: null,
    selectedKindFilter: null,
    selectedPromptCategory: null,
  };
}

export function openTagDeleteConfirm(state: UiState, id: TagId): UiState {
  return { ...state, dialog: { kind: "tag-delete-confirm", id } };
}

/* ---------- Sync queue (F14) ---------- */

export function openSyncQueueDialog(state: UiState): UiState {
  return { ...state, dialog: { kind: "sync-queue" } };
}

/* ---------- Command palette (feature 06) ---------- */

export function openCommandPalette(state: UiState): UiState {
  if (state.commandPaletteOpen) return state;
  return { ...state, commandPaletteOpen: true };
}

export function closeCommandPalette(state: UiState): UiState {
  if (!state.commandPaletteOpen) return state;
  return { ...state, commandPaletteOpen: false };
}

/* ---------- Mobile drawer (Mobile UX) ---------- */

export function openMobileDrawer(state: UiState): UiState {
  if (state.mobileDrawerOpen) return state;
  return { ...state, mobileDrawerOpen: true };
}

export function closeMobileDrawer(state: UiState): UiState {
  if (!state.mobileDrawerOpen) return state;
  return { ...state, mobileDrawerOpen: false };
}
