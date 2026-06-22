import { describe, it, expect } from "vitest";
import {
  BookmarkSchema,
  BookmarkInputSchema,
  ReadStateSchema,
  CaptureStatusSchema,
  ArticleSchema,
  RuleSchema,
  SmartCollectionSchema,
  buildSmartCollection,
  asSmartCollectionId,
  PreviewStatusSchema,
  PreviewFailureKindSchema,
  PreviewResponseSchema,
  coerceUrl,
  buildBookmark,
  buildAsset,
  buildPrompt,
  normalizeUrl,
  asBookmarkId,
  FolderInputSchema,
  buildFolder,
  asFolderId,
  FOLDER_MAX_DEPTH,
  HighlightSchema,
  asHighlightId,
  SnapshotSchema,
} from "./index";

describe("coerceUrl", () => {
  it("prepends https:// when no scheme is present", () => {
    expect(coerceUrl("figma.com/blog")).toBe("https://figma.com/blog");
  });
  it("preserves http:// scheme as-is", () => {
    expect(coerceUrl("http://example.com")).toBe("http://example.com");
  });
  it("preserves https:// scheme as-is", () => {
    expect(coerceUrl("https://example.com")).toBe("https://example.com");
  });
  it("trims surrounding whitespace before coercion", () => {
    expect(coerceUrl("  example.com  ")).toBe("https://example.com");
  });
  it("returns empty string unchanged for empty input", () => {
    expect(coerceUrl("")).toBe("");
    expect(coerceUrl("   ")).toBe("");
  });
  it("preserves file:// scheme without prepending https://", () => {
    expect(coerceUrl("file:///etc/passwd")).toBe("file:///etc/passwd");
  });
  it("preserves data: scheme without prepending https://", () => {
    expect(coerceUrl("data:text/plain,hello")).toBe("data:text/plain,hello");
  });
  it("preserves javascript: scheme without prepending https://", () => {
    expect(coerceUrl("javascript:alert(1)")).toBe("javascript:alert(1)");
  });
  it("preserves ftp:// scheme without prepending https://", () => {
    expect(coerceUrl("ftp://example.com/file")).toBe("ftp://example.com/file");
  });
});

describe("BookmarkInputSchema", () => {
  it("accepts a bare host and coerces to https URL", () => {
    const r = BookmarkInputSchema.parse({ url: "figma.com" });
    expect(r.url).toBe("https://figma.com");
  });
  it("rejects empty url", () => {
    expect(() => BookmarkInputSchema.parse({ url: "" })).toThrow();
  });
  it("rejects > 200 char title", () => {
    expect(() =>
      BookmarkInputSchema.parse({
        url: "https://a.b",
        title: "x".repeat(201),
      })
    ).toThrow();
  });
  it("rejects > 500 char description", () => {
    expect(() =>
      BookmarkInputSchema.parse({
        url: "https://a.b",
        description: "x".repeat(501),
      })
    ).toThrow();
  });
  it("rejects file:// URLs", () => {
    expect(() =>
      BookmarkInputSchema.parse({ url: "file:///etc/passwd" })
    ).toThrow(/http or https/i);
  });
  it("rejects javascript: URLs", () => {
    expect(() =>
      BookmarkInputSchema.parse({ url: "javascript:alert(1)" })
    ).toThrow(/http or https/i);
  });
  it("rejects data: URLs", () => {
    expect(() =>
      BookmarkInputSchema.parse({ url: "data:text/html,<script>" })
    ).toThrow(/http or https/i);
  });
  it("rejects ftp:// URLs", () => {
    expect(() =>
      BookmarkInputSchema.parse({ url: "ftp://example.com/file" })
    ).toThrow(/http or https/i);
  });
  it("accepts http:// URLs", () => {
    const r = BookmarkInputSchema.parse({ url: "http://example.com" });
    expect(r.url).toBe("http://example.com");
  });
});

describe("PreviewStatusSchema", () => {
  it("accepts pending / ready / failed", () => {
    expect(PreviewStatusSchema.parse("pending")).toBe("pending");
    expect(PreviewStatusSchema.parse("ready")).toBe("ready");
    expect(PreviewStatusSchema.parse("failed")).toBe("failed");
  });
  it("rejects anything else", () => {
    expect(() => PreviewStatusSchema.parse("queued")).toThrow();
  });
});

describe("BookmarkSchema (amended)", () => {
  it("accepts a fully-shaped row", () => {
    const ok = {
      id: "bk_1",
      url: "https://example.com/",
      title: "Example",
      description: null,
      previewImageUrl: null,
      faviconUrl: null,
      domain: "example.com",
      previewStatus: "pending",
      folderId: null,
      tagIds: [],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      deletedAt: null,
      previewFailureKind: null,
      previewAttempt: 0,
    };
    expect(() => BookmarkSchema.parse(ok)).not.toThrow();
  });
  it("rejects bookmark missing previewStatus", () => {
    const bad: Record<string, unknown> = {
      id: "bk_1",
      url: "https://example.com/",
      title: "Example",
      description: null,
      previewImageUrl: null,
      faviconUrl: null,
      domain: "example.com",
      folderId: null,
      tagIds: [],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      deletedAt: null,
    };
    expect(() => BookmarkSchema.parse(bad)).toThrow();
  });
});

describe("ReadStateSchema (feature 22)", () => {
  it("accepts the four reading states", () => {
    expect(ReadStateSchema.parse("inbox")).toBe("inbox");
    expect(ReadStateSchema.parse("reading")).toBe("reading");
    expect(ReadStateSchema.parse("finished")).toBe("finished");
    expect(ReadStateSchema.parse("archived")).toBe("archived");
  });

  it("defaults readState to inbox when absent from a parsed row", () => {
    const row = {
      id: "bk_1",
      url: "https://example.com/",
      title: "Example",
      description: null,
      previewImageUrl: null,
      faviconUrl: null,
      domain: "example.com",
      previewStatus: "pending",
      folderId: null,
      tagIds: [],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      deletedAt: null,
      previewFailureKind: null,
      previewAttempt: 0,
    };
    expect(BookmarkSchema.parse(row).readState).toBe("inbox");
  });

  it("coerces an invalid readState to inbox", () => {
    const row = {
      id: "bk_1",
      url: "https://example.com/",
      title: "Example",
      description: null,
      previewImageUrl: null,
      faviconUrl: null,
      domain: "example.com",
      previewStatus: "pending",
      folderId: null,
      tagIds: [],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      deletedAt: null,
      previewFailureKind: null,
      previewAttempt: 0,
      readState: "bogus",
    };
    expect(BookmarkSchema.parse(row).readState).toBe("inbox");
  });
});

describe("CaptureStatusSchema (feature 23)", () => {
  it("accepts pending/ready/failed", () => {
    expect(CaptureStatusSchema.parse("pending")).toBe("pending");
    expect(CaptureStatusSchema.parse("ready")).toBe("ready");
    expect(CaptureStatusSchema.parse("failed")).toBe("failed");
  });
  it("defaults Bookmark capture fields when absent", () => {
    const row = {
      id: "bk_1",
      url: "https://example.com/",
      title: "Example",
      description: null,
      previewImageUrl: null,
      faviconUrl: null,
      domain: "example.com",
      previewStatus: "pending",
      folderId: null,
      tagIds: [],
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      previewFailureKind: null,
      previewAttempt: 0,
      readState: "inbox",
    };
    const b = BookmarkSchema.parse(row);
    expect(b.captureStatus).toBe("pending");
    expect(b.captureFailureKind).toBeNull();
    expect(b.captureAttempt).toBe(0);
  });
  it("ArticleSchema parses a full row", () => {
    expect(() =>
      ArticleSchema.parse({
        bookmarkId: "bk_1",
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
      })
    ).not.toThrow();
  });
});

describe("Bookmark.readProgress (feature 24)", () => {
  it("defaults to 0 when absent", () => {
    const row = {
      id: "bk_1",
      url: "https://example.com/",
      title: "Example",
      description: null,
      previewImageUrl: null,
      faviconUrl: null,
      domain: "example.com",
      previewStatus: "pending",
      folderId: null,
      tagIds: [],
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      previewFailureKind: null,
      previewAttempt: 0,
      readState: "inbox",
      captureStatus: "pending",
      captureFailureKind: null,
      captureAttempt: 0,
    };
    expect(BookmarkSchema.parse(row).readProgress).toBe(0);
  });
  it("clamps out-of-range to 0 via catch", () => {
    const row = {
      id: "bk_1",
      url: "https://example.com/",
      title: "Example",
      description: null,
      previewImageUrl: null,
      faviconUrl: null,
      domain: "example.com",
      previewStatus: "pending",
      folderId: null,
      tagIds: [],
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      previewFailureKind: null,
      previewAttempt: 0,
      readState: "inbox",
      captureStatus: "pending",
      captureFailureKind: null,
      captureAttempt: 0,
      readProgress: 5,
    };
    expect(BookmarkSchema.parse(row).readProgress).toBe(0);
  });
});

describe("ArticleSchema.summary (feature 25)", () => {
  it("defaults summary to null", () => {
    const a = ArticleSchema.parse({
      bookmarkId: "bk_1",
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
    });
    expect(a.summary).toBeNull();
  });
  it("accepts a populated summary", () => {
    const a = ArticleSchema.parse({
      bookmarkId: "bk_1",
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
      summary: {
        tldr: "short",
        keyPoints: ["a", "b"],
        model: "claude-haiku-4-5-20251001",
        summarizedAt: 5,
      },
    });
    expect(a.summary?.tldr).toBe("short");
  });
});

describe("buildBookmark", () => {
  it("fills id, domain, faviconUrl, previewStatus='pending', deletedAt=null", () => {
    const b = buildBookmark(
      { url: "https://figma.com/blog/config" },
      { now: () => 1700000000000, id: () => asBookmarkId("bk_test") }
    );
    expect(b.id).toBe("bk_test");
    expect(b.domain).toBe("figma.com");
    expect(b.url).toBe(normalizeUrl("https://figma.com/blog/config"));
    expect(b.faviconUrl).toBe(
      "https://www.google.com/s2/favicons?domain=figma.com&sz=32"
    );
    expect(b.previewStatus).toBe("pending");
    expect(b.deletedAt).toBeNull();
    expect(b.createdAt).toBe(1700000000000);
    expect(b.updatedAt).toBe(1700000000000);
    expect(b.title).toBe("figma.com");
    expect(b.description).toBeNull();
    expect(b.readState).toBe("inbox");
    expect(b.captureStatus).toBe("pending");
    expect(b.captureAttempt).toBe(0);
    expect(b.readProgress).toBe(0);
  });
  it("uses provided title when present, trimmed", () => {
    const b = buildBookmark(
      { url: "https://x.com", title: "  Hello  " },
      { now: () => 1700000000000, id: () => asBookmarkId("bk_t") }
    );
    expect(b.title).toBe("Hello");
  });
  it("returns null description when blank/whitespace only", () => {
    const b = buildBookmark(
      { url: "https://x.com", description: "  " },
      { now: () => 1, id: () => asBookmarkId("bk_x") }
    );
    expect(b.description).toBeNull();
  });
});

describe("PreviewFailureKindSchema", () => {
  it("accepts transient and permanent", () => {
    expect(PreviewFailureKindSchema.parse("transient")).toBe("transient");
    expect(PreviewFailureKindSchema.parse("permanent")).toBe("permanent");
  });
  it("rejects other strings", () => {
    expect(() => PreviewFailureKindSchema.parse("retriable")).toThrow();
  });
});

describe("PreviewResponseSchema", () => {
  it("parses a full success payload", () => {
    const r = PreviewResponseSchema.parse({
      ok: true,
      title: "Hello",
      description: "Desc",
      ogImage: "https://x.test/og.png",
      favicon: "https://x.test/favicon.ico",
      fetchedAt: 1700000000000,
    });
    expect(r.ok).toBe(true);
  });
  it("parses a sparse success payload (all nullable)", () => {
    const r = PreviewResponseSchema.parse({
      ok: true,
      title: null,
      description: null,
      ogImage: null,
      favicon: null,
      fetchedAt: 1700000000000,
    });
    expect(r.ok).toBe(true);
  });
  it("parses a transient failure", () => {
    const r = PreviewResponseSchema.parse({
      ok: false,
      kind: "timeout",
      retriable: true,
    });
    expect(r.ok).toBe(false);
  });
  it("parses a permanent failure", () => {
    const r = PreviewResponseSchema.parse({
      ok: false,
      kind: "blocked",
      retriable: false,
    });
    expect(r.ok).toBe(false);
  });
  it("rejects unknown failure kinds", () => {
    expect(() =>
      PreviewResponseSchema.parse({ ok: false, kind: "ssl", retriable: false })
    ).toThrow();
  });
});

describe("BookmarkSchema with feature-02 fields", () => {
  it("requires previewFailureKind (nullable) and previewAttempt (non-negative int)", () => {
    const built = buildBookmark(
      { url: "https://example.com" },
      { now: () => 1700000000000, id: () => asBookmarkId("bk_test") }
    );
    expect(built.previewFailureKind).toBeNull();
    expect(built.previewAttempt).toBe(0);
    expect(() => BookmarkSchema.parse(built)).not.toThrow();
  });
  it("rejects negative previewAttempt", () => {
    const built = buildBookmark(
      { url: "https://example.com" },
      { now: () => 1700000000000, id: () => asBookmarkId("bk_test") }
    );
    expect(() =>
      BookmarkSchema.parse({ ...built, previewAttempt: -1 })
    ).toThrow();
  });
});

describe("FolderInputSchema", () => {
  it("accepts a valid name and nullable parentId", () => {
    const r = FolderInputSchema.parse({ name: "Tools", parentId: null });
    expect(r.name).toBe("Tools");
    expect(r.parentId).toBeNull();
  });
  it("trims surrounding whitespace from name", () => {
    const r = FolderInputSchema.parse({ name: "  Tools  ", parentId: null });
    expect(r.name).toBe("Tools");
  });
  it("rejects empty name (after trim)", () => {
    expect(() =>
      FolderInputSchema.parse({ name: "   ", parentId: null })
    ).toThrow(/required/i);
  });
  it("rejects > 64 char name", () => {
    expect(() =>
      FolderInputSchema.parse({ name: "x".repeat(65), parentId: null })
    ).toThrow(/too long/i);
  });
});

describe("buildFolder", () => {
  it("initializes pinned=false, color=null, order=now, depth-0 by parentId=null", () => {
    const f = buildFolder(
      { name: "Tools", parentId: null },
      { now: () => 1700000000000, id: () => asFolderId("fld_test") }
    );
    expect(f.pinned).toBe(false);
    expect(f.color).toBeNull();
    expect(f.order).toBe(1700000000000);
    expect(f.parentId).toBeNull();
    expect(f.createdAt).toBe(1700000000000);
    expect(f.updatedAt).toBe(1700000000000);
  });
  it("uses ctx.id and ctx.now for deterministic builds", () => {
    const f = buildFolder(
      { name: "AI", parentId: asFolderId("fld_parent") },
      { now: () => 42, id: () => asFolderId("fld_child") }
    );
    expect(f.id).toBe("fld_child");
    expect(f.parentId).toBe("fld_parent");
  });
});

describe("FOLDER_MAX_DEPTH constant", () => {
  it("equals 3 (depth 0..2 inclusive)", () => {
    expect(FOLDER_MAX_DEPTH).toBe(3);
  });
});

import {
  TagInputSchema,
  buildTag,
  hashColor,
  TAG_MAX_NAME,
  TAG_COLORS,
  asTagId,
} from "@/types";

describe("TagInputSchema", () => {
  it("accepts a trimmed name within length", () => {
    const r = TagInputSchema.safeParse({ name: "  AI  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("AI");
  });
  it("rejects empty name", () => {
    expect(TagInputSchema.safeParse({ name: "" }).success).toBe(false);
    expect(TagInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });
  it("rejects names longer than TAG_MAX_NAME", () => {
    expect(TAG_MAX_NAME).toBe(32);
    const tooLong = "a".repeat(33);
    expect(TagInputSchema.safeParse({ name: tooLong }).success).toBe(false);
  });
});

describe("hashColor", () => {
  it("is deterministic across calls", () => {
    expect(hashColor("AI")).toBe(hashColor("AI"));
    expect(hashColor("Personal")).toBe(hashColor("Personal"));
  });
  it("spreads across the palette for typical inputs", () => {
    const colors = new Set(
      ["AI", "Tools", "Personal", "Work", "Read", "Watch", "Buy", "Learn"].map(
        hashColor
      )
    );
    expect(colors.size).toBeGreaterThanOrEqual(4);
  });
  it("returns a color from TAG_COLORS", () => {
    expect(TAG_COLORS).toContain(hashColor("anything"));
  });
});

describe("buildTag", () => {
  it("builds a tag with id, color, timestamps from injectable context", () => {
    const t = buildTag(
      { name: "AI" },
      { now: () => 42, id: () => asTagId("tag_ai") }
    );
    expect(t.id).toBe(asTagId("tag_ai"));
    expect(t.name).toBe("AI");
    expect(t.createdAt).toBe(42);
    expect(t.updatedAt).toBe(42);
    expect(TAG_COLORS).toContain(t.color);
  });
  it("uses hashColor for color when not overridden", () => {
    const t = buildTag(
      { name: "Tools" },
      { now: () => 1, id: () => asTagId("tag_tools") }
    );
    expect(t.color).toBe(hashColor("Tools"));
  });
});

describe("Rule + SmartCollection schemas (feature 27)", () => {
  it("parses each rule variant", () => {
    expect(() =>
      RuleSchema.parse({ field: "readState", value: "inbox" })
    ).not.toThrow();
    expect(() =>
      RuleSchema.parse({ field: "captureStatus", value: "ready" })
    ).not.toThrow();
    expect(() =>
      RuleSchema.parse({ field: "tag", op: "has", value: "tag_1" })
    ).not.toThrow();
    expect(() => RuleSchema.parse({ field: "untagged" })).not.toThrow();
    expect(() =>
      RuleSchema.parse({ field: "folder", op: "unfiled" })
    ).not.toThrow();
    expect(() =>
      RuleSchema.parse({ field: "readingMinutesGte", value: 10 })
    ).not.toThrow();
    expect(() =>
      RuleSchema.parse({ field: "createdWithinDays", value: 30 })
    ).not.toThrow();
  });
  it("rejects an unknown field", () => {
    expect(() => RuleSchema.parse({ field: "bogus", value: 1 })).toThrow();
  });
  it("buildSmartCollection fills id/order/timestamps", () => {
    const c = buildSmartCollection(
      {
        name: "  Long reads  ",
        rules: [{ field: "readingMinutesGte", value: 10 }],
      },
      { now: () => 1700, id: () => asSmartCollectionId("sc_1") }
    );
    expect(c.id).toBe("sc_1");
    expect(c.name).toBe("Long reads");
    expect(c.order).toBe(1700);
    expect(c.createdAt).toBe(1700);
    expect(c.rules).toHaveLength(1);
  });
  it("SmartCollectionSchema round-trips", () => {
    const c = buildSmartCollection(
      { name: "X", rules: [] },
      { now: () => 1, id: () => asSmartCollectionId("sc_x") }
    );
    expect(() => SmartCollectionSchema.parse(c)).not.toThrow();
  });
});

describe("F30 Highlight + note", () => {
  it("parses a valid highlight", () => {
    const h = {
      id: asHighlightId("hl_1"),
      bookmarkId: asBookmarkId("bk_1"),
      quote: "local-first software",
      prefix: "principles of ",
      suffix: " are durable",
      color: "yellow",
      annotation: null,
      createdAt: 1,
    };
    expect(HighlightSchema.parse(h)).toMatchObject({ color: "yellow" });
  });

  it("rejects an unknown color", () => {
    expect(() =>
      HighlightSchema.parse({
        id: "hl_1",
        bookmarkId: "bk_1",
        quote: "x",
        prefix: "",
        suffix: "",
        color: "purple",
        annotation: null,
        createdAt: 1,
      })
    ).toThrow();
  });

  it("bookmark note defaults to null and accepts a string", () => {
    const base = {
      id: "bk_1",
      url: "https://e.com",
      title: "t",
      description: null,
      previewImageUrl: null,
      faviconUrl: null,
      domain: "e.com",
      previewStatus: "ready",
      folderId: null,
      tagIds: [],
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      previewFailureKind: null,
      previewAttempt: 0,
    };
    expect(BookmarkSchema.parse(base).note).toBeUndefined();
    expect(BookmarkSchema.parse({ ...base, note: null }).note).toBeNull();
    expect(BookmarkSchema.parse({ ...base, note: "hi" }).note).toBe("hi");
  });
});

describe("F34 link health fields", () => {
  const base = {
    id: "bk_1",
    url: "https://e.com",
    title: "t",
    description: null,
    previewImageUrl: null,
    faviconUrl: null,
    domain: "e.com",
    previewStatus: "ready",
    folderId: null,
    tagIds: [],
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
  };
  it("are undefined when absent (optional, like note)", () => {
    const b = BookmarkSchema.parse(base);
    expect(b.linkStatus).toBeUndefined();
    expect(b.linkCheckedAt).toBeUndefined();
    expect(b.linkRedirectUrl).toBeUndefined();
  });
  it("accepts a redirected status + redirect url", () => {
    const b = BookmarkSchema.parse({
      ...base,
      linkStatus: "redirected",
      linkCheckedAt: 9,
      linkRedirectUrl: "https://x.com",
    });
    expect(b.linkStatus).toBe("redirected");
    expect(b.linkRedirectUrl).toBe("https://x.com");
  });
});

describe("F31 Snapshot", () => {
  it("parses a valid snapshot", () => {
    const s = {
      bookmarkId: "bk_1",
      dataUrl: "data:image/png;base64,AAAA",
      generatedAt: 1,
    };
    expect(SnapshotSchema.parse(s)).toMatchObject({ bookmarkId: "bk_1" });
  });
  it("rejects empty dataUrl", () => {
    expect(() =>
      SnapshotSchema.parse({ bookmarkId: "bk_1", dataUrl: "", generatedAt: 1 })
    ).toThrow();
  });
});

describe("buildAsset (image / pdf items)", () => {
  it("builds a pdf item with kind, assetPath, empty url, ready preview", () => {
    const a = buildAsset(
      { kind: "pdf", assetPath: "u1/bk_x.pdf", title: "Spec.pdf" },
      { now: () => 1, id: () => asBookmarkId("bk_x") }
    );
    expect(a.kind).toBe("pdf");
    expect(a.assetPath).toBe("u1/bk_x.pdf");
    expect(a.url).toBe("");
    expect(a.previewStatus).toBe("ready");
    expect(a.captureStatus).toBe("ready");
    expect(a.title).toBe("Spec.pdf");
    expect(BookmarkSchema.safeParse(a).success).toBe(true);
  });

  it("falls back to a default title + carries folder/tags", () => {
    const a = buildAsset({
      kind: "image",
      assetPath: "u1/bk_y.png",
      title: "   ",
      folderId: "fld_1",
      tagIds: ["tag_1"],
    });
    expect(a.title).toBe("Image");
    expect(a.folderId).toBe("fld_1");
    expect(a.tagIds).toEqual(["tag_1"]);
  });
});

describe("buildPrompt", () => {
  it("builds a prompt item with kind, body, category, empty url", () => {
    const p = buildPrompt(
      {
        title: "Hero shot",
        body: "a cinematic...",
        category: "Image generation",
      },
      { now: () => 1, id: () => asBookmarkId("bk_p") }
    );
    expect(p.kind).toBe("prompt");
    expect(p.promptBody).toBe("a cinematic...");
    expect(p.promptCategory).toBe("Image generation");
    expect(p.url).toBe("");
    expect(p.previewStatus).toBe("ready");
    expect(BookmarkSchema.safeParse(p).success).toBe(true);
  });

  it("defaults title and nulls a blank category", () => {
    const p = buildPrompt({ title: "  ", body: "x", category: "  " });
    expect(p.title).toBe("Untitled prompt");
    expect(p.promptCategory).toBeNull();
  });
});
