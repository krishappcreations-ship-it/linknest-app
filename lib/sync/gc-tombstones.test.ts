/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useStore } from "@/store";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import {
  initialFoldersState,
  addFolder,
  tombstoneFolder,
} from "@/store/slices/folders-slice";
import {
  initialTagsState,
  addTag,
  tombstoneTag,
} from "@/store/slices/tags-slice";
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

const { deleteMock, fromMock, supabaseMock } = vi.hoisted(() => {
  const deleteChain = {
    lt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  const deleteMock = vi.fn(() => deleteChain);
  const fromMock = vi.fn(() => ({ delete: deleteMock }));
  return {
    deleteMock,
    fromMock,
    supabaseMock: { from: fromMock },
  };
});

vi.mock("@/lib/sync/supabase-client", () => ({
  getSupabaseClient: () => supabaseMock,
}));

import { purgeTombstones } from "@/lib/sync/gc-tombstones";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("purgeTombstones (F15)", () => {
  beforeEach(() => {
    fromMock.mockClear();
    deleteMock.mockClear();
    useStore.setState({
      bookmarks: initialBookmarksState,
      folders: initialFoldersState,
      tags: initialTagsState,
      bookmarksAdapter: memoryBookmarksAdapter(),
      foldersAdapter: memoryFoldersAdapter(),
      tagsAdapter: memoryTagsAdapter(),
    });
  });

  it("purges bookmark tombstones older than 30 days from Dexie + store", async () => {
    const now = Date.now();
    const stale = {
      ...buildBookmark(
        { url: "https://stale.test/" },
        { now: () => now - 35 * DAY_MS, id: () => asBookmarkId("stale") }
      ),
      deletedAt: now - 31 * DAY_MS,
    };
    const fresh = {
      ...buildBookmark(
        { url: "https://fresh.test/" },
        { now: () => now - 10 * DAY_MS, id: () => asBookmarkId("fresh") }
      ),
      deletedAt: now - 10 * DAY_MS,
    };
    const alive = buildBookmark(
      { url: "https://alive.test/" },
      { now: () => now, id: () => asBookmarkId("alive") }
    );
    useStore.setState({
      bookmarks: {
        byId: { [stale.id]: stale, [fresh.id]: fresh, [alive.id]: alive },
        order: [stale.id, fresh.id, alive.id],
      },
    });
    await useStore.getState().bookmarksAdapter.put(stale);
    await useStore.getState().bookmarksAdapter.put(fresh);
    await useStore.getState().bookmarksAdapter.put(alive);

    await purgeTombstones("user-123");

    const after = useStore.getState().bookmarks;
    expect(after.byId[stale.id]).toBeUndefined();
    expect(after.byId[fresh.id]).toBeDefined();
    expect(after.byId[alive.id]).toBeDefined();
    expect(after.order).toEqual([fresh.id, alive.id]);
    const dexie = await useStore.getState().bookmarksAdapter.list();
    expect(dexie.find((b) => b.id === stale.id)).toBeUndefined();
  });

  it("purges folder tombstones older than 30 days from byId", async () => {
    const now = Date.now();
    const live = buildFolder(
      { name: "Live", parentId: null },
      { now: () => now, id: () => asFolderId("fld_Live") }
    );
    const tombed = buildFolder(
      { name: "Old", parentId: null },
      { now: () => now - 40 * DAY_MS, id: () => asFolderId("fld_Old") }
    );
    let state = addFolder(initialFoldersState, live).next;
    state = addFolder(state, tombed).next;
    state = tombstoneFolder(state, tombed.id, now - 31 * DAY_MS).next;
    useStore.setState({ folders: state });
    await useStore.getState().foldersAdapter.put(state.byId[tombed.id]!);

    await purgeTombstones("user-123");

    const after = useStore.getState().folders;
    expect(after.byId[tombed.id]).toBeUndefined();
    expect(after.byId[live.id]).toBeDefined();
  });

  it("purges tag tombstones older than 30 days from byId", async () => {
    const now = Date.now();
    const live = buildTag(
      { name: "live" },
      { now: () => now, id: () => asTagId("tag_live") }
    );
    const tombed = buildTag(
      { name: "old" },
      { now: () => now - 40 * DAY_MS, id: () => asTagId("tag_old") }
    );
    let state = addTag(initialTagsState, live).next;
    state = addTag(state, tombed).next;
    state = tombstoneTag(state, tombed.id, now - 31 * DAY_MS).next;
    useStore.setState({ tags: state });

    await purgeTombstones("user-123");

    const after = useStore.getState().tags;
    expect(after.byId[tombed.id]).toBeUndefined();
    expect(after.byId[live.id]).toBeDefined();
  });

  it("issues 3 Postgres DELETE round-trips (one per table)", async () => {
    const now = Date.now();
    useStore.setState({
      bookmarks: {
        byId: {
          [asBookmarkId("a")]: {
            ...buildBookmark(
              { url: "https://x/" },
              { now: () => now, id: () => asBookmarkId("a") }
            ),
            deletedAt: now - 40 * DAY_MS,
          },
        },
        order: [asBookmarkId("a")],
      },
    });
    const live = buildFolder(
      { name: "Live", parentId: null },
      { now: () => now, id: () => asFolderId("fld_Live") }
    );
    const tombed = buildFolder(
      { name: "Old", parentId: null },
      { now: () => now - 40 * DAY_MS, id: () => asFolderId("fld_Old") }
    );
    let fState = addFolder(initialFoldersState, live).next;
    fState = addFolder(fState, tombed).next;
    fState = tombstoneFolder(fState, tombed.id, now - 31 * DAY_MS).next;
    useStore.setState({ folders: fState });

    const liveTag = buildTag(
      { name: "live" },
      { now: () => now, id: () => asTagId("tag_live") }
    );
    const tombedTag = buildTag(
      { name: "old" },
      { now: () => now - 40 * DAY_MS, id: () => asTagId("tag_old") }
    );
    let tState = addTag(initialTagsState, liveTag).next;
    tState = addTag(tState, tombedTag).next;
    tState = tombstoneTag(tState, tombedTag.id, now - 31 * DAY_MS).next;
    useStore.setState({ tags: tState });

    await purgeTombstones("user-123");

    const tables = fromMock.mock.calls.map(
      (c) => (c as unknown as [string])[0]
    );
    expect(tables).toContain("bookmarks");
    expect(tables).toContain("folders");
    expect(tables).toContain("tags");
  });

  it("does nothing when no stale tombstones exist", async () => {
    await purgeTombstones("user-123");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("is idempotent — second call is a no-op (already purged)", async () => {
    const now = Date.now();
    const stale = {
      ...buildBookmark(
        { url: "https://stale.test/" },
        { now: () => now - 40 * DAY_MS, id: () => asBookmarkId("stale") }
      ),
      deletedAt: now - 31 * DAY_MS,
    };
    useStore.setState({
      bookmarks: { byId: { [stale.id]: stale }, order: [stale.id] },
    });

    await purgeTombstones("user-123");
    fromMock.mockClear();
    await purgeTombstones("user-123");

    expect(fromMock).not.toHaveBeenCalled();
  });
});
