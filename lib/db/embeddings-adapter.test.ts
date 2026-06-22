import { describe, it, expect } from "vitest";
import { memoryEmbeddingsAdapter } from "@/lib/db/embeddings-adapter";
import { asBookmarkId, type Embedding } from "@/types";

function emb(id: string): Embedding {
  return {
    bookmarkId: asBookmarkId(id),
    vector: [1, 0, 0],
    model: "test",
    embeddedAt: 1,
  };
}

describe("memoryEmbeddingsAdapter", () => {
  it("put + get round-trips", async () => {
    const a = memoryEmbeddingsAdapter();
    await a.put(emb("bk_1"));
    expect((await a.get(asBookmarkId("bk_1")))!.vector).toEqual([1, 0, 0]);
  });
  it("remove deletes", async () => {
    const a = memoryEmbeddingsAdapter();
    await a.put(emb("bk_1"));
    await a.remove(asBookmarkId("bk_1"));
    expect(await a.get(asBookmarkId("bk_1"))).toBeNull();
  });
  it("list returns all", async () => {
    const a = memoryEmbeddingsAdapter();
    await a.put(emb("bk_1"));
    await a.put(emb("bk_2"));
    expect((await a.list()).length).toBe(2);
  });
});
