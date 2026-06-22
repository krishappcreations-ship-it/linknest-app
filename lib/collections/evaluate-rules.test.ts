import { describe, it, expect } from "vitest";
import {
  matchesRule,
  matchesRules,
  type RuleContext,
} from "@/lib/collections/evaluate-rules";
import { asBookmarkId, asFolderId, asTagId, type Bookmark } from "@/types";

function bm(overrides?: Partial<Bookmark>): Bookmark {
  return {
    id: asBookmarkId("bk_1"),
    url: "https://x.com",
    title: "T",
    description: null,
    previewImageUrl: null,
    faviconUrl: null,
    domain: "x.com",
    previewStatus: "ready",
    folderId: null,
    tagIds: [],
    createdAt: 1_000_000,
    updatedAt: 1_000_000,
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
    readState: "inbox",
    captureStatus: "ready",
    captureFailureKind: null,
    captureAttempt: 0,
    readProgress: 0,
    ...overrides,
  };
}

const ctx: RuleContext = {
  readingMinutes: (id) => (id === "bk_1" ? 12 : undefined),
  inFolderSubtree: (id, fid) => fid === asFolderId("fld_x") && id === "bk_1",
  now: 1_000_000 + 5 * 86_400_000,
};

describe("matchesRule", () => {
  it("readState equality", () => {
    expect(matchesRule({ field: "readState", value: "inbox" }, bm(), ctx)).toBe(
      true
    );
    expect(
      matchesRule({ field: "readState", value: "archived" }, bm(), ctx)
    ).toBe(false);
  });
  it("captureStatus equality", () => {
    expect(
      matchesRule({ field: "captureStatus", value: "ready" }, bm(), ctx)
    ).toBe(true);
  });
  it("tag has / lacks", () => {
    const b = bm({ tagIds: [asTagId("tag_a")] });
    expect(
      matchesRule({ field: "tag", op: "has", value: "tag_a" }, b, ctx)
    ).toBe(true);
    expect(
      matchesRule({ field: "tag", op: "lacks", value: "tag_a" }, b, ctx)
    ).toBe(false);
  });
  it("untagged", () => {
    expect(matchesRule({ field: "untagged" }, bm({ tagIds: [] }), ctx)).toBe(
      true
    );
    expect(
      matchesRule({ field: "untagged" }, bm({ tagIds: [asTagId("t")] }), ctx)
    ).toBe(false);
  });
  it("folder in / unfiled", () => {
    expect(
      matchesRule({ field: "folder", op: "in", value: "fld_x" }, bm(), ctx)
    ).toBe(true);
    expect(
      matchesRule(
        { field: "folder", op: "unfiled" },
        bm({ folderId: null }),
        ctx
      )
    ).toBe(true);
    expect(
      matchesRule(
        { field: "folder", op: "unfiled" },
        bm({ folderId: asFolderId("f") }),
        ctx
      )
    ).toBe(false);
  });
  it("readingMinutesGte", () => {
    expect(
      matchesRule({ field: "readingMinutesGte", value: 10 }, bm(), ctx)
    ).toBe(true);
    expect(
      matchesRule({ field: "readingMinutesGte", value: 20 }, bm(), ctx)
    ).toBe(false);
  });
  it("createdWithinDays", () => {
    expect(
      matchesRule({ field: "createdWithinDays", value: 7 }, bm(), ctx)
    ).toBe(true);
    expect(
      matchesRule({ field: "createdWithinDays", value: 3 }, bm(), ctx)
    ).toBe(false);
  });
});

describe("matchesRules", () => {
  it("AND — all must pass", () => {
    const b = bm({ readState: "inbox" });
    expect(
      matchesRules(
        [
          { field: "readState", value: "inbox" },
          { field: "readingMinutesGte", value: 10 },
        ],
        b,
        ctx
      )
    ).toBe(true);
    expect(
      matchesRules(
        [
          { field: "readState", value: "inbox" },
          { field: "readingMinutesGte", value: 99 },
        ],
        b,
        ctx
      )
    ).toBe(false);
  });
  it("empty rule list matches nothing", () => {
    expect(matchesRules([], bm(), ctx)).toBe(false);
  });
});
