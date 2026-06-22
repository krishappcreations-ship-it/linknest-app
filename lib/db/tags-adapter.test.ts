import { describe, expect, it } from "vitest";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { buildTag, asTagId } from "@/types";

describe("memoryTagsAdapter", () => {
  it("put + get round-trip", async () => {
    const adapter = memoryTagsAdapter();
    const t = buildTag(
      { name: "AI" },
      { now: () => 1, id: () => asTagId("tag_ai") }
    );
    await adapter.put(t);
    expect(await adapter.get(asTagId("tag_ai"))).toEqual(t);
  });
  it("list returns all rows", async () => {
    const adapter = memoryTagsAdapter();
    const a = buildTag(
      { name: "A" },
      { now: () => 1, id: () => asTagId("tag_a") }
    );
    const b = buildTag(
      { name: "B" },
      { now: () => 2, id: () => asTagId("tag_b") }
    );
    await adapter.put(a);
    await adapter.put(b);
    const rows = await adapter.list();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual([
      asTagId("tag_a"),
      asTagId("tag_b"),
    ]);
  });
  it("remove deletes the row", async () => {
    const adapter = memoryTagsAdapter();
    const t = buildTag(
      { name: "X" },
      { now: () => 1, id: () => asTagId("tag_x") }
    );
    await adapter.put(t);
    await adapter.remove(asTagId("tag_x"));
    expect(await adapter.get(asTagId("tag_x"))).toBeNull();
  });
  it("get returns null for missing id", async () => {
    const adapter = memoryTagsAdapter();
    expect(await adapter.get(asTagId("tag_missing"))).toBeNull();
  });
  it("put overwrites an existing row", async () => {
    const adapter = memoryTagsAdapter();
    const t1 = buildTag(
      { name: "X" },
      { now: () => 1, id: () => asTagId("tag_x") }
    );
    await adapter.put(t1);
    const t2 = { ...t1, name: "Y", updatedAt: 2 };
    await adapter.put(t2);
    expect((await adapter.get(asTagId("tag_x")))?.name).toBe("Y");
  });
});
