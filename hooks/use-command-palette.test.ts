import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStore } from "@/store";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { initialFoldersState } from "@/store/slices/folders-slice";
import { initialTagsState } from "@/store/slices/tags-slice";
import { initialUiState } from "@/store/slices/ui-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { memoryPreviewCacheAdapter } from "@/lib/db/preview-cache-adapter";

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

describe("useCommandPalette", () => {
  it("reads commandPaletteOpen from store", () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.open).toBe(false);
  });

  it("setOpen(true) writes to store", () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => result.current.setOpen(true));
    expect(useStore.getState().ui.commandPaletteOpen).toBe(true);
  });

  it("setOpen(false) closes", () => {
    const { result } = renderHook(() => useCommandPalette());
    act(() => result.current.setOpen(true));
    act(() => result.current.setOpen(false));
    expect(useStore.getState().ui.commandPaletteOpen).toBe(false);
  });

  it("Cmd+K keydown toggles open state", () => {
    renderHook(() => useCommandPalette());
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(useStore.getState().ui.commandPaletteOpen).toBe(true);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(useStore.getState().ui.commandPaletteOpen).toBe(false);
  });

  it("Ctrl+K (non-mac) also triggers", () => {
    renderHook(() => useCommandPalette());
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(useStore.getState().ui.commandPaletteOpen).toBe(true);
  });

  it("plain k keydown does NOT trigger", () => {
    renderHook(() => useCommandPalette());
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(useStore.getState().ui.commandPaletteOpen).toBe(false);
  });
});
