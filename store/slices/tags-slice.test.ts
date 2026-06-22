import { describe, expect, it } from "vitest";
import {
  initialTagsState,
  addTag,
  renameTag,
  removeTag,
  selectTagById,
  selectTagByNameInsensitive,
  selectVisibleTags,
  selectTagsByIds,
  upsertFromSync,
  type TagsState,
} from "@/store/slices/tags-slice";
import { buildTag, asTagId } from "@/types";
import type { Tag, TagId } from "@/types";

function t(name: string, ts = 1): Tag {
  return buildTag(
    { name },
    { now: () => ts, id: () => asTagId(`tag_${name}`) }
  );
}

function seed(tags: Tag[]): TagsState {
  return tags.reduce((s, tag) => addTag(s, tag).next, initialTagsState);
}

describe("addTag reducer", () => {
  it("adds a tag and pushes id to order", () => {
    const { next } = addTag(initialTagsState, t("AI"));
    expect(next.byId[asTagId("tag_AI")]?.name).toBe("AI");
    expect(next.order).toEqual([asTagId("tag_AI")]);
  });
  it("inverse undoes add", () => {
    const tag = t("AI");
    const { next, inverse } = addTag(initialTagsState, tag);
    expect(inverse(next)).toEqual(initialTagsState);
  });
  it("preserves order on subsequent adds", () => {
    const s = seed([t("A", 1), t("B", 2), t("C", 3)]);
    expect(s.order).toEqual([
      asTagId("tag_A"),
      asTagId("tag_B"),
      asTagId("tag_C"),
    ]);
  });
});

describe("renameTag reducer", () => {
  it("updates name + color + updatedAt", () => {
    const s = seed([t("AI")]);
    const { next } = renameTag(s, asTagId("tag_AI"), "ML", 99);
    expect(next.byId[asTagId("tag_AI")]?.name).toBe("ML");
    expect(next.byId[asTagId("tag_AI")]?.updatedAt).toBe(99);
  });
  it("no-ops on unknown id", () => {
    const s = seed([t("AI")]);
    const { next } = renameTag(s, asTagId("tag_missing"), "X", 99);
    expect(next).toBe(s);
  });
});

describe("removeTag reducer", () => {
  it("removes from byId + order", () => {
    const s = seed([t("A"), t("B")]);
    const { next } = removeTag(s, asTagId("tag_A"));
    expect(next.byId[asTagId("tag_A")]).toBeUndefined();
    expect(next.order).toEqual([asTagId("tag_B")]);
  });
  it("inverse restores tag + order position", () => {
    const s = seed([t("A"), t("B"), t("C")]);
    const { next, inverse } = removeTag(s, asTagId("tag_B"));
    expect(inverse(next)).toEqual(s);
  });
});

describe("selectors", () => {
  it("selectTagById null-safe", () => {
    const s = seed([t("AI")]);
    expect(selectTagById(s, asTagId("tag_AI"))?.name).toBe("AI");
    expect(selectTagById(s, asTagId("tag_missing"))).toBeNull();
  });
  it("selectTagByNameInsensitive matches across cases", () => {
    const s = seed([t("AI")]);
    expect(selectTagByNameInsensitive(s, "AI")?.name).toBe("AI");
    expect(selectTagByNameInsensitive(s, "ai")?.name).toBe("AI");
    expect(selectTagByNameInsensitive(s, "Ai")?.name).toBe("AI");
    expect(selectTagByNameInsensitive(s, "ml")).toBeNull();
  });
  it("selectVisibleTags returns order-respecting list", () => {
    const s = seed([t("A", 1), t("B", 2)]);
    expect(selectVisibleTags(s).map((tag) => tag.name)).toEqual(["A", "B"]);
  });
  it("selectTagsByIds returns matching tags in input order", () => {
    const s = seed([t("A"), t("B"), t("C")]);
    const ids = [asTagId("tag_C"), asTagId("tag_A")];
    expect(selectTagsByIds(s, ids).map((tag) => tag.name)).toEqual(["C", "A"]);
  });
  it("selectTagsByIds skips unknown ids", () => {
    const s = seed([t("A")]);
    const out = selectTagsByIds(s, [asTagId("tag_A"), asTagId("tag_missing")]);
    expect(out.map((tag) => tag.name)).toEqual(["A"]);
  });
});

import { applyCreateOrGetTag, applyRenameTag } from "@/store/slices/tags-slice";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";

describe("applyCreateOrGetTag", () => {
  it("returns {kind:added} on new name + persists", async () => {
    const adapter = memoryTagsAdapter();
    const r = await applyCreateOrGetTag(
      initialTagsState,
      { name: "AI" },
      { adapter, now: () => 1, id: () => asTagId("tag_AI") }
    );
    expect(r.kind).toBe("added");
    if (r.kind === "added") {
      expect(r.tag.name).toBe("AI");
      expect(await adapter.get(asTagId("tag_AI"))).toEqual(r.tag);
    }
  });
  it("returns {kind:existing} on case-insensitive match, no adapter write", async () => {
    const adapter = memoryTagsAdapter();
    const s0 = seed([t("AI", 1)]);
    await adapter.put(s0.byId[asTagId("tag_AI")]!);
    const r = await applyCreateOrGetTag(
      s0,
      { name: "ai" },
      { adapter, id: () => asTagId("tag_should_not_be_used") }
    );
    expect(r.kind).toBe("existing");
    if (r.kind === "existing") {
      expect(r.tag.id).toBe(asTagId("tag_AI"));
      expect(r.tag.name).toBe("AI");
    }
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
    const r = await applyCreateOrGetTag(
      initialTagsState,
      { name: "X" },
      { adapter: throwing, id: () => asTagId("tag_X") }
    );
    expect(r.kind).toBe("error");
    expect(r.state).toEqual(initialTagsState);
  });
});

describe("applyRenameTag", () => {
  it("updates name + persists", async () => {
    const adapter = memoryTagsAdapter();
    const s0 = seed([t("AI")]);
    await adapter.put(s0.byId[asTagId("tag_AI")]!);
    const r = await applyRenameTag(s0, asTagId("tag_AI"), "ML", {
      adapter,
      now: () => 99,
    });
    expect(r.rolledBack).toBe(false);
    expect(r.error).toBeUndefined();
    expect(r.state.byId[asTagId("tag_AI")]!.name).toBe("ML");
    expect((await adapter.get(asTagId("tag_AI")))?.name).toBe("ML");
  });
  it("rejects on case-insensitive collision against another tag", async () => {
    const adapter = memoryTagsAdapter();
    const s0 = seed([t("AI"), t("ML")]);
    await adapter.put(s0.byId[asTagId("tag_AI")]!);
    await adapter.put(s0.byId[asTagId("tag_ML")]!);
    const r = await applyRenameTag(s0, asTagId("tag_AI"), "ml", {
      adapter,
      now: () => 99,
    });
    expect(r.error).toBe("collision");
    expect(r.state.byId[asTagId("tag_AI")]!.name).toBe("AI");
  });
  it("allows rename to a case-variant of self", async () => {
    const adapter = memoryTagsAdapter();
    const s0 = seed([t("AI")]);
    await adapter.put(s0.byId[asTagId("tag_AI")]!);
    const r = await applyRenameTag(s0, asTagId("tag_AI"), "ai", {
      adapter,
      now: () => 99,
    });
    expect(r.error).toBeUndefined();
    expect(r.state.byId[asTagId("tag_AI")]!.name).toBe("ai");
  });
  it("rolls back on adapter throw", async () => {
    const throwing = {
      list: async () => [],
      put: async () => {
        throw new Error("disk full");
      },
      remove: async () => {},
      get: async () => null,
    };
    const s0 = seed([t("AI")]);
    const r = await applyRenameTag(s0, asTagId("tag_AI"), "ML", {
      adapter: throwing,
    });
    expect(r.rolledBack).toBe(true);
    expect(r.state.byId[asTagId("tag_AI")]!.name).toBe("AI");
  });
});

import { applyDeleteTag } from "@/store/slices/tags-slice";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import {
  initialBookmarksState,
  addBookmark,
  type BookmarksState,
} from "@/store/slices/bookmarks-slice";
import { buildBookmark, asBookmarkId } from "@/types";

function bk(name: string, tagIds: TagId[] = []) {
  return {
    ...buildBookmark(
      { url: `https://${name}.example.com` },
      { now: () => 1, id: () => asBookmarkId(`bk_${name}`) }
    ),
    tagIds,
  };
}

function bkState(bookmarks: ReturnType<typeof bk>[]): BookmarksState {
  return bookmarks.reduce(
    (s, b) => addBookmark(s, b).next,
    initialBookmarksState
  );
}

describe("applyDeleteTag", () => {
  it("removes the tag + drops the id from every bookmark.tagIds", async () => {
    const tAdapter = memoryTagsAdapter();
    const bAdapter = memoryBookmarksAdapter();
    const tState = seed([t("AI"), t("ML")]);
    const bState = bkState([
      bk("a", [asTagId("tag_AI"), asTagId("tag_ML")]),
      bk("b", [asTagId("tag_AI")]),
      bk("c", []),
    ]);
    for (const id of [asTagId("tag_AI"), asTagId("tag_ML")]) {
      await tAdapter.put(tState.byId[id]!);
    }
    for (const id of [
      asBookmarkId("bk_a"),
      asBookmarkId("bk_b"),
      asBookmarkId("bk_c"),
    ]) {
      await bAdapter.put(bState.byId[id]!);
    }
    const r = await applyDeleteTag(tState, asTagId("tag_AI"), {
      adapter: tAdapter,
      now: () => 99,
    });
    expect(r.rolledBack).toBe(false);
    // Tombstoned, not removed — row stays in byId with deletedAt set.
    expect(r.state.byId[asTagId("tag_AI")]?.deletedAt).not.toBeNull();
    // Per Q3: bookmarks NOT touched (drop cascade). Original bookmarks state.
    expect(bState.byId[asBookmarkId("bk_a")]!.tagIds).toEqual([
      asTagId("tag_AI"),
      asTagId("tag_ML"),
    ]);
    expect(bState.byId[asBookmarkId("bk_b")]!.tagIds).toEqual([
      asTagId("tag_AI"),
    ]);
    expect(bState.byId[asBookmarkId("bk_c")]!.tagIds).toEqual([]);
    // Adapter still has row but tombstoned (cross-sync).
    expect((await tAdapter.get(asTagId("tag_AI")))?.deletedAt).not.toBeNull();
  });

  it("rolls back when tag adapter throws on put", async () => {
    const tState = seed([t("AI")]);
    const tAdapter = memoryTagsAdapter();
    await tAdapter.put(tState.byId[asTagId("tag_AI")]!);
    const throwing = {
      ...tAdapter,
      // New tombstone path uses adapter.put (not remove). Throw there.
      put: async () => {
        throw new Error("disk full");
      },
    };
    const r = await applyDeleteTag(tState, asTagId("tag_AI"), {
      adapter: throwing,
      now: () => 99,
    });
    expect(r.rolledBack).toBe(true);
    // Tag restored to non-tombstoned state.
    expect(r.state.byId[asTagId("tag_AI")]?.deletedAt).toBeNull();
  });

  it("no-op on unknown id", async () => {
    const r = await applyDeleteTag(initialTagsState, asTagId("tag_missing"), {
      adapter: memoryTagsAdapter(),
    });
    expect(r.rolledBack).toBe(false);
    expect(r.state).toBe(initialTagsState);
  });
});

describe("tags upsertFromSync LWW guard (F13)", () => {
  function mk(name: string, ts: number) {
    return buildTag(
      { name },
      { now: () => ts, id: () => asTagId(`tag_${name}`) }
    );
  }

  it("skips when existing.updatedAt >= incoming.updatedAt (returns same ref)", () => {
    const newer = mk("react", 2000);
    const older = { ...newer, updatedAt: 1000, name: "stale" };
    const state: TagsState = { byId: { [newer.id]: newer }, order: [newer.id] };
    const next = upsertFromSync(state, older);
    expect(next).toBe(state);
  });

  it("applies when incoming newer", () => {
    const older = mk("react", 1000);
    const renamed = { ...older, updatedAt: 2000, name: "react-18" };
    const state: TagsState = { byId: { [older.id]: older }, order: [older.id] };
    const next = upsertFromSync(state, renamed);
    expect(next.byId[older.id].name).toBe("react-18");
  });

  it("applies tombstone when local exists + incoming newer + deletedAt non-null", () => {
    const live = mk("react", 1000);
    const tombstoned = { ...live, updatedAt: 2000, deletedAt: 2000 };
    const state: TagsState = { byId: { [live.id]: live }, order: [live.id] };
    const next = upsertFromSync(state, tombstoned);
    expect(next.byId[live.id].deletedAt).toBe(2000);
  });
});
