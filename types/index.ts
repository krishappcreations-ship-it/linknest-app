/**
 * LinkNest — domain types.
 *
 * Names match CONTEXT.md exactly. Adding/renaming any of these requires
 * updating CONTEXT.md → Entities in the same commit (per design-consistency
 * enforcement rule in the execution plan).
 */

import { z } from "zod";

/* ============================================================
 * Branded ID types — prevent passing a TagId where a BookmarkId is expected.
 * ============================================================ */

declare const __brand: unique symbol;
type Branded<T, B> = T & { readonly [__brand]: B };

export type BookmarkId = Branded<string, "BookmarkId">;
export type FolderId = Branded<string, "FolderId">;
export type TagId = Branded<string, "TagId">;

/** Cast a raw string (e.g. crypto.randomUUID()) to a branded id. */
export const asBookmarkId = (s: string): BookmarkId => s as BookmarkId;
export const asFolderId = (s: string): FolderId => s as FolderId;
export const asTagId = (s: string): TagId => s as TagId;

/* ============================================================
 * Tag palette (8 swatches — locked by ADR-005).
 * ============================================================ */

export const TAG_COLORS = [
  "cyan",
  "blue",
  "orange",
  "emerald",
  "violet",
  "rose",
  "amber",
  "zinc",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

/* ============================================================
 * Preview status — feature 01.
 * "pending" = bookmark created, /api/preview not yet resolved.
 * "ready"   = preview metadata populated.
 * "failed"  = preview fetch attempted, no usable metadata returned.
 * ============================================================ */

export const PreviewStatusSchema = z.enum(["pending", "ready", "failed"]);
export type PreviewStatus = z.infer<typeof PreviewStatusSchema>;

/* ============================================================
 * Preview failure kind — feature 02.
 *
 * "transient" failures auto-retry once at 30s before becoming "permanent".
 * "permanent" failures never auto-retry (only via manual refresh).
 * Card UI is identical for both — the distinction is internal to the worker.
 * ============================================================ */

export const PreviewFailureKindSchema = z.enum(["transient", "permanent"]);
export type PreviewFailureKind = z.infer<typeof PreviewFailureKindSchema>;

export const ReadStateSchema = z.enum([
  "inbox",
  "reading",
  "finished",
  "archived",
]);
export type ReadState = z.infer<typeof ReadStateSchema>;

export const LinkStatusSchema = z.enum([
  "unknown",
  "ok",
  "redirected",
  "broken",
]);
export type LinkStatus = z.infer<typeof LinkStatusSchema>;

export const CaptureStatusSchema = z.enum(["pending", "ready", "failed"]);
export type CaptureStatus = z.infer<typeof CaptureStatusSchema>;

/* ============================================================
 * Bookmark.
 *
 * `previewStatus` shape ships in feature 01; transitions to "ready"/"failed"
 * are driven by feature 02's /api/preview server route.
 *
 * `deletedAt` is a tombstone marker — list reads filter `deletedAt !== null`.
 * Hard delete fires either after the 5s soft-undo window expires (via
 * store/eviction-queue.ts) or immediately on bulk delete.
 * ============================================================ */

export const BookmarkSchema = z.object({
  id: z.string().min(1),
  // Relaxed from .url(): image/pdf items have no real URL (links are still
  // validated at the input layer, BookmarkInputSchema). See `kind` below.
  url: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable(),
  previewImageUrl: z.string().url().nullable(),
  faviconUrl: z.string().url().nullable(),
  // Empty for asset items; links always carry a domain.
  domain: z.string(),
  /** What this item is. `link` default; image/pdf = uploads; prompt = saved text. */
  kind: z
    .enum(["link", "image", "pdf", "prompt"])
    .catch("link")
    .default("link"),
  /** Supabase Storage object path for image/pdf items; null otherwise. */
  assetPath: z.string().nullable().catch(null).default(null),
  /** Prompt text (kind="prompt"); null otherwise. */
  promptBody: z.string().nullable().catch(null).default(null),
  /** Prompt category (kind="prompt"); null otherwise. */
  promptCategory: z.string().nullable().catch(null).default(null),
  previewStatus: PreviewStatusSchema,
  folderId: z.string().nullable(),
  tagIds: z.array(z.string()),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.number().int().nonnegative().nullable(),
  previewFailureKind: PreviewFailureKindSchema.nullable(),
  previewAttempt: z.number().int().nonnegative(),
  readState: ReadStateSchema.catch("inbox").default("inbox"),
  captureStatus: CaptureStatusSchema.catch("pending").default("pending"),
  captureFailureKind: PreviewFailureKindSchema.nullable()
    .catch(null)
    .default(null),
  captureAttempt: z.number().int().nonnegative().catch(0).default(0),
  readProgress: z.number().min(0).max(1).catch(0).default(0),
  note: z.string().max(10_000).nullable().optional(),
  linkStatus: LinkStatusSchema.optional(),
  linkCheckedAt: z.number().int().nonnegative().nullable().optional(),
  linkRedirectUrl: z.string().nullable().optional(),
});

export type Bookmark = Omit<
  z.infer<typeof BookmarkSchema>,
  "kind" | "assetPath" | "promptBody" | "promptCategory"
> & {
  id: BookmarkId;
  folderId: FolderId | null;
  tagIds: TagId[];
  // Optional on the type (absent ⇒ "link"/null) so existing fixtures/rows need
  // no change; the factories + schema always populate them.
  kind?: "link" | "image" | "pdf" | "prompt";
  assetPath?: string | null;
  promptBody?: string | null;
  promptCategory?: string | null;
};

export interface LinkPatch {
  linkStatus: LinkStatus;
  linkCheckedAt: number | null;
  linkRedirectUrl: string | null;
}

/* ============================================================
 * Bookmark input — what forms submit. Slice + buildBookmark fill the rest.
 * ============================================================ */

/**
 * Coerce user input to a URL by prepending `https://` ONLY when no scheme
 * is present. Inputs that already declare a scheme (http, https, file, data,
 * javascript, ftp, …) pass through unchanged so the schema's scheme allowlist
 * can reject the unsupported ones with a readable error.
 */
export function coerceUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const BookmarkInputSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .transform(coerceUrl)
    .pipe(z.string().url("Enter a valid URL").max(2048, "URL is too long"))
    .refine((u) => /^https?:\/\//i.test(u), {
      message: "URL must use http or https",
    }),
  title: z.string().max(200, "Title is too long").optional(),
  description: z
    .string()
    .max(500, "Description is too long")
    .nullable()
    .optional(),
  folderId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  note: z.string().max(10_000).nullable().optional(),
});

export type BookmarkInput = z.infer<typeof BookmarkInputSchema>;

/* ============================================================
 * buildBookmark — factory used by applyAddBookmark.
 *
 * Test seam: pass `now` / `id` to make commits deterministic.
 * ============================================================ */

export interface BuildContext {
  now?: () => number;
  id?: () => BookmarkId;
}

function defaultBookmarkId(): BookmarkId {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return asBookmarkId(`bk_${raw}`);
}

export function buildBookmark(
  input: BookmarkInput,
  ctx: BuildContext = {}
): Bookmark {
  const now = (ctx.now ?? Date.now)();
  const id = (ctx.id ?? defaultBookmarkId)();
  const url = normalizeUrl(input.url);
  const domain = extractDomain(url);
  const trimmedTitle = input.title?.trim();
  const trimmedDesc = input.description?.trim();
  return {
    id,
    url,
    title: trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : domain,
    description: trimmedDesc && trimmedDesc.length > 0 ? trimmedDesc : null,
    previewImageUrl: null,
    faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    domain,
    previewStatus: "pending",
    folderId: (input.folderId ?? null) as FolderId | null,
    tagIds: (input.tagIds ?? []) as TagId[],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
    readState: "inbox",
    captureStatus: "pending",
    captureFailureKind: null,
    captureAttempt: 0,
    readProgress: 0,
    note: null,
    linkStatus: "unknown",
    linkCheckedAt: null,
    linkRedirectUrl: null,
    kind: "link",
    assetPath: null,
    promptBody: null,
    promptCategory: null,
  };
}

/* ============================================================
 * Asset items (image / pdf) — uploaded files that live in the same folders
 * as bookmarks. `buildAsset` is the factory used by useBookmarks.addAsset.
 * ============================================================ */

export interface AssetInput {
  kind: "image" | "pdf";
  assetPath: string;
  title: string;
  folderId?: string | null;
  tagIds?: string[];
}

export function buildAsset(
  input: AssetInput,
  ctx: BuildContext = {}
): Bookmark {
  const now = (ctx.now ?? Date.now)();
  const id = (ctx.id ?? defaultBookmarkId)();
  const title = input.title.trim() || (input.kind === "pdf" ? "PDF" : "Image");
  return {
    id,
    url: "",
    title,
    description: null,
    previewImageUrl: null,
    faviconUrl: null,
    domain: "",
    previewStatus: "ready",
    folderId: (input.folderId ?? null) as FolderId | null,
    tagIds: (input.tagIds ?? []) as TagId[],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
    readState: "inbox",
    captureStatus: "ready",
    captureFailureKind: null,
    captureAttempt: 0,
    readProgress: 0,
    note: null,
    linkStatus: "unknown",
    linkCheckedAt: null,
    linkRedirectUrl: null,
    kind: input.kind,
    assetPath: input.assetPath,
    promptBody: null,
    promptCategory: null,
  };
}

/* ============================================================
 * Prompts (kind="prompt") — saved text prompts grouped by category.
 * ============================================================ */

export interface PromptInput {
  title: string;
  body: string;
  category?: string | null;
  tagIds?: string[];
}

export function buildPrompt(
  input: PromptInput,
  ctx: BuildContext = {}
): Bookmark {
  const now = (ctx.now ?? Date.now)();
  const id = (ctx.id ?? defaultBookmarkId)();
  const category = input.category?.trim() || null;
  return {
    id,
    url: "",
    title: input.title.trim() || "Untitled prompt",
    description: null,
    previewImageUrl: null,
    faviconUrl: null,
    domain: "",
    previewStatus: "ready",
    folderId: null,
    tagIds: (input.tagIds ?? []) as TagId[],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
    readState: "inbox",
    captureStatus: "ready",
    captureFailureKind: null,
    captureAttempt: 0,
    readProgress: 0,
    note: null,
    linkStatus: "unknown",
    linkCheckedAt: null,
    linkRedirectUrl: null,
    kind: "prompt",
    assetPath: null,
    promptBody: input.body,
    promptCategory: category,
  };
}

/* ============================================================
 * Folder. Max depth 3 — enforced in foldersSlice.createFolder
 * (see ADR-003).
 * ============================================================ */

export const FOLDER_MAX_DEPTH = 3; // depth 0 (root) .. 2 (deepest) inclusive

export const FolderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64).trim(),
  parentId: z.string().nullable(),
  order: z.number(),
  pinned: z.boolean(),
  color: z.enum(TAG_COLORS).nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.number().int().nonnegative().nullable(),
});

export type Folder = z.infer<typeof FolderSchema> & {
  id: FolderId;
  parentId: FolderId | null;
};

/* ============================================================
 * Folder input — what the inline editor submits. Slice + buildFolder fill
 * the rest (id, order, pinned, color, timestamps).
 * ============================================================ */

export const FolderInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required")
    .max(64, "Folder name is too long"),
  parentId: z.string().nullable(),
});
export type FolderInput = z.infer<typeof FolderInputSchema> & {
  parentId: FolderId | null;
};

export interface BuildFolderContext {
  now?: () => number;
  id?: () => FolderId;
}

function defaultFolderId(): FolderId {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return asFolderId(`fld_${raw}`);
}

export function buildFolder(
  input: FolderInput,
  ctx: BuildFolderContext = {}
): Folder {
  const now = (ctx.now ?? Date.now)();
  const id = (ctx.id ?? defaultFolderId)();
  return {
    id,
    name: input.name.trim(),
    parentId: input.parentId,
    order: now,
    pinned: false,
    color: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

/* ============================================================
 * Tag.
 * ============================================================ */

export const TagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(32).trim(),
  color: z.enum(TAG_COLORS),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  deletedAt: z.number().int().nonnegative().nullable(),
});

export type Tag = z.infer<typeof TagSchema> & { id: TagId };

/* ============================================================
 * Preview metadata (cached server-fetched data, see /api/preview).
 * ============================================================ */

export const PreviewSchema = z.object({
  url: z.string().url(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  faviconUrl: z.string().url().nullable(),
  domain: z.string(),
  fetchedAt: z.number().int().nonnegative(),
});

export type Preview = z.infer<typeof PreviewSchema>;

/* ============================================================
 * Preview response (server route contract) — feature 02.
 *
 * The /api/preview route always returns 200 with this body. HTTP non-2xx
 * is reserved for "API didn't reach the handler" (malformed request).
 * Worker reads `ok` + `kind` + `retriable` to drive its state machine.
 * ============================================================ */

export const PreviewFailureKindResponseSchema = z.enum([
  "timeout",
  "network",
  "http_error",
  "blocked",
  "oversize",
  "parse",
]);
export type PreviewFailureKindResponse = z.infer<
  typeof PreviewFailureKindResponseSchema
>;

export const PreviewResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    title: z.string().nullable(),
    description: z.string().nullable(),
    ogImage: z.string().url().nullable(),
    favicon: z.string().url().nullable(),
    fetchedAt: z.number().int().nonnegative(),
  }),
  z.object({
    ok: z.literal(false),
    kind: PreviewFailureKindResponseSchema,
    retriable: z.boolean(),
  }),
]);
export type PreviewResponse = z.infer<typeof PreviewResponseSchema>;

/* ============================================================
 * Article — captured readable snapshot (feature 23). Local-first;
 * keyed by bookmarkId in the Dexie `articles` table.
 * ============================================================ */

export const ArticleSchema = z.object({
  bookmarkId: z.string().min(1),
  html: z.string(),
  textContent: z.string(),
  title: z.string().nullable(),
  byline: z.string().nullable(),
  excerpt: z.string().nullable(),
  siteName: z.string().nullable(),
  publishedTime: z.string().nullable(),
  readingMinutes: z.number().int().nonnegative(),
  heroImageUrl: z.string().url().nullable(),
  capturedAt: z.number().int().nonnegative(),
  summary: z
    .object({
      tldr: z.string(),
      keyPoints: z.array(z.string()),
      model: z.string(),
      summarizedAt: z.number().int().nonnegative(),
    })
    .nullable()
    .catch(null)
    .default(null),
});
export type Article = z.infer<typeof ArticleSchema> & {
  bookmarkId: BookmarkId;
};

/* ============================================================
 * Highlight — feature 30. LOCAL-ONLY (mirrors Article; never synced).
 * Anchored by text-quote + context, resolved client-side against the
 * captured article HTML. See lib/highlights/anchor.ts.
 * ============================================================ */

export type HighlightId = Branded<string, "HighlightId">;
export const asHighlightId = (s: string): HighlightId => s as HighlightId;

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const HighlightSchema = z.object({
  id: z.string().min(1),
  bookmarkId: z.string().min(1),
  quote: z.string().min(1),
  prefix: z.string(),
  suffix: z.string(),
  color: z.enum(HIGHLIGHT_COLORS),
  annotation: z.string().max(10_000).nullable(),
  createdAt: z.number().int().nonnegative(),
});

export type Highlight = z.infer<typeof HighlightSchema> & {
  id: HighlightId;
  bookmarkId: BookmarkId;
};

/* ============================================================
 * Snapshot — feature 31. LOCAL-ONLY generated preview image
 * (text-only PNG; mirrors Embedding storage). Never synced.
 * ============================================================ */

export const SnapshotSchema = z.object({
  bookmarkId: z.string().min(1),
  dataUrl: z.string().min(1),
  generatedAt: z.number().int().nonnegative(),
});

export type Snapshot = z.infer<typeof SnapshotSchema> & {
  bookmarkId: BookmarkId;
};

export const CaptureResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    title: z.string().nullable(),
    byline: z.string().nullable(),
    excerpt: z.string().nullable(),
    siteName: z.string().nullable(),
    publishedTime: z.string().nullable(),
    html: z.string(),
    textContent: z.string(),
    readingMinutes: z.number().int().nonnegative(),
    heroImageUrl: z.string().url().nullable(),
    fetchedAt: z.number().int().nonnegative(),
  }),
  z.object({
    ok: z.literal(false),
    kind: z.enum([
      "timeout",
      "network",
      "blocked",
      "oversize",
      "http_error",
      "not_readable",
    ]),
    retriable: z.boolean(),
  }),
]);
export type CaptureResponse = z.infer<typeof CaptureResponseSchema>;

/* ============================================================
 * Smart Collections — rule-based saved searches (feature 27).
 * Local-only; flat AND-combined rules.
 * ============================================================ */

/* ============================================================
 * Embedding — local vector for semantic search (feature 28).
 * Local-only; keyed by bookmarkId.
 * ============================================================ */

export interface Embedding {
  bookmarkId: BookmarkId;
  vector: number[];
  model: string;
  embeddedAt: number;
}

export type SmartCollectionId = string & {
  readonly __brand: "SmartCollectionId";
};
export const asSmartCollectionId = (s: string): SmartCollectionId =>
  s as SmartCollectionId;

export const RuleSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("readState"), value: ReadStateSchema }),
  z.object({ field: z.literal("captureStatus"), value: CaptureStatusSchema }),
  z.object({
    field: z.literal("tag"),
    op: z.enum(["has", "lacks"]),
    value: z.string().min(1),
  }),
  z.object({ field: z.literal("untagged") }),
  z.object({
    field: z.literal("folder"),
    op: z.enum(["in", "unfiled"]),
    value: z.string().nullable().optional(),
  }),
  z.object({
    field: z.literal("readingMinutesGte"),
    value: z.number().int().nonnegative(),
  }),
  z.object({
    field: z.literal("createdWithinDays"),
    value: z.number().int().positive(),
  }),
]);
export type Rule = z.infer<typeof RuleSchema>;

export const SmartCollectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  rules: z.array(RuleSchema),
  order: z.number(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type SmartCollection = z.infer<typeof SmartCollectionSchema> & {
  id: SmartCollectionId;
};

export const SmartCollectionInputSchema = z.object({
  name: z.string().min(1).max(64),
  rules: z.array(RuleSchema).default([]),
});
export type SmartCollectionInput = z.infer<typeof SmartCollectionInputSchema>;

interface BuildCollectionContext {
  now?: () => number;
  id?: () => SmartCollectionId;
}
function defaultCollectionId(): SmartCollectionId {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return asSmartCollectionId(`sc_${raw}`);
}
export function buildSmartCollection(
  input: SmartCollectionInput,
  ctx: BuildCollectionContext = {}
): SmartCollection {
  const now = (ctx.now ?? Date.now)();
  const id = (ctx.id ?? defaultCollectionId)();
  return {
    id,
    name: input.name.trim(),
    rules: input.rules,
    order: now,
    createdAt: now,
    updatedAt: now,
  };
}

/* ============================================================
 * Preferences (single-row table; key is the field name).
 * ============================================================ */

export const LAYOUT_MODES = ["masonry", "list", "gallery"] as const;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

export type Preferences = {
  layout: LayoutMode;
  pinnedFolderIds: FolderId[];
  theme: "dark" | "light";
  readerFontSize: "s" | "m" | "l";
  readerFontFamily: "serif" | "sans";
  readerWidth: "narrow" | "normal" | "wide";
};

/* ============================================================
 * URL normalization — applied at every URL boundary so duplicate
 * detection by-URL is reliable.
 * ============================================================ */

export function normalizeUrl(input: string): string {
  const u = new URL(input);
  // Lowercase scheme + host.
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  // Strip default ports.
  if (
    (u.protocol === "http:" && u.port === "80") ||
    (u.protocol === "https:" && u.port === "443")
  ) {
    u.port = "";
  }
  // Strip trailing slash from path when path is "/" or longer.
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  // Drop trailing # without value.
  if (u.hash === "#") u.hash = "";
  return u.toString();
}

/** Extract registrable domain (host without leading "www."). */
export function extractDomain(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

export const TAG_MAX_NAME = 32;

export const TagInputSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(TAG_MAX_NAME, "Too long"),
});

export type TagInput = z.infer<typeof TagInputSchema>;

/**
 * FNV-1a 32-bit hash modulo 8 → deterministic palette index.
 * Same input always returns same color across sessions / browsers.
 */
export function hashColor(name: string): TagColor {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const idx = (h >>> 0) % TAG_COLORS.length;
  return TAG_COLORS[idx]!;
}

export interface BuildTagContext {
  now?: () => number;
  id?: () => TagId;
}

function defaultTagId(): TagId {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return asTagId(`tag_${raw}`);
}

export function buildTag(input: TagInput, ctx: BuildTagContext = {}): Tag {
  const parsed = TagInputSchema.parse(input);
  const now = (ctx.now ?? Date.now)();
  const id = (ctx.id ?? defaultTagId)();
  return {
    id,
    name: parsed.name,
    color: hashColor(parsed.name),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}
