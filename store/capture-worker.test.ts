import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createCaptureWorker } from "@/store/capture-worker";
import { useStore } from "@/store";
import { initialBookmarksState } from "@/store/slices/bookmarks-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryArticlesAdapter } from "@/lib/db/articles-adapter";
import {
  asBookmarkId,
  buildBookmark,
  type Bookmark,
  type BookmarkId,
  type CaptureResponse,
} from "@/types";

function bookmark(id: string): Bookmark {
  return buildBookmark(
    { url: `https://example.com/${id}` },
    { now: () => 1700000000000, id: () => asBookmarkId(`bk_${id}`) }
  );
}

function seedStore(rows: Bookmark[]) {
  const byId: Record<string, Bookmark> = {};
  const order: BookmarkId[] = [];
  for (const b of rows) {
    byId[b.id] = b;
    order.push(b.id);
  }
  const bAdapter = memoryBookmarksAdapter();
  useStore.setState({
    bookmarks: { byId, order },
    bookmarksAdapter: bAdapter,
    articlesAdapter: memoryArticlesAdapter(),
    hydrated: true,
  });
  for (const b of rows) void bAdapter.put(b);
}

const okResponse: CaptureResponse = {
  ok: true,
  title: "T",
  byline: null,
  excerpt: null,
  siteName: null,
  publishedTime: null,
  html: "<p>body</p>",
  textContent: "body",
  readingMinutes: 1,
  heroImageUrl: null,
  fetchedAt: 1700000000000,
};

beforeEach(() => {
  useStore.setState({
    bookmarks: initialBookmarksState,
    bookmarksAdapter: memoryBookmarksAdapter(),
    articlesAdapter: memoryArticlesAdapter(),
    hydrated: false,
  });
});
afterEach(() => vi.useRealTimers());

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe("capture-worker", () => {
  it("captures a pending bookmark → ready + writes Article", async () => {
    const b = bookmark("a");
    seedStore([b]);
    const worker = createCaptureWorker({
      fetchArticle: vi.fn(async () => okResponse),
    });
    worker.enqueue(b.id);
    await flush();
    expect(useStore.getState().bookmarks.byId[b.id]!.captureStatus).toBe(
      "ready"
    );
    const art = await useStore.getState().articlesAdapter.get(b.id);
    expect(art!.textContent).toBe("body");
  });

  it("only enqueues bookmarks with captureStatus pending", async () => {
    const ready: Bookmark = { ...bookmark("r"), captureStatus: "ready" };
    const pending = bookmark("p");
    seedStore([ready, pending]);
    const fetchArticle = vi.fn(async () => okResponse);
    const worker = createCaptureWorker({ fetchArticle });
    worker.kick();
    await flush();
    expect(fetchArticle).toHaveBeenCalledTimes(1);
    expect(fetchArticle).toHaveBeenCalledWith(pending.url);
  });

  it("permanent failure (not_readable) → failed", async () => {
    const b = bookmark("a");
    seedStore([b]);
    const worker = createCaptureWorker({
      fetchArticle: vi.fn(async () => ({
        ok: false as const,
        kind: "not_readable" as const,
        retriable: false,
      })),
    });
    worker.enqueue(b.id);
    await flush();
    const out = useStore.getState().bookmarks.byId[b.id]!;
    expect(out.captureStatus).toBe("failed");
    expect(out.captureFailureKind).toBe("permanent");
  });
});

describe("capture-worker full-text corpus (feature 26)", () => {
  it("writes truncated lowercased body into articleText on success", async () => {
    const b = bookmark("ft");
    seedStore([b]);
    const worker = createCaptureWorker({
      fetchArticle: vi.fn(async () => ({
        ...okResponse,
        textContent: "Zero Trust BODY",
      })),
    });
    worker.enqueue(b.id);
    await flush();
    expect(useStore.getState().articleText[b.id]).toBe("zero trust body");
  });
});
