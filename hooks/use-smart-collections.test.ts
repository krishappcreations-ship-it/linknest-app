import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "@/store";
import { getUseSmartCollectionsApi } from "@/hooks/use-smart-collections";
import {
  initialBookmarksState,
  addBookmark,
} from "@/store/slices/bookmarks-slice";
import { initialFoldersState } from "@/store/slices/folders-slice";
import { initialUiState } from "@/store/slices/ui-slice";
import { initialSmartCollectionsState } from "@/store/slices/smart-collections-slice";
import { memorySmartCollectionsAdapter } from "@/lib/db/smart-collections-adapter";
import { buildBookmark, asBookmarkId, asSmartCollectionId } from "@/types";

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    folders: initialFoldersState,
    ui: initialUiState,
    smartCollections: initialSmartCollectionsState,
    smartCollectionsAdapter: memorySmartCollectionsAdapter(),
    articleReadingMinutes: {},
  });
});

describe("useSmartCollections", () => {
  it("create persists + appears in collections", async () => {
    const api = getUseSmartCollectionsApi();
    const id = await api.create({
      name: "Untagged",
      rules: [{ field: "untagged" }],
    });
    expect(api.collections.map((c) => c.id)).toContain(id);
  });

  it("select sets active + clears folder/tag/read-state", async () => {
    const api = getUseSmartCollectionsApi();
    useStore.setState((s) => ({
      ui: {
        ...s.ui,
        selectedTagId: null,
        selectedFolderFilter: { kind: "unfiled" },
      },
    }));
    const id = await api.create({ name: "X", rules: [{ field: "untagged" }] });
    api.select(id);
    const ui = useStore.getState().ui;
    expect(ui.activeSmartCollectionId).toBe(id);
    expect(ui.selectedFolderFilter).toEqual({ kind: "all" });
  });

  it("select(null) clears active", async () => {
    const api = getUseSmartCollectionsApi();
    const id = await api.create({ name: "X", rules: [{ field: "untagged" }] });
    api.select(id);
    api.select(null);
    expect(useStore.getState().ui.activeSmartCollectionId).toBeNull();
  });

  it("remove deletes; clears active if it was selected", async () => {
    const api = getUseSmartCollectionsApi();
    const id = await api.create({ name: "X", rules: [{ field: "untagged" }] });
    api.select(id);
    await api.remove(id);
    expect(api.collections).toHaveLength(0);
    expect(useStore.getState().ui.activeSmartCollectionId).toBeNull();
  });

  it("count matches via the evaluator", async () => {
    const a = buildBookmark(
      { url: "https://a.com" },
      { now: () => 1, id: () => asBookmarkId("bk_a") }
    );
    const b = buildBookmark(
      { url: "https://b.com", tagIds: ["tag_1"] },
      { now: () => 2, id: () => asBookmarkId("bk_b") }
    );
    useStore.setState((s) => ({
      bookmarks: addBookmark(addBookmark(s.bookmarks, a).next, b).next,
    }));
    const api = getUseSmartCollectionsApi();
    const id = await api.create({
      name: "Untagged",
      rules: [{ field: "untagged" }],
    });
    expect(api.count(id)).toBe(1); // only bk_a is untagged
  });
});
