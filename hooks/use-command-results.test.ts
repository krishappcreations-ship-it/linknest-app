import { describe, expect, it, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStore } from "@/store";
import { useCommandResults } from "@/hooks/use-command-results";
import {
  initialBookmarksState,
  addBookmark,
} from "@/store/slices/bookmarks-slice";
import { initialFoldersState, addFolder } from "@/store/slices/folders-slice";
import { initialTagsState, addTag } from "@/store/slices/tags-slice";
import { initialUiState } from "@/store/slices/ui-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import {
  buildBookmark,
  buildFolder,
  buildTag,
  asBookmarkId,
  asFolderId,
  asTagId,
} from "@/types";

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

describe("useCommandResults", () => {
  it("zero-state returns the base actions + zero navigation + zero bookmarks when store is empty", () => {
    const { result } = renderHook(() => useCommandResults());
    expect(result.current.actions).toHaveLength(6);
    expect(result.current.actions.map((a) => a.label)).toEqual([
      "Add bookmark",
      "New folder",
      "Clear filters",
      "Check link health",
      "Import bookmarks",
      "Export bookmarks",
    ]);
    expect(result.current.navigation).toHaveLength(0);
    expect(result.current.bookmarks).toHaveLength(0);
  });

  it("navigation has one row per folder + one per tag", () => {
    const folder = buildFolder(
      { name: "Work", parentId: null },
      { now: () => 1, id: () => asFolderId("fld_work") }
    );
    const tag = buildTag(
      { name: "AI" },
      { now: () => 1, id: () => asTagId("tag_ai") }
    );
    useStore.setState((s) => ({
      folders: addFolder(s.folders, folder).next,
      tags: addTag(s.tags, tag).next,
    }));
    const { result } = renderHook(() => useCommandResults());
    expect(result.current.navigation.map((n) => n.label).sort()).toEqual([
      "Filter by AI",
      "Go to Work",
    ]);
  });

  it("bookmarks list excludes tombstoned rows", () => {
    const live = buildBookmark(
      { url: "https://a.test", title: "Live" },
      { now: () => 1, id: () => asBookmarkId("bk_a") }
    );
    const dead = {
      ...buildBookmark(
        { url: "https://b.test", title: "Dead" },
        { now: () => 1, id: () => asBookmarkId("bk_b") }
      ),
      deletedAt: 1,
    };
    useStore.setState((s) => ({
      bookmarks: addBookmark(addBookmark(s.bookmarks, live).next, dead).next,
    }));
    const { result } = renderHook(() => useCommandResults());
    expect(result.current.bookmarks.map((b) => b.label)).toEqual(["Live"]);
  });

  it("bookmark searchableValue concatenates title + domain + url + description + tag names", () => {
    const tag = buildTag(
      { name: "Research" },
      { now: () => 1, id: () => asTagId("tag_r") }
    );
    const b = {
      ...buildBookmark(
        {
          url: "https://example.com/foo",
          title: "Foo",
          description: "About foo",
        },
        { now: () => 1, id: () => asBookmarkId("bk_a") }
      ),
      tagIds: [asTagId("tag_r")],
    };
    useStore.setState((s) => ({
      tags: addTag(s.tags, tag).next,
      bookmarks: addBookmark(s.bookmarks, b).next,
    }));
    const { result } = renderHook(() => useCommandResults());
    const sv = result.current.bookmarks[0]?.searchableValue ?? "";
    expect(sv).toContain("foo");
    expect(sv).toContain("example.com");
    expect(sv).toContain("about foo");
    expect(sv).toContain("research");
  });
});

describe("Sync queue action (F14)", () => {
  it("appears when auth.status === signed-in", () => {
    useStore.setState((s) => ({
      auth: {
        ...s.auth,
        status: "signed-in",
        userId: "u1",
        email: "a@b",
        avatarUrl: null,
      },
    }));
    const { result } = renderHook(() => useCommandResults());
    const action = result.current.actions.find(
      (a) => a.id === "action:sync-queue"
    );
    expect(action).toBeDefined();
    expect(action?.label).toBe("Sync queue");
  });

  it("absent when anon", () => {
    useStore.setState((s) => ({
      auth: {
        ...s.auth,
        status: "anon",
        userId: null,
        email: null,
        avatarUrl: null,
      },
    }));
    const { result } = renderHook(() => useCommandResults());
    expect(
      result.current.actions.find((a) => a.id === "action:sync-queue")
    ).toBeUndefined();
  });

  it("onSelect opens sync-queue dialog + closes palette", () => {
    useStore.setState((s) => ({
      auth: {
        ...s.auth,
        status: "signed-in",
        userId: "u1",
        email: "a@b",
        avatarUrl: null,
      },
      ui: { ...s.ui, commandPaletteOpen: true, dialog: { kind: "closed" } },
    }));
    const { result } = renderHook(() => useCommandResults());
    const action = result.current.actions.find(
      (a) => a.id === "action:sync-queue"
    )!;
    action.onSelect();
    expect(useStore.getState().ui.dialog).toEqual({ kind: "sync-queue" });
    expect(useStore.getState().ui.commandPaletteOpen).toBe(false);
  });
});

describe("useCommandResults full-text (feature 26)", () => {
  it("folds article body into a bookmark's searchableValue", () => {
    const b = buildBookmark(
      { url: "https://x.test/" },
      { now: () => 1, id: () => asBookmarkId("bk_ft") }
    );
    useStore.setState((s) => ({
      bookmarks: addBookmark(s.bookmarks, b).next,
      articleText: { [b.id]: "zerotrust architecture deep dive" },
    }));
    const { result } = renderHook(() => useCommandResults());
    const row = result.current.bookmarks.find(
      (r) => r.id === `bookmark:${b.id}`
    );
    expect(row).toBeDefined();
    expect(row!.searchableValue).toContain("zerotrust");
  });

  it("omits body text when the bookmark has no captured article", () => {
    const b = buildBookmark(
      { url: "https://y.test/" },
      { now: () => 1, id: () => asBookmarkId("bk_no") }
    );
    useStore.setState((s) => ({
      bookmarks: addBookmark(s.bookmarks, b).next,
      articleText: {},
    }));
    const { result } = renderHook(() => useCommandResults());
    const row = result.current.bookmarks.find(
      (r) => r.id === `bookmark:${b.id}`
    );
    expect(row!.searchableValue).not.toContain("zerotrust");
  });
});
