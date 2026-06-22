import { describe, it, expect, beforeEach } from "vitest";
import {
  applyInboundBookmark,
  applyInboundFolder,
  applyInboundTag,
  applyDeleteBookmark,
  applyDeleteFolder,
  applyDeleteTag,
} from "@/lib/sync/sync-runtime";
import { useStore } from "@/store";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import {
  initialFoldersState,
  addFolder,
  tombstoneFolder,
} from "@/store/slices/folders-slice";
import { initialTagsState } from "@/store/slices/tags-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import {
  buildBookmark,
  buildFolder,
  buildTag,
  asBookmarkId,
  asFolderId,
  asTagId,
} from "@/types";

describe("applyInbound* helpers (F13)", () => {
  beforeEach(() => {
    useStore.setState({
      bookmarks: initialBookmarksState,
      folders: initialFoldersState,
      tags: initialTagsState,
      bookmarksAdapter: memoryBookmarksAdapter(),
      foldersAdapter: memoryFoldersAdapter(),
      tagsAdapter: memoryTagsAdapter(),
    });
  });

  it("applyInboundBookmark returns true when incoming newer", async () => {
    const b = buildBookmark(
      { url: "https://a.test/" },
      { now: () => 2000, id: () => asBookmarkId("b1") }
    );
    const wrote = await applyInboundBookmark(b);
    expect(wrote).toBe(true);
    expect(useStore.getState().bookmarks.byId[b.id]).toEqual(b);
  });

  it("applyInboundBookmark returns false when LWW guard skips (echo)", async () => {
    const b = buildBookmark(
      { url: "https://a.test/" },
      { now: () => 2000, id: () => asBookmarkId("b1") }
    );
    await applyInboundBookmark(b);
    const wrote2 = await applyInboundBookmark(b);
    expect(wrote2).toBe(false);
  });

  it("applyInboundFolder returns true when incoming newer", async () => {
    const f = buildFolder(
      { name: "Work", parentId: null },
      { now: () => 2000, id: () => asFolderId("fld_Work") }
    );
    const wrote = await applyInboundFolder(f);
    expect(wrote).toBe(true);
  });

  it("applyInboundFolder returns false on echo", async () => {
    const f = buildFolder(
      { name: "Work", parentId: null },
      { now: () => 2000, id: () => asFolderId("fld_Work") }
    );
    await applyInboundFolder(f);
    const wrote2 = await applyInboundFolder(f);
    expect(wrote2).toBe(false);
  });

  it("applyInboundTag returns true when incoming newer", async () => {
    const t = buildTag(
      { name: "react" },
      { now: () => 2000, id: () => asTagId("tag_react") }
    );
    const wrote = await applyInboundTag(t);
    expect(wrote).toBe(true);
  });

  it("applyInboundTag returns false on echo", async () => {
    const t = buildTag(
      { name: "react" },
      { now: () => 2000, id: () => asTagId("tag_react") }
    );
    await applyInboundTag(t);
    const wrote2 = await applyInboundTag(t);
    expect(wrote2).toBe(false);
  });
});

describe("applyDelete* helpers (F16)", () => {
  it("applyDeleteBookmark purges tombstoned row + returns true", async () => {
    const now = Date.now();
    const tombed = {
      ...buildBookmark(
        { url: "https://x/" },
        { now: () => now, id: () => asBookmarkId("b1") }
      ),
      deletedAt: now - 100,
    };
    useStore.setState({
      bookmarks: { byId: { [tombed.id]: tombed }, order: [tombed.id] },
    });
    await useStore.getState().bookmarksAdapter.put(tombed);

    const wrote = await applyDeleteBookmark(tombed.id);

    expect(wrote).toBe(true);
    expect(useStore.getState().bookmarks.byId[tombed.id]).toBeUndefined();
    expect(useStore.getState().bookmarks.order).toEqual([]);
  });

  it("applyDeleteBookmark refuses to delete live row (defensive)", async () => {
    const alive = buildBookmark(
      { url: "https://x/" },
      { now: () => Date.now(), id: () => asBookmarkId("b1") }
    );
    useStore.setState({
      bookmarks: { byId: { [alive.id]: alive }, order: [alive.id] },
    });

    const wrote = await applyDeleteBookmark(alive.id);

    expect(wrote).toBe(false);
    expect(useStore.getState().bookmarks.byId[alive.id]).toBeDefined();
  });

  it("applyDeleteFolder purges tombstoned row + returns true", async () => {
    const now = Date.now();
    const live = buildFolder(
      { name: "Live", parentId: null },
      { now: () => now, id: () => asFolderId("fld_Live") }
    );
    const tombed = buildFolder(
      { name: "Old", parentId: null },
      { now: () => now, id: () => asFolderId("fld_Old") }
    );
    let state = addFolder(initialFoldersState, live).next;
    state = addFolder(state, tombed).next;
    state = tombstoneFolder(state, tombed.id, now - 100).next;
    useStore.setState({ folders: state });

    const wrote = await applyDeleteFolder(tombed.id);

    expect(wrote).toBe(true);
    expect(useStore.getState().folders.byId[tombed.id]).toBeUndefined();
    expect(useStore.getState().folders.byId[live.id]).toBeDefined();
  });

  it("applyDeleteTag is idempotent on missing id (returns false)", async () => {
    useStore.setState({ tags: initialTagsState });
    const wrote = await applyDeleteTag(asTagId("tag_ghost"));
    expect(wrote).toBe(false);
  });
});
