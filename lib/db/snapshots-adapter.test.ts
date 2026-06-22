import { describe, it, expect } from "vitest";
import { memorySnapshotsAdapter } from "@/lib/db/snapshots-adapter";
import { asBookmarkId, type Snapshot } from "@/types";

const s = (bk: string): Snapshot =>
  ({
    bookmarkId: asBookmarkId(bk),
    dataUrl: "data:image/png;base64,AA",
    generatedAt: 1,
  }) as Snapshot;

describe("snapshotsAdapter (memory)", () => {
  it("puts, gets, lists, removes by bookmarkId", async () => {
    const a = memorySnapshotsAdapter();
    await a.put(s("bk_1"));
    await a.put(s("bk_2"));
    expect((await a.list()).length).toBe(2);
    expect((await a.get(asBookmarkId("bk_1")))?.dataUrl).toContain(
      "data:image"
    );
    await a.remove(asBookmarkId("bk_1"));
    expect(await a.get(asBookmarkId("bk_1"))).toBeNull();
  });
});
