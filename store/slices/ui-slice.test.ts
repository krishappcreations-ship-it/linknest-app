import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initialUiState,
  toggleSelection,
  selectRange,
  selectAll,
  clearSelection,
  pushToast,
  dismissToast,
  openAddDialog,
  openEditDialog,
  openBulkDeleteConfirm,
  closeDialog,
  setFocusBookmark,
  openSyncQueueDialog,
  openMobileDrawer,
  closeMobileDrawer,
  setReadStateFilter,
  setSimilarTo,
  setActiveSmartCollection,
  openImportExportDialog,
  setLinkStatusFilter,
} from "./ui-slice";
import { asBookmarkId } from "@/types";

describe("ui-slice — readStateFilter (feature 22)", () => {
  it("defaults to null", () => {
    expect(initialUiState.readStateFilter).toBeNull();
  });
  it("setReadStateFilter sets and clears the filter", () => {
    const s1 = setReadStateFilter(initialUiState, "reading");
    expect(s1.readStateFilter).toBe("reading");
    const s2 = setReadStateFilter(s1, null);
    expect(s2.readStateFilter).toBeNull();
  });
});

describe("ui-slice — selection", () => {
  it("toggleSelection adds when absent", () => {
    const s = toggleSelection(initialUiState, asBookmarkId("a"));
    expect(s.selection.has(asBookmarkId("a"))).toBe(true);
    expect(s.lastSelectionAnchor).toBe(asBookmarkId("a"));
  });
  it("toggleSelection removes when present", () => {
    let s = toggleSelection(initialUiState, asBookmarkId("a"));
    s = toggleSelection(s, asBookmarkId("a"));
    expect(s.selection.has(asBookmarkId("a"))).toBe(false);
  });
  it("toggleSelection returns a new Set (no in-place mutation)", () => {
    const s1 = toggleSelection(initialUiState, asBookmarkId("a"));
    const s2 = toggleSelection(s1, asBookmarkId("b"));
    expect(s2.selection).not.toBe(s1.selection);
  });

  it("selectRange picks an inclusive slice of order", () => {
    const order = [
      asBookmarkId("a"),
      asBookmarkId("b"),
      asBookmarkId("c"),
      asBookmarkId("d"),
    ];
    const s = selectRange(
      initialUiState,
      asBookmarkId("b"),
      asBookmarkId("d"),
      order
    );
    expect(Array.from(s.selection)).toEqual([
      asBookmarkId("b"),
      asBookmarkId("c"),
      asBookmarkId("d"),
    ]);
  });
  it("selectRange handles reverse direction", () => {
    const order = [asBookmarkId("a"), asBookmarkId("b"), asBookmarkId("c")];
    const s = selectRange(
      initialUiState,
      asBookmarkId("c"),
      asBookmarkId("a"),
      order
    );
    expect(Array.from(s.selection).sort()).toEqual([
      asBookmarkId("a"),
      asBookmarkId("b"),
      asBookmarkId("c"),
    ]);
  });

  it("selectAll fills selection with provided ids", () => {
    const s = selectAll(initialUiState, [asBookmarkId("a"), asBookmarkId("b")]);
    expect(s.selection.size).toBe(2);
  });
  it("clearSelection empties the set and clears anchor", () => {
    let s = toggleSelection(initialUiState, asBookmarkId("a"));
    s = clearSelection(s);
    expect(s.selection.size).toBe(0);
    expect(s.lastSelectionAnchor).toBeNull();
  });
});

describe("ui-slice — toasts", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pushToast appends with generated id and computed expiresAt", () => {
    vi.setSystemTime(1000);
    const s = pushToast(initialUiState, {
      tone: "info",
      title: "Hello",
      ttlMs: 5000,
    });
    expect(s.toasts).toHaveLength(1);
    expect(s.toasts[0]?.expiresAt).toBe(6000);
    expect(s.toasts[0]?.id).toBeDefined();
    expect(s.toasts[0]?.title).toBe("Hello");
  });
  it("dismissToast removes by id, preserves others", () => {
    let s = pushToast(initialUiState, {
      tone: "info",
      title: "A",
      ttlMs: 1000,
    });
    s = pushToast(s, { tone: "info", title: "B", ttlMs: 1000 });
    const firstId = s.toasts[0]!.id;
    s = dismissToast(s, firstId);
    expect(s.toasts).toHaveLength(1);
    expect(s.toasts[0]?.title).toBe("B");
  });
});

describe("ui-slice — dialog", () => {
  it("openAddDialog sets kind to 'add' with optional initialUrl", () => {
    const s = openAddDialog(initialUiState, "https://x.com");
    expect(s.dialog).toEqual({ kind: "add", initialUrl: "https://x.com" });
  });
  it("openEditDialog sets bookmarkId", () => {
    const s = openEditDialog(initialUiState, asBookmarkId("a"));
    expect(s.dialog).toEqual({ kind: "edit", bookmarkId: asBookmarkId("a") });
  });
  it("openBulkDeleteConfirm sets ids", () => {
    const s = openBulkDeleteConfirm(initialUiState, [
      asBookmarkId("a"),
      asBookmarkId("b"),
    ]);
    expect(s.dialog.kind).toBe("bulk-delete-confirm");
  });
  it("closeDialog returns to closed", () => {
    let s = openAddDialog(initialUiState);
    s = closeDialog(s);
    expect(s.dialog.kind).toBe("closed");
  });
});

describe("ui-slice — focus", () => {
  it("setFocusBookmark stores and clears id", () => {
    let s = setFocusBookmark(initialUiState, asBookmarkId("a"));
    expect(s.focusBookmarkId).toBe(asBookmarkId("a"));
    s = setFocusBookmark(s, null);
    expect(s.focusBookmarkId).toBeNull();
  });
});

import {
  beginCreateFolder,
  beginRenameFolder,
  cancelFolderEdit,
  toggleFolderCollapsed,
  setFolderFilter,
  openFolderDeleteConfirm,
} from "@/store/slices/ui-slice";
import { asFolderId } from "@/types";

describe("folder editing ui-slice reducers", () => {
  it("beginCreateFolder sets editingFolderId=null + mode=create + parentId", () => {
    const next = beginCreateFolder(initialUiState, null);
    expect(next.editingFolderMode).toBe("create");
    expect(next.editingFolderParentId).toBeNull();
    expect(next.editingFolderId).toBeNull();
  });
  it("beginCreateFolder with parent records parentId", () => {
    const parent = asFolderId("fld_parent");
    const next = beginCreateFolder(initialUiState, parent);
    expect(next.editingFolderParentId).toBe(parent);
  });
  it("beginRenameFolder sets editingFolderId + mode=rename", () => {
    const next = beginRenameFolder(initialUiState, asFolderId("fld_t"));
    expect(next.editingFolderId).toBe(asFolderId("fld_t"));
    expect(next.editingFolderMode).toBe("rename");
  });
  it("cancelFolderEdit clears all editing state", () => {
    const interim = beginRenameFolder(initialUiState, asFolderId("fld_t"));
    const next = cancelFolderEdit(interim);
    expect(next.editingFolderId).toBeNull();
    expect(next.editingFolderMode).toBeNull();
    expect(next.editingFolderParentId).toBeNull();
  });
  it("toggleFolderCollapsed flips the membership of the Set (referentially-fresh)", () => {
    const id = asFolderId("fld_t");
    const next = toggleFolderCollapsed(initialUiState, id);
    expect(next.collapsedFolderIds.has(id)).toBe(true);
    expect(next.collapsedFolderIds).not.toBe(initialUiState.collapsedFolderIds);
    const back = toggleFolderCollapsed(next, id);
    expect(back.collapsedFolderIds.has(id)).toBe(false);
  });
  it("setFolderFilter updates discriminator", () => {
    const next = setFolderFilter(initialUiState, { kind: "unfiled" });
    expect(next.selectedFolderFilter).toEqual({ kind: "unfiled" });
    const subtree = setFolderFilter(next, {
      kind: "subtree",
      id: asFolderId("fld_t"),
    });
    expect(subtree.selectedFolderFilter).toEqual({
      kind: "subtree",
      id: asFolderId("fld_t"),
    });
  });
  it("openFolderDeleteConfirm sets dialog union", () => {
    const next = openFolderDeleteConfirm(initialUiState, asFolderId("fld_t"));
    expect(next.dialog).toEqual({
      kind: "folder-delete-confirm",
      id: asFolderId("fld_t"),
    });
  });
  it("initial state has filter=all + empty collapsed set + no editing", () => {
    expect(initialUiState.selectedFolderFilter).toEqual({ kind: "all" });
    expect(initialUiState.collapsedFolderIds.size).toBe(0);
    expect(initialUiState.editingFolderId).toBeNull();
  });
});

import { setTagFilter, openTagDeleteConfirm } from "@/store/slices/ui-slice";
import { asTagId } from "@/types";

describe("tag ui-slice reducers", () => {
  it("initial state has selectedTagId=null", () => {
    expect(initialUiState.selectedTagId).toBeNull();
  });
  it("setTagFilter updates selectedTagId", () => {
    const next = setTagFilter(initialUiState, asTagId("tag_AI"));
    expect(next.selectedTagId).toBe(asTagId("tag_AI"));
    const cleared = setTagFilter(next, null);
    expect(cleared.selectedTagId).toBeNull();
  });
  it("openTagDeleteConfirm sets dialog union", () => {
    const next = openTagDeleteConfirm(initialUiState, asTagId("tag_AI"));
    expect(next.dialog).toEqual({
      kind: "tag-delete-confirm",
      id: asTagId("tag_AI"),
    });
  });
});

import {
  openCommandPalette,
  closeCommandPalette,
} from "@/store/slices/ui-slice";

describe("openCommandPalette / closeCommandPalette", () => {
  it("openCommandPalette flips commandPaletteOpen=true", () => {
    expect(initialUiState.commandPaletteOpen).toBe(false);
    const next = openCommandPalette(initialUiState);
    expect(next.commandPaletteOpen).toBe(true);
  });

  it("closeCommandPalette flips back to false", () => {
    const opened = openCommandPalette(initialUiState);
    const closed = closeCommandPalette(opened);
    expect(closed.commandPaletteOpen).toBe(false);
  });

  it("openCommandPalette is a no-op when already open (reference equality)", () => {
    const opened = openCommandPalette(initialUiState);
    const second = openCommandPalette(opened);
    expect(second).toBe(opened);
  });

  it("closeCommandPalette is a no-op when already closed", () => {
    const closed = closeCommandPalette(initialUiState);
    expect(closed).toBe(initialUiState);
  });
});

describe("openSyncQueueDialog (F14)", () => {
  it("sets dialog kind to sync-queue", () => {
    const next = openSyncQueueDialog(initialUiState);
    expect(next.dialog).toEqual({ kind: "sync-queue" });
  });

  it("preserves other ui state", () => {
    const seed = {
      ...initialUiState,
      selection: new Set([asBookmarkId("b1")]),
      focusBookmarkId: asBookmarkId("b2"),
    };
    const next = openSyncQueueDialog(seed);
    expect(next.selection).toBe(seed.selection);
    expect(next.focusBookmarkId).toBe(seed.focusBookmarkId);
  });
});

describe("openMobileDrawer / closeMobileDrawer (Mobile UX)", () => {
  it("openMobileDrawer flips mobileDrawerOpen=true", () => {
    expect(initialUiState.mobileDrawerOpen).toBe(false);
    const next = openMobileDrawer(initialUiState);
    expect(next.mobileDrawerOpen).toBe(true);
  });

  it("closeMobileDrawer flips back to false", () => {
    const opened = openMobileDrawer(initialUiState);
    const closed = closeMobileDrawer(opened);
    expect(closed.mobileDrawerOpen).toBe(false);
  });

  it("openMobileDrawer is a no-op when already open (reference equality)", () => {
    const opened = openMobileDrawer(initialUiState);
    const second = openMobileDrawer(opened);
    expect(second).toBe(opened);
  });

  it("closeMobileDrawer is a no-op when already closed", () => {
    const closed = closeMobileDrawer(initialUiState);
    expect(closed).toBe(initialUiState);
  });
});

describe("similar filter mode (F29)", () => {
  const bk = asBookmarkId("bk_1");

  it("setSimilarTo sets the id and clears competing filters", () => {
    const start = {
      ...initialUiState,
      selectedTagId: "t1" as never,
      activeSmartCollectionId: "sc1" as never,
      readStateFilter: "inbox" as never,
    };
    const next = setSimilarTo(start, bk);
    expect(next.similarToBookmarkId).toBe(bk);
    expect(next.selectedTagId).toBeNull();
    expect(next.activeSmartCollectionId).toBeNull();
    expect(next.readStateFilter).toBeNull();
    expect(next.selectedFolderFilter).toEqual({ kind: "all" });
  });

  it("competing setters clear similarToBookmarkId", () => {
    const start = { ...initialUiState, similarToBookmarkId: bk };
    expect(
      setFolderFilter(start, { kind: "all" }).similarToBookmarkId
    ).toBeNull();
    expect(setTagFilter(start, null).similarToBookmarkId).toBeNull();
    expect(setReadStateFilter(start, null).similarToBookmarkId).toBeNull();
    expect(
      setActiveSmartCollection(start, null).similarToBookmarkId
    ).toBeNull();
  });

  it("openImportExportDialog sets dialog kind", () => {
    const next = openImportExportDialog(initialUiState);
    expect(next.dialog).toEqual({ kind: "import-export" });
  });

  it("setLinkStatusFilter sets + clears competing filters", () => {
    const seeded = setSimilarTo(initialUiState, asBookmarkId("bk_1"));
    const s = setLinkStatusFilter(seeded, "broken");
    expect(s.linkStatusFilter).toBe("broken");
    expect(s.similarToBookmarkId).toBeNull();
    expect(s.selectedTagId).toBeNull();
  });

  it("setReadStateFilter clears linkStatusFilter", () => {
    const s = setLinkStatusFilter(initialUiState, "broken");
    expect(setReadStateFilter(s, "inbox").linkStatusFilter).toBeNull();
  });
});
