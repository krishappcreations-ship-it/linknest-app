import { describe, it, expect } from "vitest";
import { readerStatus } from "@/components/reader/use-reader-data";
import { asBookmarkId, type Article, type Bookmark } from "@/types";

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
    createdAt: 1,
    updatedAt: 1,
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

const article: Article = {
  bookmarkId: asBookmarkId("bk_1"),
  html: "<p>x</p>",
  textContent: "x",
  title: "T",
  byline: null,
  excerpt: null,
  siteName: null,
  publishedTime: null,
  readingMinutes: 1,
  heroImageUrl: null,
  capturedAt: 1,
  summary: null,
};

describe("readerStatus", () => {
  it("loading until loaded", () => {
    expect(readerStatus(false, bm(), article)).toBe("loading");
  });
  it("missing when no bookmark", () => {
    expect(readerStatus(true, null, null)).toBe("missing");
  });
  it("not-captured when captureStatus !== ready", () => {
    expect(readerStatus(true, bm({ captureStatus: "pending" }), null)).toBe(
      "not-captured"
    );
  });
  it("not-captured when ready but no article row", () => {
    expect(readerStatus(true, bm(), null)).toBe("not-captured");
  });
  it("ready when bookmark ready + article present", () => {
    expect(readerStatus(true, bm(), article)).toBe("ready");
  });
});
