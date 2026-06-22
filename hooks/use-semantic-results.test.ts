import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useStore } from "@/store";
import { useSemanticResults } from "@/hooks/use-semantic-results";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import {
  buildBookmark,
  asBookmarkId,
  type Bookmark,
  type BookmarkId,
} from "@/types";

function seed(rows: Bookmark[], vectors: Record<string, number[]>) {
  const byId: Record<string, Bookmark> = {};
  const order: BookmarkId[] = [];
  for (const b of rows) {
    byId[b.id] = b;
    order.push(b.id);
  }
  useStore.setState({
    bookmarks: { byId, order },
    bookmarksAdapter: memoryBookmarksAdapter(),
    embeddingById: vectors,
    hydrated: true,
  });
}

function bk(id: string, title: string): Bookmark {
  return buildBookmark(
    { url: `https://x.test/${id}`, title },
    { now: () => 1, id: () => asBookmarkId(id) }
  );
}

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    embeddingById: {},
    hydrated: true,
  });
});

describe("useSemanticResults", () => {
  it("debounces, embeds, ranks, and excludes keyword ids", async () => {
    const a = bk("bk_a", "Apple");
    const b = bk("bk_b", "Banana");
    seed([a, b], { bk_a: [1, 0, 0], bk_b: [0.9, 0.1, 0] });
    const embed = vi.fn(async () => [1, 0, 0]);

    const { result } = renderHook(() =>
      useSemanticResults("fruit", new Set<string>(), embed)
    );

    await waitFor(() => expect(result.current.length).toBe(2));
    expect(result.current[0]!.id).toBe("related:bk_a");
    expect(embed).toHaveBeenCalledWith("fruit");
  });

  it("excludes ids already shown by keyword search", async () => {
    const a = bk("bk_a", "Apple");
    const b = bk("bk_b", "Banana");
    seed([a, b], { bk_a: [1, 0, 0], bk_b: [0.9, 0.1, 0] });
    const embed = vi.fn(async () => [1, 0, 0]);

    const { result } = renderHook(() =>
      useSemanticResults("fruit", new Set(["bk_a"]), embed)
    );

    await waitFor(() => expect(result.current.length).toBe(1));
    expect(result.current[0]!.id).toBe("related:bk_b");
  });

  it("short query never embeds", async () => {
    seed([bk("bk_a", "Apple")], { bk_a: [1, 0, 0] });
    const embed = vi.fn(async () => [1, 0, 0]);
    const { result } = renderHook(() =>
      useSemanticResults("ab", new Set<string>(), embed)
    );
    await new Promise((r) => setTimeout(r, 300));
    expect(result.current).toEqual([]);
    expect(embed).not.toHaveBeenCalled();
  });

  it("row value is pinned to the query for cmdk filter survival", async () => {
    seed([bk("bk_a", "Apple")], { bk_a: [1, 0, 0] });
    const { result } = renderHook(() =>
      useSemanticResults("fruit", new Set<string>(), async () => [1, 0, 0])
    );
    await waitFor(() => expect(result.current.length).toBe(1));
    expect(result.current[0]!.searchableValue).toContain("fruit");
  });
});
