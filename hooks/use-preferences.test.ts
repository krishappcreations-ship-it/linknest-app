import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStore } from "@/store";
import { usePreferences } from "@/hooks/use-preferences";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { initialFoldersState } from "@/store/slices/folders-slice";
import { initialTagsState } from "@/store/slices/tags-slice";
import { initialUiState } from "@/store/slices/ui-slice";
import { initialPreferencesState } from "@/store/slices/preferences-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";
import { memoryPreferencesAdapter } from "@/lib/db/preferences-adapter";

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    folders: initialFoldersState,
    tags: initialTagsState,
    ui: initialUiState,
    preferences: initialPreferencesState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    foldersAdapter: memoryFoldersAdapter(),
    tagsAdapter: memoryTagsAdapter(),
    previewCacheAdapter: memoryPreviewCacheAdapter(),
    preferencesAdapter: memoryPreferencesAdapter(),
    hydrated: true,
  });
});

describe("usePreferences", () => {
  it("reads current layout from store", () => {
    const { result } = renderHook(() => usePreferences());
    expect(result.current.layout).toBe("masonry");
  });

  it("setLayout writes to store + adapter", async () => {
    const { result } = renderHook(() => usePreferences());
    await act(async () => {
      await result.current.setLayout("list");
    });
    expect(useStore.getState().preferences.prefs.layout).toBe("list");
  });

  it("Cmd+1/2/3 sets layout", async () => {
    renderHook(() => usePreferences());
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "2",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(useStore.getState().preferences.prefs.layout).toBe("list");

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "3",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(useStore.getState().preferences.prefs.layout).toBe("gallery");

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "1",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(useStore.getState().preferences.prefs.layout).toBe("masonry");
  });

  it("plain 1 keydown does not change layout", async () => {
    renderHook(() => usePreferences());
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "1", bubbles: true })
      );
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(useStore.getState().preferences.prefs.layout).toBe("masonry");
  });
});
