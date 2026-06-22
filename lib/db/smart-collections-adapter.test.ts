import { describe, it, expect } from "vitest";
import { memorySmartCollectionsAdapter } from "@/lib/db/smart-collections-adapter";
import { asSmartCollectionId, type SmartCollection } from "@/types";

function coll(id: string, order: number): SmartCollection {
  return {
    id: asSmartCollectionId(id),
    name: id,
    rules: [],
    order,
    createdAt: order,
    updatedAt: order,
  };
}

describe("memorySmartCollectionsAdapter", () => {
  it("put + get round-trips", async () => {
    const a = memorySmartCollectionsAdapter();
    await a.put(coll("sc_1", 1));
    expect((await a.get(asSmartCollectionId("sc_1")))!.name).toBe("sc_1");
  });
  it("list sorts by order", async () => {
    const a = memorySmartCollectionsAdapter();
    await a.put(coll("sc_b", 2));
    await a.put(coll("sc_a", 1));
    expect((await a.list()).map((c) => c.id)).toEqual([
      asSmartCollectionId("sc_a"),
      asSmartCollectionId("sc_b"),
    ]);
  });
  it("remove deletes", async () => {
    const a = memorySmartCollectionsAdapter();
    await a.put(coll("sc_1", 1));
    await a.remove(asSmartCollectionId("sc_1"));
    expect(await a.get(asSmartCollectionId("sc_1"))).toBeNull();
  });
});
