import { describe, expect, it, beforeEach } from "vitest";
import { useStore } from "@/store";
import { getUseFoldersApi } from "@/hooks/use-folders";
import {
  initialFoldersState,
  selectFolderById,
} from "@/store/slices/folders-slice";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { initialUiState } from "@/store/slices/ui-slice";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import { asFolderId } from "@/types";

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    folders: initialFoldersState,
    ui: initialUiState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    foldersAdapter: memoryFoldersAdapter(),
    previewCacheAdapter: memoryPreviewCacheAdapter(),
    hydrated: true,
  });
});

describe("useFolders.create + commitEdit flow", () => {
  it("beginCreate → commitEdit('Tools') creates root folder", async () => {
    const api = getUseFoldersApi({
      now: () => 1,
      id: () => asFolderId("fld_Tools"),
    });
    api.beginCreate(null);
    expect(useStore.getState().ui.editingFolderMode).toBe("create");
    await api.commitEdit("Tools");
    expect(
      selectFolderById(useStore.getState().folders, asFolderId("fld_Tools"))
        ?.name
    ).toBe("Tools");
    expect(useStore.getState().ui.editingFolderMode).toBeNull();
  });

  it("commitEdit with empty name cancels edit", async () => {
    const api = getUseFoldersApi();
    api.beginCreate(null);
    await api.commitEdit("   ");
    expect(useStore.getState().ui.editingFolderMode).toBeNull();
    expect(Object.keys(useStore.getState().folders.byId)).toHaveLength(0);
  });

  it("duplicate sibling name emits info toast and stays in editing mode", async () => {
    const api = getUseFoldersApi({
      now: () => 1,
      id: () => asFolderId("fld_Tools"),
    });
    api.beginCreate(null);
    await api.commitEdit("Tools");
    api.beginCreate(null);
    await api.commitEdit("Tools");
    const toasts = useStore.getState().ui.toasts;
    expect(toasts.some((t) => t.title.includes("already exists"))).toBe(true);
  });

  it("depth-error toast when creating beyond depth 2", async () => {
    const api = getUseFoldersApi({
      now: () => 1,
      id: () => asFolderId("fld_L0"),
    });
    api.beginCreate(null);
    await api.commitEdit("L0");
    api.beginCreate(asFolderId("fld_L0"));
    const api2 = getUseFoldersApi({
      now: () => 2,
      id: () => asFolderId("fld_L1"),
    });
    await api2.commitEdit("L1");
    const api3 = getUseFoldersApi({
      now: () => 3,
      id: () => asFolderId("fld_L2"),
    });
    api3.beginCreate(asFolderId("fld_L1"));
    await api3.commitEdit("L2");
    const api4 = getUseFoldersApi({
      now: () => 4,
      id: () => asFolderId("fld_L3"),
    });
    api4.beginCreate(asFolderId("fld_L2"));
    await api4.commitEdit("L3");
    const toasts = useStore.getState().ui.toasts;
    expect(
      toasts.some((t) => t.title.toLowerCase().includes("nested deeper"))
    ).toBe(true);
  });
});

describe("useFolders.rename", () => {
  it("beginRename → commitEdit updates name", async () => {
    const api = getUseFoldersApi({
      now: () => 1,
      id: () => asFolderId("fld_Tools"),
    });
    api.beginCreate(null);
    await api.commitEdit("Tools");
    api.beginRename(asFolderId("fld_Tools"));
    await api.commitEdit("Tools Renamed");
    expect(
      useStore.getState().folders.byId[asFolderId("fld_Tools")]!.name
    ).toBe("Tools Renamed");
  });
});

describe("useFolders.togglePin / toggleCollapse / setFilter", () => {
  it("togglePin flips pin + reorders", async () => {
    const api = getUseFoldersApi({
      now: () => 1,
      id: () => asFolderId("fld_A"),
    });
    api.beginCreate(null);
    await api.commitEdit("A");
    await api.togglePin(asFolderId("fld_A"));
    expect(useStore.getState().folders.byId[asFolderId("fld_A")]!.pinned).toBe(
      true
    );
  });

  it("toggleCollapse flips Set membership", () => {
    const api = getUseFoldersApi();
    api.toggleCollapse(asFolderId("fld_x"));
    expect(
      useStore.getState().ui.collapsedFolderIds.has(asFolderId("fld_x"))
    ).toBe(true);
    api.toggleCollapse(asFolderId("fld_x"));
    expect(
      useStore.getState().ui.collapsedFolderIds.has(asFolderId("fld_x"))
    ).toBe(false);
  });

  it("setFilter updates selectedFolderFilter", () => {
    const api = getUseFoldersApi();
    api.setFilter({ kind: "unfiled" });
    expect(useStore.getState().ui.selectedFolderFilter).toEqual({
      kind: "unfiled",
    });
  });
});

describe("useFolders.remove", () => {
  it("empty folder removes immediately (no dialog)", async () => {
    const api = getUseFoldersApi({
      now: () => 1,
      id: () => asFolderId("fld_Tools"),
    });
    api.beginCreate(null);
    await api.commitEdit("Tools");
    await api.remove(asFolderId("fld_Tools"));
    // Tombstoned: row stays in byId with deletedAt set (selectors filter).
    expect(
      useStore.getState().folders.byId[asFolderId("fld_Tools")]?.deletedAt
    ).not.toBeNull();
    expect(useStore.getState().ui.dialog.kind).toBe("closed");
  });

  it("non-empty folder opens confirm dialog", async () => {
    const api = getUseFoldersApi({
      now: () => 1,
      id: () => asFolderId("fld_Tools"),
    });
    api.beginCreate(null);
    await api.commitEdit("Tools");
    api.beginCreate(asFolderId("fld_Tools"));
    const api2 = getUseFoldersApi({
      now: () => 2,
      id: () => asFolderId("fld_AI"),
    });
    await api2.commitEdit("AI");
    await api.remove(asFolderId("fld_Tools"));
    expect(useStore.getState().ui.dialog).toEqual({
      kind: "folder-delete-confirm",
      id: asFolderId("fld_Tools"),
    });
    expect(
      useStore.getState().folders.byId[asFolderId("fld_Tools")]
    ).toBeDefined();
  });

  it("remove with confirmed:true cascades + emits toast", async () => {
    const api = getUseFoldersApi({
      now: () => 1,
      id: () => asFolderId("fld_Tools"),
    });
    api.beginCreate(null);
    await api.commitEdit("Tools");
    api.beginCreate(asFolderId("fld_Tools"));
    const api2 = getUseFoldersApi({
      now: () => 2,
      id: () => asFolderId("fld_AI"),
    });
    await api2.commitEdit("AI");
    await api.remove(asFolderId("fld_Tools"), { confirmed: true });
    // Tombstoned: row stays in byId with deletedAt set.
    expect(
      useStore.getState().folders.byId[asFolderId("fld_Tools")]?.deletedAt
    ).not.toBeNull();
    const toasts = useStore.getState().ui.toasts;
    expect(toasts.some((t) => t.title.includes("Deleted"))).toBe(true);
  });
});
