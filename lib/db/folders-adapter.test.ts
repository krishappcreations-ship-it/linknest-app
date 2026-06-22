import { describe, expect, it, beforeEach } from "vitest";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { buildFolder, asFolderId } from "@/types";
import type { Folder } from "@/types";

function makeFolder(name: string, ts = 1700000000000): Folder {
  return buildFolder(
    { name, parentId: null },
    { now: () => ts, id: () => asFolderId(`fld_${name}`) }
  );
}

describe("memoryFoldersAdapter", () => {
  let adapter: ReturnType<typeof memoryFoldersAdapter>;
  beforeEach(() => {
    adapter = memoryFoldersAdapter();
  });

  it("round-trips put + get by id", async () => {
    const f = makeFolder("Tools");
    await adapter.put(f);
    expect(await adapter.get(f.id)).toEqual(f);
  });
  it("returns null for unknown id", async () => {
    expect(await adapter.get(asFolderId("fld_missing"))).toBeNull();
  });
  it("put is idempotent (overwrites by id)", async () => {
    const a = makeFolder("Tools", 1);
    const b = { ...a, name: "Tools Renamed", updatedAt: 2 };
    await adapter.put(a);
    await adapter.put(b);
    expect((await adapter.get(a.id))?.name).toBe("Tools Renamed");
  });
  it("delete removes the row", async () => {
    const f = makeFolder("Tools");
    await adapter.put(f);
    await adapter.remove(f.id);
    expect(await adapter.get(f.id)).toBeNull();
  });
  it("delete on unknown id is a noop", async () => {
    await expect(
      adapter.remove(asFolderId("fld_missing"))
    ).resolves.toBeUndefined();
  });
  it("list returns all rows sorted by createdAt DESC", async () => {
    await adapter.put(makeFolder("A", 1));
    await adapter.put(makeFolder("B", 3));
    await adapter.put(makeFolder("C", 2));
    const all = await adapter.list();
    expect(all.map((f) => f.name)).toEqual(["B", "C", "A"]);
  });
});
