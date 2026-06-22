import { describe, expect, it, beforeEach } from "vitest";
import { useStore } from "@/store";
import { getUseTagsApi } from "@/hooks/use-tags";
import { initialTagsState, selectTagById } from "@/store/slices/tags-slice";
import { initialFoldersState } from "@/store/slices/folders-slice";
import {
  initialBookmarksState,
  addBookmark,
} from "@/store/slices/bookmarks-slice";
import { initialUiState } from "@/store/slices/ui-slice";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import { buildBookmark, asTagId, asBookmarkId } from "@/types";

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

describe("useTags.createOrGet", () => {
  it("creates a new tag and persists", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_AI"),
    });
    const tag = await api.createOrGet("AI");
    expect(tag?.name).toBe("AI");
    expect(
      selectTagById(useStore.getState().tags, asTagId("tag_AI"))
    ).not.toBeNull();
  });

  it("returns existing tag on case-insensitive match (no dup)", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_AI"),
    });
    await api.createOrGet("AI");
    const second = await api.createOrGet("ai");
    expect(second?.id).toBe(asTagId("tag_AI"));
    expect(useStore.getState().tags.order).toHaveLength(1);
  });

  it("returns null + does not write for empty name", async () => {
    const api = getUseTagsApi();
    const tag = await api.createOrGet("   ");
    expect(tag).toBeNull();
    expect(useStore.getState().tags.order).toHaveLength(0);
  });
});

describe("useTags.rename", () => {
  it("renames + persists", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_AI"),
    });
    await api.createOrGet("AI");
    await api.rename(asTagId("tag_AI"), "ML");
    expect(useStore.getState().tags.byId[asTagId("tag_AI")]!.name).toBe("ML");
  });

  it("emits collision toast on case-insensitive duplicate", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_AI"),
    });
    const api2 = getUseTagsApi({
      now: () => 2,
      id: () => asTagId("tag_ML"),
    });
    await api.createOrGet("AI");
    await api2.createOrGet("ML");
    await api.rename(asTagId("tag_AI"), "ml");
    const toasts = useStore.getState().ui.toasts;
    expect(
      toasts.some((t) => t.title.toLowerCase().includes("already exists"))
    ).toBe(true);
  });
});

describe("useTags.remove", () => {
  it("empty tag removes immediately (no dialog)", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_X"),
    });
    await api.createOrGet("X");
    await api.remove(asTagId("tag_X"));
    // Tombstoned, not removed — row stays in byId with deletedAt set.
    expect(
      useStore.getState().tags.byId[asTagId("tag_X")]?.deletedAt
    ).not.toBeNull();
    expect(useStore.getState().ui.dialog.kind).toBe("closed");
  });

  it("non-empty tag opens confirm dialog", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_X"),
    });
    await api.createOrGet("X");
    useStore.setState((s) => {
      const b = {
        ...buildBookmark(
          { url: "https://a.test" },
          { now: () => 1, id: () => asBookmarkId("bk_a") }
        ),
        tagIds: [asTagId("tag_X")],
      };
      return { bookmarks: addBookmark(s.bookmarks, b).next };
    });
    await api.remove(asTagId("tag_X"));
    expect(useStore.getState().ui.dialog).toEqual({
      kind: "tag-delete-confirm",
      id: asTagId("tag_X"),
    });
    expect(useStore.getState().tags.byId[asTagId("tag_X")]).toBeDefined();
  });

  it("remove with confirmed:true cascades + emits toast", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_X"),
    });
    await api.createOrGet("X");
    useStore.setState((s) => {
      const b = {
        ...buildBookmark(
          { url: "https://a.test" },
          { now: () => 1, id: () => asBookmarkId("bk_a") }
        ),
        tagIds: [asTagId("tag_X")],
      };
      return { bookmarks: addBookmark(s.bookmarks, b).next };
    });
    await api.remove(asTagId("tag_X"), { confirmed: true });
    // Tombstoned, not removed.
    expect(
      useStore.getState().tags.byId[asTagId("tag_X")]?.deletedAt
    ).not.toBeNull();
    // Per Q3: bookmarks NOT cascade-updated. Ghost tag id retained.
    expect(
      useStore.getState().bookmarks.byId[asBookmarkId("bk_a")]!.tagIds
    ).toEqual([asTagId("tag_X")]);
    const toasts = useStore.getState().ui.toasts;
    expect(toasts.some((t) => t.title.includes("Deleted"))).toBe(true);
  });

  it("clears selectedTagId when the active filter tag is deleted", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_X"),
    });
    await api.createOrGet("X");
    api.setFilter(asTagId("tag_X"));
    expect(useStore.getState().ui.selectedTagId).toBe(asTagId("tag_X"));
    await api.remove(asTagId("tag_X"), { confirmed: true });
    expect(useStore.getState().ui.selectedTagId).toBeNull();
  });

  it("leaves selectedTagId untouched when a different tag is deleted", async () => {
    let nextId = 0;
    const ids = [asTagId("tag_X"), asTagId("tag_Y")];
    const api = getUseTagsApi({
      now: () => 1,
      id: () => ids[nextId++]!,
    });
    await api.createOrGet("X");
    await api.createOrGet("Y");
    api.setFilter(asTagId("tag_Y"));
    await api.remove(asTagId("tag_X"), { confirmed: true });
    expect(useStore.getState().ui.selectedTagId).toBe(asTagId("tag_Y"));
  });
});

describe("useTags.setFilter", () => {
  it("updates selectedTagId", () => {
    const api = getUseTagsApi();
    api.setFilter(asTagId("tag_X"));
    expect(useStore.getState().ui.selectedTagId).toBe(asTagId("tag_X"));
    api.setFilter(null);
    expect(useStore.getState().ui.selectedTagId).toBeNull();
  });
});

describe("useTags.tags includes live counts", () => {
  it("counts bookmarks containing each tag", async () => {
    const api = getUseTagsApi({
      now: () => 1,
      id: () => asTagId("tag_X"),
    });
    await api.createOrGet("X");
    useStore.setState((s) => {
      const b1 = {
        ...buildBookmark(
          { url: "https://a.test" },
          { now: () => 1, id: () => asBookmarkId("bk_a") }
        ),
        tagIds: [asTagId("tag_X")],
      };
      const b2 = {
        ...buildBookmark(
          { url: "https://b.test" },
          { now: () => 2, id: () => asBookmarkId("bk_b") }
        ),
        tagIds: [asTagId("tag_X")],
      };
      const next1 = addBookmark(s.bookmarks, b1).next;
      const next2 = addBookmark(next1, b2).next;
      return { bookmarks: next2 };
    });
    const api2 = getUseTagsApi();
    const list = api2.tags;
    expect(list[0]?.count).toBe(2);
  });
});
