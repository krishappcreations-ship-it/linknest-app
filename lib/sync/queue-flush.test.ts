import { describe, expect, it, vi } from "vitest";
import { flushQueue, MAX_ATTEMPTS } from "./queue-flush";
import { memorySyncQueueAdapter } from "./sync-queue";
import type { SyncAdapter } from "./types";
import type { Bookmark, BookmarkId } from "@/types";

function mkBookmark(id: string): Bookmark {
  return {
    id: id as BookmarkId,
    url: `https://x/${id}`,
    title: id,
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

function mkSync(
  behavior: { putBookmark?: (uid: string, b: Bookmark) => Promise<void> } = {}
): SyncAdapter {
  return {
    uploadAll: async () => {},
    fetchAll: async () => ({
      bookmarks: [],
      folders: [],
      tags: [],
      preferences: null,
    }),
    putBookmark: behavior.putBookmark ?? (async () => {}),
    putFolder: async () => {},
    putTag: async () => {},
    putPreferences: async () => {},
  };
}

describe("flushQueue", () => {
  it("empty queue → no-op (no onDrop call)", async () => {
    const queue = memorySyncQueueAdapter();
    const onDrop = vi.fn();
    await flushQueue({ queue, sync: mkSync(), userId: "u1", onDrop });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("3 successful items → all drained, queue empty", async () => {
    const queue = memorySyncQueueAdapter();
    await queue.enqueue("bookmark", "b1", mkBookmark("b1"));
    await queue.enqueue("bookmark", "b2", mkBookmark("b2"));
    await queue.enqueue("bookmark", "b3", mkBookmark("b3"));
    const calls: string[] = [];
    await flushQueue({
      queue,
      sync: mkSync({
        putBookmark: async (_uid, b) => {
          calls.push(b.id);
        },
      }),
      userId: "u1",
      onDrop: () => {},
    });
    expect(calls).toEqual(["b1", "b2", "b3"]);
    expect(await queue.size()).toBe(0);
  });

  it("1 item fails MAX_ATTEMPTS times → dropped + onDrop(1)", async () => {
    const queue = memorySyncQueueAdapter();
    await queue.enqueue("bookmark", "b1", mkBookmark("b1"));
    const sync = mkSync({
      putBookmark: async () => {
        throw new Error("network");
      },
    });
    const onDrop = vi.fn();

    // Run flush MAX_ATTEMPTS times — each fails, attempts increment.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await flushQueue({ queue, sync, userId: "u1", onDrop });
    }

    expect(await queue.size()).toBe(0);
    expect(onDrop).toHaveBeenCalledWith(1);
  });

  it("1 item fails 2× then succeeds → drained on third flush, no drop", async () => {
    const queue = memorySyncQueueAdapter();
    await queue.enqueue("bookmark", "b1", mkBookmark("b1"));
    let calls = 0;
    const sync = mkSync({
      putBookmark: async () => {
        calls++;
        if (calls <= 2) throw new Error("transient");
      },
    });
    const onDrop = vi.fn();

    await flushQueue({ queue, sync, userId: "u1", onDrop }); // fail 1
    await flushQueue({ queue, sync, userId: "u1", onDrop }); // fail 2
    await flushQueue({ queue, sync, userId: "u1", onDrop }); // success

    expect(await queue.size()).toBe(0);
    expect(onDrop).not.toHaveBeenCalled();
  });
});
