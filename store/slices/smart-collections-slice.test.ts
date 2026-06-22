import { describe, it, expect } from "vitest";
import {
  initialSmartCollectionsState,
  addCollection,
  renameCollection,
  setRules,
  removeCollection,
  selectVisibleCollections,
  applyCreateCollection,
  applyUpdateCollection,
  applyDeleteCollection,
} from "@/store/slices/smart-collections-slice";
import { memorySmartCollectionsAdapter } from "@/lib/db/smart-collections-adapter";
import { buildSmartCollection, asSmartCollectionId, type Rule } from "@/types";

function coll(id: string, order = 1) {
  return buildSmartCollection(
    { name: id, rules: [] },
    { now: () => order, id: () => asSmartCollectionId(id) }
  );
}

describe("smart-collections reducers", () => {
  it("addCollection + inverse", () => {
    const c = coll("sc_1");
    const { next, inverse } = addCollection(initialSmartCollectionsState, c);
    expect(next.order).toEqual([asSmartCollectionId("sc_1")]);
    expect(inverse(next).order).toEqual([]);
  });
  it("renameCollection bumps updatedAt + inverse", () => {
    const s = addCollection(initialSmartCollectionsState, coll("sc_1")).next;
    const { next, inverse } = renameCollection(
      s,
      asSmartCollectionId("sc_1"),
      "New",
      99
    );
    expect(next.byId[asSmartCollectionId("sc_1")]!.name).toBe("New");
    expect(next.byId[asSmartCollectionId("sc_1")]!.updatedAt).toBe(99);
    expect(inverse(next).byId[asSmartCollectionId("sc_1")]!.name).toBe("sc_1");
  });
  it("setRules replaces rules", () => {
    const s = addCollection(initialSmartCollectionsState, coll("sc_1")).next;
    const rules: Rule[] = [{ field: "untagged" }];
    const { next } = setRules(s, asSmartCollectionId("sc_1"), rules, 5);
    expect(next.byId[asSmartCollectionId("sc_1")]!.rules).toEqual(rules);
  });
  it("removeCollection + inverse restores position", () => {
    let s = addCollection(initialSmartCollectionsState, coll("sc_1", 1)).next;
    s = addCollection(s, coll("sc_2", 2)).next;
    const { next, inverse } = removeCollection(s, asSmartCollectionId("sc_1"));
    expect(next.order).toEqual([asSmartCollectionId("sc_2")]);
    expect(inverse(next).order).toEqual([
      asSmartCollectionId("sc_1"),
      asSmartCollectionId("sc_2"),
    ]);
  });
  it("selectVisibleCollections returns ordered list", () => {
    let s = addCollection(initialSmartCollectionsState, coll("sc_1", 1)).next;
    s = addCollection(s, coll("sc_2", 2)).next;
    expect(selectVisibleCollections(s).map((c) => c.id)).toEqual([
      asSmartCollectionId("sc_1"),
      asSmartCollectionId("sc_2"),
    ]);
  });
});

describe("smart-collections apply*", () => {
  it("applyCreateCollection persists", async () => {
    const adapter = memorySmartCollectionsAdapter();
    const r = await applyCreateCollection(
      initialSmartCollectionsState,
      { name: "X", rules: [] },
      { adapter, now: () => 1 }
    );
    expect(r.rolledBack).toBe(false);
    expect(await adapter.get(r.collection.id)).not.toBeNull();
  });
  it("applyCreateCollection rolls back on adapter throw", async () => {
    const adapter = {
      ...memorySmartCollectionsAdapter(),
      put: async () => {
        throw new Error("x");
      },
    };
    const r = await applyCreateCollection(
      initialSmartCollectionsState,
      { name: "X", rules: [] },
      { adapter }
    );
    expect(r.rolledBack).toBe(true);
    expect(r.state.order).toEqual([]);
  });
  it("applyUpdateCollection sets name + rules", async () => {
    const adapter = memorySmartCollectionsAdapter();
    const created = await applyCreateCollection(
      initialSmartCollectionsState,
      { name: "X", rules: [] },
      { adapter }
    );
    const r = await applyUpdateCollection(
      created.state,
      { id: created.collection.id, name: "Y", rules: [{ field: "untagged" }] },
      { adapter }
    );
    expect(r.state.byId[created.collection.id]!.name).toBe("Y");
    expect(r.state.byId[created.collection.id]!.rules).toHaveLength(1);
  });
  it("applyDeleteCollection removes", async () => {
    const adapter = memorySmartCollectionsAdapter();
    const created = await applyCreateCollection(
      initialSmartCollectionsState,
      { name: "X", rules: [] },
      { adapter }
    );
    const r = await applyDeleteCollection(
      created.state,
      created.collection.id,
      { adapter }
    );
    expect(r.state.order).toEqual([]);
    expect(await adapter.get(created.collection.id)).toBeNull();
  });
});
