import { describe, expect, it } from "vitest";
import {
  initialFoldersState,
  addFolder,
  renameFolder,
  removeFolder,
  togglePinFolder,
  reorderFolder,
  nestFolder,
  applyReorderFolder,
  applyNestFolder,
  selectFolderById,
  selectFolderDepth,
  selectFolderSubtreeIds,
  selectFolderByNameInParent,
  selectFolderAncestors,
  selectVisibleFolderRows,
  upsertFromSync,
  type FoldersState,
} from "@/store/slices/folders-slice";
import { buildFolder, asFolderId } from "@/types";
import type { Folder, FolderId } from "@/types";

function f(name: string, parentId: FolderId | null = null, ts = 1): Folder {
  return buildFolder(
    { name, parentId },
    { now: () => ts, id: () => asFolderId(`fld_${name}`) }
  );
}

function seed(folders: Folder[]): FoldersState {
  return folders.reduce(
    (s, folder) => addFolder(s, folder).next,
    initialFoldersState
  );
}

describe("addFolder reducer", () => {
  it("adds a depth-0 folder and indexes it in rootIds", () => {
    const { next } = addFolder(initialFoldersState, f("Tools"));
    expect(next.byId[asFolderId("fld_Tools")]).toBeDefined();
    expect(next.rootIds).toEqual([asFolderId("fld_Tools")]);
    expect(next.childrenByParent).toEqual({});
  });
  it("adds a depth-1 folder and indexes it under its parent", () => {
    const s0 = seed([f("Tools")]);
    const child = f("AI", asFolderId("fld_Tools"), 2);
    const { next } = addFolder(s0, child);
    expect(next.childrenByParent[asFolderId("fld_Tools")]).toEqual([
      asFolderId("fld_AI"),
    ]);
    expect(next.rootIds).toEqual([asFolderId("fld_Tools")]);
  });
  it("rootIds order pinned DESC, order ASC", () => {
    const a = { ...f("A", null, 1), order: 1 };
    const b = { ...f("B", null, 2), order: 2, pinned: true };
    const c = { ...f("C", null, 3), order: 3 };
    const s = [a, b, c].reduce(
      (acc, x) => addFolder(acc, x).next,
      initialFoldersState
    );
    expect(s.rootIds).toEqual([
      asFolderId("fld_B"),
      asFolderId("fld_A"),
      asFolderId("fld_C"),
    ]);
  });
  it("inverse undoes add", () => {
    const folder = f("Tools");
    const { next, inverse } = addFolder(initialFoldersState, folder);
    expect(inverse(next)).toEqual(initialFoldersState);
  });
});

describe("renameFolder reducer", () => {
  it("updates name + bumps updatedAt", () => {
    const s0 = seed([f("Tools")]);
    const { next } = renameFolder(
      s0,
      asFolderId("fld_Tools"),
      "Tools And Stuff",
      99
    );
    expect(next.byId[asFolderId("fld_Tools")]!.name).toBe("Tools And Stuff");
    expect(next.byId[asFolderId("fld_Tools")]!.updatedAt).toBe(99);
  });
  it("no-ops on unknown id", () => {
    const s0 = seed([f("Tools")]);
    const { next } = renameFolder(s0, asFolderId("fld_missing"), "X", 99);
    expect(next).toBe(s0);
  });
});

describe("removeFolder reducer", () => {
  it("removes self and unlinks from parent index + rootIds", () => {
    const s0 = seed([f("Tools")]);
    const { next } = removeFolder(s0, asFolderId("fld_Tools"));
    expect(next.byId[asFolderId("fld_Tools")]).toBeUndefined();
    expect(next.rootIds).toEqual([]);
  });
  it("removes child and unlinks from parent's children list", () => {
    const s0 = seed([f("Tools"), f("AI", asFolderId("fld_Tools"), 2)]);
    const { next } = removeFolder(s0, asFolderId("fld_AI"));
    expect(next.byId[asFolderId("fld_AI")]).toBeUndefined();
    expect(next.childrenByParent[asFolderId("fld_Tools")]).toEqual([]);
  });
});

describe("togglePinFolder reducer", () => {
  it("toggles pinned and rebalances rootIds order", () => {
    const s0 = seed([f("A", null, 1), f("B", null, 2)]);
    const { next } = togglePinFolder(s0, asFolderId("fld_B"), 50);
    expect(next.byId[asFolderId("fld_B")]!.pinned).toBe(true);
    expect(next.rootIds).toEqual([asFolderId("fld_B"), asFolderId("fld_A")]);
  });
  it("no-ops on depth > 0 (only depth-0 folders can be pinned)", () => {
    const s0 = seed([f("Tools"), f("AI", asFolderId("fld_Tools"), 2)]);
    const { next } = togglePinFolder(s0, asFolderId("fld_AI"), 50);
    expect(next).toBe(s0);
  });
});

describe("selectors", () => {
  it("selectFolderDepth: root=0, child=1, grandchild=2", () => {
    const s = seed([
      f("Tools"),
      f("AI", asFolderId("fld_Tools"), 2),
      f("GPT", asFolderId("fld_AI"), 3),
    ]);
    expect(selectFolderDepth(s, asFolderId("fld_Tools"))).toBe(0);
    expect(selectFolderDepth(s, asFolderId("fld_AI"))).toBe(1);
    expect(selectFolderDepth(s, asFolderId("fld_GPT"))).toBe(2);
  });
  it("selectFolderSubtreeIds includes self and all descendants", () => {
    const s = seed([
      f("Tools"),
      f("AI", asFolderId("fld_Tools"), 2),
      f("GPT", asFolderId("fld_AI"), 3),
      f("Other"),
    ]);
    const ids = selectFolderSubtreeIds(s, asFolderId("fld_Tools"));
    expect(ids.has(asFolderId("fld_Tools"))).toBe(true);
    expect(ids.has(asFolderId("fld_AI"))).toBe(true);
    expect(ids.has(asFolderId("fld_GPT"))).toBe(true);
    expect(ids.has(asFolderId("fld_Other"))).toBe(false);
  });
  it("selectFolderByNameInParent — case-sensitive, sibling-scoped", () => {
    const s = seed([f("Tools"), f("AI", asFolderId("fld_Tools"), 2)]);
    expect(
      selectFolderByNameInParent(s, asFolderId("fld_Tools"), "AI")
    ).toBeTruthy();
    expect(
      selectFolderByNameInParent(s, asFolderId("fld_Tools"), "ai")
    ).toBeNull();
    expect(selectFolderByNameInParent(s, null, "AI")).toBeNull();
  });
  it("selectFolderAncestors returns root → leaf", () => {
    const s = seed([
      f("Tools"),
      f("AI", asFolderId("fld_Tools"), 2),
      f("GPT", asFolderId("fld_AI"), 3),
    ]);
    const ancestors = selectFolderAncestors(s, asFolderId("fld_GPT"));
    expect(ancestors.map((a) => a.name)).toEqual(["Tools", "AI", "GPT"]);
  });
  it("selectVisibleFolderRows flattens tree, skips collapsed descendants", () => {
    const s = seed([
      f("Tools"),
      f("AI", asFolderId("fld_Tools"), 2),
      f("Design", asFolderId("fld_Tools"), 3),
    ]);
    const visible = selectVisibleFolderRows(s, new Set());
    expect(visible.map((r) => r.folder.name)).toEqual([
      "Tools",
      "AI",
      "Design",
    ]);
    expect(visible.map((r) => r.depth)).toEqual([0, 1, 1]);
    const collapsed = selectVisibleFolderRows(
      s,
      new Set([asFolderId("fld_Tools")])
    );
    expect(collapsed.map((r) => r.folder.name)).toEqual(["Tools"]);
    expect(collapsed[0]?.collapsed).toBe(true);
    expect(collapsed[0]?.hasChildren).toBe(true);
  });
  it("selectFolderById null-safe", () => {
    const s = seed([f("Tools")]);
    expect(selectFolderById(s, asFolderId("fld_Tools"))?.name).toBe("Tools");
    expect(selectFolderById(s, asFolderId("fld_missing"))).toBeNull();
  });
});

import {
  applyCreateFolder,
  applyRenameFolder,
  applyTogglePinFolder,
} from "@/store/slices/folders-slice";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";

describe("applyCreateFolder", () => {
  it("returns {kind:added} on happy path + persists via adapter", async () => {
    const adapter = memoryFoldersAdapter();
    const r = await applyCreateFolder(
      initialFoldersState,
      { name: "Tools", parentId: null },
      { adapter, now: () => 100, id: () => asFolderId("fld_Tools") }
    );
    if (r.kind !== "added") throw new Error("expected added");
    expect(r.folder.name).toBe("Tools");
    expect(await adapter.get(asFolderId("fld_Tools"))).toEqual(r.folder);
  });
  it("returns {kind:duplicate} when sibling with same name exists", async () => {
    const adapter = memoryFoldersAdapter();
    const s0 = seed([f("Tools")]);
    const r = await applyCreateFolder(
      s0,
      { name: "Tools", parentId: null },
      { adapter }
    );
    expect(r.kind).toBe("duplicate");
  });
  it("returns {kind:depth-error} when depth would exceed 2", async () => {
    const adapter = memoryFoldersAdapter();
    const s = seed([
      f("L0"),
      f("L1", asFolderId("fld_L0"), 2),
      f("L2", asFolderId("fld_L1"), 3),
    ]);
    const r = await applyCreateFolder(
      s,
      { name: "L3", parentId: asFolderId("fld_L2") },
      { adapter, id: () => asFolderId("fld_L3") }
    );
    expect(r.kind).toBe("depth-error");
  });
  it("rolls back on adapter throw", async () => {
    const throwing = {
      list: async () => [],
      put: async () => {
        throw new Error("quota");
      },
      remove: async () => {},
      get: async () => null,
    };
    const r = await applyCreateFolder(
      initialFoldersState,
      { name: "Tools", parentId: null },
      { adapter: throwing, id: () => asFolderId("fld_Tools") }
    );
    expect(r.kind).toBe("error");
    expect(r.state).toEqual(initialFoldersState);
  });
});

describe("applyRenameFolder", () => {
  it("updates name + persists", async () => {
    const adapter = memoryFoldersAdapter();
    const s0 = seed([f("Tools")]);
    await adapter.put(s0.byId[asFolderId("fld_Tools")]!);
    const r = await applyRenameFolder(s0, asFolderId("fld_Tools"), "Renamed", {
      adapter,
      now: () => 99,
    });
    expect(r.rolledBack).toBe(false);
    expect(r.state.byId[asFolderId("fld_Tools")]!.name).toBe("Renamed");
    expect((await adapter.get(asFolderId("fld_Tools")))?.name).toBe("Renamed");
  });
  it("rolls back on adapter throw", async () => {
    const throwing = {
      list: async () => [],
      put: async () => {
        throw new Error("quota");
      },
      remove: async () => {},
      get: async () => null,
    };
    const s0 = seed([f("Tools")]);
    const r = await applyRenameFolder(s0, asFolderId("fld_Tools"), "Renamed", {
      adapter: throwing,
    });
    expect(r.rolledBack).toBe(true);
    expect(r.state.byId[asFolderId("fld_Tools")]!.name).toBe("Tools");
  });
});

describe("applyTogglePinFolder", () => {
  it("flips pin + reorders rootIds", async () => {
    const adapter = memoryFoldersAdapter();
    const s0 = seed([f("A", null, 1), f("B", null, 2)]);
    const r = await applyTogglePinFolder(s0, asFolderId("fld_B"), {
      adapter,
      now: () => 99,
    });
    expect(r.rolledBack).toBe(false);
    expect(r.state.byId[asFolderId("fld_B")]!.pinned).toBe(true);
    expect(r.state.rootIds).toEqual([asFolderId("fld_B"), asFolderId("fld_A")]);
  });
  it("rejects pin at depth > 0 (no-op + no adapter call)", async () => {
    const calls: string[] = [];
    const tracking = {
      list: async () => [],
      put: async (f: Folder) => {
        calls.push(f.id);
      },
      remove: async () => {},
      get: async () => null,
    };
    const s0 = seed([f("Tools"), f("AI", asFolderId("fld_Tools"), 2)]);
    const r = await applyTogglePinFolder(s0, asFolderId("fld_AI"), {
      adapter: tracking,
    });
    expect(r.state).toBe(s0);
    expect(calls).toEqual([]);
  });
});

import { applyDeleteFolder } from "@/store/slices/folders-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import {
  initialBookmarksState,
  addBookmark,
  type BookmarksState,
} from "@/store/slices/bookmarks-slice";
import { buildBookmark, asBookmarkId } from "@/types";

function bk(name: string, folderId: FolderId | null = null) {
  return {
    ...buildBookmark(
      { url: `https://${name}.example.com` },
      { now: () => 1, id: () => asBookmarkId(`bk_${name}`) }
    ),
    folderId,
  };
}

function bkState(bookmarks: ReturnType<typeof bk>[]): BookmarksState {
  return bookmarks.reduce(
    (s, b) => addBookmark(s, b).next,
    initialBookmarksState
  );
}

describe("applyDeleteFolder", () => {
  it("removes the folder + cascades subfolders + reassigns bookmarks to root", async () => {
    const fAdapter = memoryFoldersAdapter();
    const bAdapter = memoryBookmarksAdapter();
    const fState = seed([f("Tools"), f("AI", asFolderId("fld_Tools"), 2)]);
    const bState = bkState([
      bk("a", asFolderId("fld_Tools")),
      bk("b", asFolderId("fld_AI")),
      bk("c", null),
    ]);
    for (const id of [asFolderId("fld_Tools"), asFolderId("fld_AI")]) {
      await fAdapter.put(fState.byId[id]!);
    }
    for (const id of [
      asBookmarkId("bk_a"),
      asBookmarkId("bk_b"),
      asBookmarkId("bk_c"),
    ]) {
      await bAdapter.put(bState.byId[id]!);
    }

    const r = await applyDeleteFolder(fState, bState, asFolderId("fld_Tools"), {
      adapter: fAdapter,
      bookmarksAdapter: bAdapter,
      now: () => 99,
    });

    expect(r.rolledBack).toBe(false);
    // Tombstoned, not removed — row still in byId with deletedAt set.
    expect(
      r.foldersState.byId[asFolderId("fld_Tools")]?.deletedAt
    ).not.toBeNull();
    expect(r.foldersState.byId[asFolderId("fld_AI")]?.deletedAt).not.toBeNull();
    expect(r.deletedFolderIds.sort()).toEqual(
      [asFolderId("fld_AI"), asFolderId("fld_Tools")].sort()
    );
    expect(r.reassignedBookmarkIds.sort()).toEqual(
      [asBookmarkId("bk_a"), asBookmarkId("bk_b")].sort()
    );
    expect(r.bookmarksState.byId[asBookmarkId("bk_a")]!.folderId).toBeNull();
    expect(r.bookmarksState.byId[asBookmarkId("bk_b")]!.folderId).toBeNull();
    expect(r.bookmarksState.byId[asBookmarkId("bk_c")]!.folderId).toBeNull();
    // Adapter still has the rows but with deletedAt set (tombstones cross-sync).
    expect(
      (await fAdapter.get(asFolderId("fld_Tools")))?.deletedAt
    ).not.toBeNull();
    expect(
      (await fAdapter.get(asFolderId("fld_AI")))?.deletedAt
    ).not.toBeNull();
    expect((await bAdapter.get(asBookmarkId("bk_a")))?.folderId).toBeNull();
    expect((await bAdapter.get(asBookmarkId("bk_b")))?.folderId).toBeNull();
  });

  it("rolls back when folders adapter throws mid-cascade", async () => {
    const fState = seed([f("Tools"), f("AI", asFolderId("fld_Tools"), 2)]);
    const bState = bkState([bk("a", asFolderId("fld_Tools"))]);
    const fAdapter = memoryFoldersAdapter();
    const bAdapter = memoryBookmarksAdapter();
    for (const id of [asFolderId("fld_Tools"), asFolderId("fld_AI")]) {
      await fAdapter.put(fState.byId[id]!);
    }
    await bAdapter.put(bState.byId[asBookmarkId("bk_a")]!);

    let calls = 0;
    const throwingFolders = {
      ...fAdapter,
      // New tombstone path uses adapter.put (not remove). Throw on 2nd put.
      put: async (f: Folder) => {
        calls++;
        if (calls === 2) throw new Error("disk full");
        return fAdapter.put(f);
      },
    };

    const r = await applyDeleteFolder(fState, bState, asFolderId("fld_Tools"), {
      adapter: throwingFolders,
      bookmarksAdapter: bAdapter,
      now: () => 99,
    });

    expect(r.rolledBack).toBe(true);
  });

  it("no-op on unknown id", async () => {
    const r = await applyDeleteFolder(
      initialFoldersState,
      initialBookmarksState,
      asFolderId("fld_missing"),
      {
        adapter: memoryFoldersAdapter(),
        bookmarksAdapter: memoryBookmarksAdapter(),
      }
    );
    expect(r.deletedFolderIds).toEqual([]);
    expect(r.reassignedBookmarkIds).toEqual([]);
    expect(r.rolledBack).toBe(false);
  });
});

describe("reorderFolder", () => {
  function mkF(id: string, parentId: string | null, order: number): Folder {
    return {
      id: asFolderId(id),
      name: id,
      parentId: parentId as FolderId | null,
      order,
      pinned: false,
      color: null,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    };
  }

  it("swaps two root folders and updates rootIds order", () => {
    const a = mkF("a", null, 0);
    const b = mkF("b", null, 1);
    const c = mkF("c", null, 2);
    const s0: FoldersState = {
      byId: { a, b, c },
      rootIds: [asFolderId("a"), asFolderId("b"), asFolderId("c")],
      childrenByParent: {},
    };
    const { next, inverse } = reorderFolder(s0, {
      id: asFolderId("a"),
      fromIdx: 0,
      toIdx: 2,
      parentId: null,
    });
    expect(next.rootIds).toEqual([
      asFolderId("b"),
      asFolderId("c"),
      asFolderId("a"),
    ]);
    expect(inverse(next).rootIds).toEqual(s0.rootIds);
  });

  it("reorders within a parent's children", () => {
    const root = mkF("root", null, 0);
    const x = mkF("x", "root", 0);
    const y = mkF("y", "root", 1);
    const s0: FoldersState = {
      byId: { root, x, y },
      rootIds: [asFolderId("root")],
      childrenByParent: { root: [asFolderId("x"), asFolderId("y")] },
    };
    const { next } = reorderFolder(s0, {
      id: asFolderId("y"),
      fromIdx: 1,
      toIdx: 0,
      parentId: asFolderId("root"),
    });
    expect(next.childrenByParent["root"]).toEqual([
      asFolderId("y"),
      asFolderId("x"),
    ]);
  });

  it("no-ops when fromIdx === toIdx", () => {
    const a = mkF("a", null, 0);
    const s0: FoldersState = {
      byId: { a },
      rootIds: [asFolderId("a")],
      childrenByParent: {},
    };
    const { next } = reorderFolder(s0, {
      id: asFolderId("a"),
      fromIdx: 0,
      toIdx: 0,
      parentId: null,
    });
    expect(next).toBe(s0);
  });
});

describe("nestFolder", () => {
  function mkF(id: string, parentId: string | null, order: number): Folder {
    return {
      id: asFolderId(id),
      name: id,
      parentId: parentId as FolderId | null,
      order,
      pinned: false,
      color: null,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    };
  }

  it("nests a root folder under another root folder", () => {
    const a = mkF("a", null, 0);
    const b = mkF("b", null, 1);
    const s0: FoldersState = {
      byId: { a, b },
      rootIds: [asFolderId("a"), asFolderId("b")],
      childrenByParent: {},
    };
    const { next, inverse } = nestFolder(s0, {
      id: asFolderId("b"),
      newParentId: asFolderId("a"),
    });
    expect(next.byId[asFolderId("b")]!.parentId).toBe(asFolderId("a"));
    expect(next.rootIds).toEqual([asFolderId("a")]);
    expect(next.childrenByParent[asFolderId("a")]).toEqual([asFolderId("b")]);
    expect(inverse(next)).toEqual(s0);
  });

  it("un-nests by passing newParentId=null (moves to root)", () => {
    const a = mkF("a", null, 0);
    const b = mkF("b", "a", 0);
    const s0: FoldersState = {
      byId: { a, b },
      rootIds: [asFolderId("a")],
      childrenByParent: { a: [asFolderId("b")] },
    };
    const { next } = nestFolder(s0, {
      id: asFolderId("b"),
      newParentId: null,
    });
    expect(next.byId[asFolderId("b")]!.parentId).toBeNull();
    expect(next.rootIds).toContain(asFolderId("b"));
    expect(next.childrenByParent[asFolderId("a")] ?? []).not.toContain(
      asFolderId("b")
    );
  });

  it("refuses to nest if it would exceed FOLDER_MAX_DEPTH", () => {
    const root = mkF("root", null, 0);
    const a = mkF("a", "root", 0);
    const b = mkF("b", "a", 0);
    const c = mkF("c", null, 1);
    const s0: FoldersState = {
      byId: { root, a, b, c },
      rootIds: [asFolderId("root"), asFolderId("c")],
      childrenByParent: {
        root: [asFolderId("a")],
        a: [asFolderId("b")],
      },
    };
    const { next } = nestFolder(s0, {
      id: asFolderId("c"),
      newParentId: asFolderId("b"),
    });
    expect(next).toBe(s0);
  });

  it("refuses to nest a folder under its own descendant (cycle prevention)", () => {
    const a = mkF("a", null, 0);
    const b = mkF("b", "a", 0);
    const s0: FoldersState = {
      byId: { a, b },
      rootIds: [asFolderId("a")],
      childrenByParent: { a: [asFolderId("b")] },
    };
    const { next } = nestFolder(s0, {
      id: asFolderId("a"),
      newParentId: asFolderId("b"),
    });
    expect(next).toBe(s0);
  });

  it("refuses to nest a folder under itself", () => {
    const a = mkF("a", null, 0);
    const s0: FoldersState = {
      byId: { a },
      rootIds: [asFolderId("a")],
      childrenByParent: {},
    };
    const { next } = nestFolder(s0, {
      id: asFolderId("a"),
      newParentId: asFolderId("a"),
    });
    expect(next).toBe(s0);
  });
});

describe("applyReorderFolder", () => {
  function mkF(id: string, order: number): Folder {
    return {
      id: asFolderId(id),
      name: id,
      parentId: null,
      order,
      pinned: false,
      color: null,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    };
  }

  it("persists via adapter.put on success", async () => {
    const adapter = memoryFoldersAdapter();
    await adapter.put(mkF("a", 0));
    await adapter.put(mkF("b", 1));
    const s0: FoldersState = {
      byId: { a: mkF("a", 0), b: mkF("b", 1) },
      rootIds: [asFolderId("a"), asFolderId("b")],
      childrenByParent: {},
    };
    const r = await applyReorderFolder(
      s0,
      { id: asFolderId("a"), fromIdx: 0, toIdx: 1, parentId: null },
      { adapter }
    );
    expect(r.rolledBack).toBe(false);
    expect(r.state.rootIds).toEqual([asFolderId("b"), asFolderId("a")]);
  });

  it("rolls back on throw", async () => {
    const throwing = {
      put: () => Promise.reject(new Error("nope")),
      get: () => Promise.resolve(null),
      list: () => Promise.resolve([]),
      remove: () => Promise.resolve(),
    } as never;
    const s0: FoldersState = {
      byId: { a: mkF("a", 0), b: mkF("b", 1) },
      rootIds: [asFolderId("a"), asFolderId("b")],
      childrenByParent: {},
    };
    const r = await applyReorderFolder(
      s0,
      { id: asFolderId("a"), fromIdx: 0, toIdx: 1, parentId: null },
      { adapter: throwing }
    );
    expect(r.rolledBack).toBe(true);
    expect(r.state.rootIds).toEqual(s0.rootIds);
  });
});

describe("applyNestFolder", () => {
  it("persists newParentId via adapter.put", async () => {
    const adapter = memoryFoldersAdapter();
    const mkF = (id: string, parentId: string | null): Folder => ({
      id: asFolderId(id),
      name: id,
      parentId: parentId as FolderId | null,
      order: 0,
      pinned: false,
      color: null,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
    });
    await adapter.put(mkF("a", null));
    await adapter.put(mkF("b", null));
    const s0: FoldersState = {
      byId: { a: mkF("a", null), b: mkF("b", null) },
      rootIds: [asFolderId("a"), asFolderId("b")],
      childrenByParent: {},
    };
    const r = await applyNestFolder(
      s0,
      { id: asFolderId("b"), newParentId: asFolderId("a") },
      { adapter }
    );
    expect(r.rolledBack).toBe(false);
    const persisted = await adapter.get(asFolderId("b"));
    expect(persisted?.parentId).toBe(asFolderId("a"));
  });
});

describe("folders upsertFromSync LWW guard (F13)", () => {
  function mk(name: string, ts: number) {
    return buildFolder(
      { name, parentId: null },
      { now: () => ts, id: () => asFolderId(`fld_${name}`) }
    );
  }

  it("skips when existing.updatedAt >= incoming.updatedAt (returns same ref)", () => {
    const newer = mk("Work", 2000);
    const older = { ...newer, updatedAt: 1000, name: "Stale" };
    const state: FoldersState = {
      byId: { [newer.id]: newer },
      rootIds: [newer.id],
      childrenByParent: {},
    };
    const next = upsertFromSync(state, older);
    expect(next).toBe(state);
  });

  it("applies tombstone when local exists + incoming newer + deletedAt non-null", () => {
    const live = mk("Work", 1000);
    const tombstoned = { ...live, updatedAt: 2000, deletedAt: 2000 };
    const state: FoldersState = {
      byId: { [live.id]: live },
      rootIds: [live.id],
      childrenByParent: {},
    };
    const next = upsertFromSync(state, tombstoned);
    expect(next.byId[live.id].deletedAt).toBe(2000);
  });

  it("applies when incoming newer + still alive", () => {
    const older = mk("Work", 1000);
    const renamed = { ...older, updatedAt: 2000, name: "Work-2" };
    const state: FoldersState = {
      byId: { [older.id]: older },
      rootIds: [older.id],
      childrenByParent: {},
    };
    const next = upsertFromSync(state, renamed);
    expect(next.byId[older.id].name).toBe("Work-2");
  });
});
