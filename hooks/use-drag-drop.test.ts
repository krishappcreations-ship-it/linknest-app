import { describe, expect, it, beforeEach } from "vitest";
import { useStore } from "@/store";
import { getUseDragDropApi } from "@/hooks/use-drag-drop";
import {
  initialBookmarksState,
  addBookmark,
} from "@/store/slices/bookmarks-slice";
import { initialFoldersState, addFolder } from "@/store/slices/folders-slice";
import { initialTagsState } from "@/store/slices/tags-slice";
import { initialUiState } from "@/store/slices/ui-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import { buildBookmark, buildFolder, asBookmarkId, asFolderId } from "@/types";

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    folders: initialFoldersState,
    tags: initialTagsState,
    ui: initialUiState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    foldersAdapter: memoryFoldersAdapter(),
    tagsAdapter: memoryTagsAdapter(),
    previewCacheAdapter: memoryPreviewCacheAdapter(),
    hydrated: true,
  });
});

function seedTwoBookmarks() {
  const a = buildBookmark(
    { url: "https://a.test" },
    { now: () => 1, id: () => asBookmarkId("bk_a") }
  );
  const b = buildBookmark(
    { url: "https://b.test" },
    { now: () => 2, id: () => asBookmarkId("bk_b") }
  );
  useStore.setState((s) => ({
    bookmarks: addBookmark(addBookmark(s.bookmarks, a).next, b).next,
  }));
}

describe("useDragDrop.handleDragEnd", () => {
  it("reorders bookmarks when active+over are both bookmark sortables", async () => {
    seedTwoBookmarks();
    const api = getUseDragDropApi();
    await api.handleDragEnd({
      active: { id: "bookmark:bk_a:sortable" },
      over: { id: "bookmark:bk_b:sortable" },
    } as never);
    const order = useStore.getState().bookmarks.order;
    // addBookmark inserts at head: order before drag = [bk_b, bk_a] (b most recent).
    // Drag bk_a (idx 1) onto bk_b (idx 0) → bk_a moves to idx 0.
    expect(order[0]).toBe(asBookmarkId("bk_a"));
  });

  it("moves bookmark into folder when over.id is folder:<id>:body", async () => {
    const f = buildFolder(
      { name: "Work", parentId: null },
      { now: () => 1, id: () => asFolderId("fld_work") }
    );
    useStore.setState((s) => ({
      folders: addFolder(s.folders, f).next,
    }));
    seedTwoBookmarks();
    const api = getUseDragDropApi();
    await api.handleDragEnd({
      active: { id: "bookmark:bk_a:sortable" },
      over: { id: "folder:fld_work:body" },
    } as never);
    const updated = useStore.getState().bookmarks.byId[asBookmarkId("bk_a")];
    expect(updated?.folderId).toBe(asFolderId("fld_work"));
  });

  it("ignores drop with no over target", async () => {
    seedTwoBookmarks();
    const api = getUseDragDropApi();
    const before = useStore.getState().bookmarks.order;
    await api.handleDragEnd({
      active: { id: "bookmark:bk_a:sortable" },
      over: null,
    } as never);
    const after = useStore.getState().bookmarks.order;
    expect(after).toEqual(before);
  });
});

describe("useDragDrop.handleDragEnd — folder mutations", () => {
  it("nests folder when active is folder:<id>:sortable and over is folder:<other>:body", async () => {
    const a = buildFolder(
      { name: "A", parentId: null },
      { now: () => 1, id: () => asFolderId("fld_a") }
    );
    const b = buildFolder(
      { name: "B", parentId: null },
      { now: () => 2, id: () => asFolderId("fld_b") }
    );
    useStore.setState((s) => ({
      folders: addFolder(addFolder(s.folders, a).next, b).next,
    }));
    const api = getUseDragDropApi();
    await api.handleDragEnd({
      active: { id: "folder:fld_b:sortable" },
      over: { id: "folder:fld_a:body" },
    } as never);
    const updated = useStore.getState().folders.byId[asFolderId("fld_b")];
    expect(updated?.parentId).toBe(asFolderId("fld_a"));
  });
});

describe("useDragDrop.announcements", () => {
  it("emits a pickup string when handleDragStart fires", () => {
    seedTwoBookmarks();
    const api = getUseDragDropApi();
    const msg = api.announcements.onDragStart({
      active: { id: "bookmark:bk_a:sortable" },
    } as never);
    expect(msg).toContain("Picked up");
  });

  it("emits a drop string when handleDragEnd fires with a valid target", () => {
    seedTwoBookmarks();
    const api = getUseDragDropApi();
    const msg = api.announcements.onDragEnd({
      active: { id: "bookmark:bk_a:sortable" },
      over: { id: "bookmark:bk_b:sortable" },
    } as never);
    expect(msg).toContain("Dropped");
  });

  it("emits a cancel string when handleDragEnd fires with no over", () => {
    seedTwoBookmarks();
    const api = getUseDragDropApi();
    const msg = api.announcements.onDragEnd({
      active: { id: "bookmark:bk_a:sortable" },
      over: null,
    } as never);
    expect(msg).toMatch(/cancel/i);
  });
});

describe("useDragDrop.announcements — keyboard flow", () => {
  it("emits the expected sequence for a keyboard reorder", () => {
    seedTwoBookmarks();
    const api = getUseDragDropApi();
    const startMsg = api.announcements.onDragStart({
      active: { id: "bookmark:bk_a:sortable" },
    } as never);
    expect(startMsg).toContain("Use arrow keys");

    const overMsg = api.announcements.onDragOver({
      active: { id: "bookmark:bk_a:sortable" },
      over: { id: "bookmark:bk_b:sortable" },
    } as never);
    expect(overMsg).toContain("over");

    const endMsg = api.announcements.onDragEnd({
      active: { id: "bookmark:bk_a:sortable" },
      over: { id: "bookmark:bk_b:sortable" },
    } as never);
    expect(endMsg).toContain("Dropped");
  });

  it("describes a folder body drop with 'drop to move in'", () => {
    const f = buildFolder(
      { name: "Inbox", parentId: null },
      { now: () => 1, id: () => asFolderId("fld_inbox") }
    );
    useStore.setState((s) => ({
      folders: addFolder(s.folders, f).next,
    }));
    seedTwoBookmarks();
    const api = getUseDragDropApi();
    const msg = api.announcements.onDragOver({
      active: { id: "bookmark:bk_a:sortable" },
      over: { id: "folder:fld_inbox:body" },
    } as never);
    expect(msg).toMatch(/drop to move in|Inbox/);
  });
});
