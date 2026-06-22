import { describe, expect, it } from "vitest";
import { memorySyncQueueAdapter } from "./sync-queue";
import type { Bookmark, BookmarkId } from "@/types";

function mkBookmark(id: string, title: string): Bookmark {
  return {
    id: id as BookmarkId,
    url: `https://x/${id}`,
    title,
    description: null,
    previewImageUrl: null,
    faviconUrl: null,
    domain: "x",
    previewStatus: "pending",
    folderId: null,
    tagIds: [],
    createdAt: 0,
    updatedAt: Date.now(),
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
    readState: "inbox",
    captureStatus: "pending",
    captureFailureKind: null,
    captureAttempt: 0,
    readProgress: 0,
  };
}

describe("memorySyncQueueAdapter", () => {
  it("enqueue creates row with attempts=0 + key=`${entity}:${id}`", async () => {
    const q = memorySyncQueueAdapter();
    await q.enqueue("bookmark", "b1", mkBookmark("b1", "first"));
    const rows = await q.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("bookmark:b1");
    expect(rows[0].attempts).toBe(0);
    expect((rows[0].payload as Bookmark).title).toBe("first");
  });

  it("enqueue twice same id → dedupes (1 row, latest payload, attempts reset)", async () => {
    const q = memorySyncQueueAdapter();
    await q.enqueue("bookmark", "b1", mkBookmark("b1", "first"));
    await q.incrementAttempts("bookmark:b1"); // simulate fail attempt
    await q.enqueue("bookmark", "b1", mkBookmark("b1", "second"));
    const rows = await q.list();
    expect(rows).toHaveLength(1);
    expect((rows[0].payload as Bookmark).title).toBe("second");
    expect(rows[0].attempts).toBe(0); // reset on re-enqueue
  });

  it("list returns FIFO by createdAt", async () => {
    const q = memorySyncQueueAdapter();
    await q.enqueue("bookmark", "b1", mkBookmark("b1", "first"));
    await new Promise((r) => setTimeout(r, 5));
    await q.enqueue("bookmark", "b2", mkBookmark("b2", "second"));
    const rows = await q.list();
    expect(rows[0].key).toBe("bookmark:b1");
    expect(rows[1].key).toBe("bookmark:b2");
  });

  it("incrementAttempts returns new count + persists", async () => {
    const q = memorySyncQueueAdapter();
    await q.enqueue("bookmark", "b1", mkBookmark("b1", "first"));
    const n1 = await q.incrementAttempts("bookmark:b1");
    const n2 = await q.incrementAttempts("bookmark:b1");
    expect(n1).toBe(1);
    expect(n2).toBe(2);
    const rows = await q.list();
    expect(rows[0].attempts).toBe(2);
  });

  it("remove deletes by key", async () => {
    const q = memorySyncQueueAdapter();
    await q.enqueue("bookmark", "b1", mkBookmark("b1", "first"));
    await q.remove("bookmark:b1");
    expect(await q.size()).toBe(0);
  });
});
