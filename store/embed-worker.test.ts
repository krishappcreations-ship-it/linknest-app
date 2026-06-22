import { describe, it, expect, beforeEach, vi } from "vitest";
import { createEmbedWorker } from "@/store/embed-worker";
import { useStore } from "@/store";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryEmbeddingsAdapter } from "@/lib/db/embeddings-adapter";
import {
  buildBookmark,
  asBookmarkId,
  type Bookmark,
  type BookmarkId,
} from "@/types";

function bookmark(id: string): Bookmark {
  return buildBookmark(
    { url: `https://example.com/${id}` },
    { now: () => 1, id: () => asBookmarkId(`bk_${id}`) }
  );
}

function seedStore(rows: Bookmark[]) {
  const byId: Record<string, Bookmark> = {};
  const order: BookmarkId[] = [];
  for (const b of rows) {
    byId[b.id] = b;
    order.push(b.id);
  }
  useStore.setState({
    bookmarks: { byId, order },
    bookmarksAdapter: memoryBookmarksAdapter(),
    embeddingsAdapter: memoryEmbeddingsAdapter(),
    embeddingById: {},
    articleText: {},
    hydrated: true,
  });
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    embeddingsAdapter: memoryEmbeddingsAdapter(),
    embeddingById: {},
    articleText: {},
  });
});

describe("embed-worker", () => {
  it("embeds a bookmark → embeddingById + adapter row", async () => {
    const b = bookmark("a");
    seedStore([b]);
    const worker = createEmbedWorker({ embed: vi.fn(async () => [1, 0, 0]) });
    worker.enqueue(b.id);
    await flush();
    expect(useStore.getState().embeddingById[b.id]).toEqual([1, 0, 0]);
    expect(
      (await useStore.getState().embeddingsAdapter.get(b.id))!.vector
    ).toEqual([1, 0, 0]);
  });

  it("kick skips bookmarks already embedded", async () => {
    const b = bookmark("a");
    seedStore([b]);
    useStore.setState((s) => ({ embeddingById: { [b.id]: [1, 0, 0] } }));
    const embed = vi.fn(async () => [0, 1, 0]);
    const worker = createEmbedWorker({ embed });
    worker.kick();
    await flush();
    expect(embed).not.toHaveBeenCalled();
  });

  it("ghost-write guard: deleted mid-embed → no write", async () => {
    const b = bookmark("a");
    seedStore([b]);
    let resolveEmbed: (v: number[]) => void = () => {};
    const embed = vi.fn(
      () =>
        new Promise<number[]>((res) => {
          resolveEmbed = res;
        })
    );
    const worker = createEmbedWorker({ embed });
    worker.enqueue(b.id);
    await flush();
    // delete the bookmark while embed is in-flight
    useStore.setState((s) => ({
      bookmarks: {
        byId: {
          ...s.bookmarks.byId,
          [b.id]: { ...s.bookmarks.byId[b.id]!, deletedAt: 5 },
        },
        order: s.bookmarks.order,
      },
    }));
    resolveEmbed([1, 0, 0]);
    await flush();
    expect(useStore.getState().embeddingById[b.id]).toBeUndefined();
  });
});
