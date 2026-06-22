# CONTEXT — LinkNest

> Canonical shared language for the project. Drift here = drift everywhere.

---

## Domain

LinkNest is a personal bookmark management application: a desktop-and-mobile web app where a single user saves URLs (websites, articles, videos, docs, tools) and organizes them visually using **Folders**, **Tags**, **Layouts**, and **Search**. Each saved URL becomes a visual **Bookmark** card with a fetched **Preview** (image, title, description, favicon). Persistence is offline-first via IndexedDB; multi-device sync via Supabase is a post-MVP feature.

Success = the app feels like Linear / Arc Browser: instant, calm, tactile, premium.

---

## Entities

### Bookmark

A saved URL that the user wants to remember. Canonical term: **Bookmark** (not `Link`, `Item`, `Card`, `Entry`).

- `id` (uuid v4, branded `BookmarkId`)
- `url` (string, validated by zod, normalized via `normalizeUrl`)
- `title` (string, ≤ 200 chars, defaults to domain when blank)
- `description` (string, nullable, ≤ 500 chars)
- `previewImageUrl` (string, nullable — pointer to the remote og:image)
- `faviconUrl` (string, nullable — `google.com/s2/favicons` fallback until feature 02 lands real og:icon)
- `domain` (string — computed from URL, indexed)
- `previewStatus` (`"pending" | "ready" | "failed"` — drives skeleton / ready / failed UI states; feature 01 ships everything as `"pending"`, feature 02 transitions via `/api/preview`)
- `previewFailureKind` (`"transient" | "permanent" | null`) — populated only when `previewStatus === "failed"`. Drives the worker's auto-retry policy: `transient` retries once at 30s, `permanent` never auto-retries. Cleared by `refreshPreview` and by every successful fetch.
- `previewAttempt` (non-negative int, defaults to 0) — incremented by `refreshPreview`. The worker captures it at the start of a fetch and discards write-back if the counter changed mid-flight (refresh-during-fetch race guard).
- `folderId` (string, nullable — null = root / unfiled)
- `tagIds` (string[], multi-entry indexed)
- `createdAt`, `updatedAt` (epoch ms)
- `deletedAt` (epoch ms, nullable — tombstone for the 5s soft-delete undo window; cleared on restore, evicted by `store/eviction-queue.ts` or by bulk delete)
- `readState` (`"inbox" | "reading" | "finished" | "archived"`, defaults to `inbox`; feature 22) — the read-later lifecycle. Changed from the card action menu via `applySetReadState` (syncs cross-device via LWW). The sidebar "Reading" section filters on it orthogonally to folder/tag. `archived` is hidden from the default "All bookmarks" grid and folder counts; it surfaces only under the Archived row.
- `captureStatus` (`"pending" | "ready" | "failed"`, defaults to `pending`; feature 23) — article-capture state machine mirroring `previewStatus`. The capture worker drains `pending` bookmarks via `/api/capture`. `captureFailureKind` (`"transient" | "permanent" | null`) + `captureAttempt` (non-negative int) drive the same retry/ghost-write semantics as the preview fields. **Local-first** — capture state is never synced; a bookmark arriving from the cloud defaults to `pending` so each device captures independently.
- `readProgress` (0–1, defaults to 0; feature 24) — scroll position in Reader Mode. Restored on reader open, throttle-persisted while scrolling, drives the auto-`finished` transition at ≥95%. **Local-only** (the article snapshot is local-first, so cross-device resume has nothing to render).

Read-later workflow (feature 22): every Bookmark moves through `inbox → reading → finished`, or is `archived` out of the active view. The read-state filter (`ui.readStateFilter`) is orthogonal to the folder + tag filters — `selectFilteredBookmarks` AND-composes all three. A null read-state filter shows every non-archived bookmark.

Lifecycle: created via inline-paste (Enter saves URL only) or the Add Bookmark modal → preview enrichment via `/api/preview` (feature 02) + article capture via `/api/capture` (feature 23) → editable through the same dialog in edit mode → moved through read states from the action menu (feature 22) → soft-deletable with a 5-second undo toast → hard-evicted after the undo window expires (or immediately on bulk delete confirm), which also drops the captured Article.

### Article

A captured, readable snapshot of a bookmarked page (feature 23). Canonical term: **Article**. Local-first — stored in the Dexie `articles` table keyed by `bookmarkId` (1:1 with a Bookmark), not synced to the cloud.

- `bookmarkId` (branded `BookmarkId` — primary key)
- `html` (sanitized readable HTML — DOMPurify-stripped at capture, safe to render in Reader Mode F24)
- `textContent` (plain text — feeds Full-Text Search F26)
- `title`, `byline`, `excerpt`, `siteName`, `publishedTime` (nullable extracted metadata)
- `readingMinutes` (non-negative int — `ceil(words / 220)`)
- `heroImageUrl` (nullable, absolutized)
- `capturedAt` (epoch ms)
- `summary` (nullable; feature 25) — cached AI summary `{ tldr, keyPoints[], model, summarizedAt }`. Generated on-demand (signed-in only) via `/api/summarize` (Claude Haiku) from the reader; cached so it never regenerates. Local-only.

Lifecycle: capture worker (`store/capture-worker.ts`, clone of the preview worker) drains `captureStatus: "pending"` bookmarks → `/api/capture` fetches + extracts (jsdom + Mozilla Readability) → sanitized snapshot written to `articles`, bookmark flips to `ready`. Non-article pages (Readability null, or < 100 words) → `failed` (permanent). Manual "Capture article" / "Re-capture" re-runs via `recaptureArticle`. Deleted alongside its bookmark on hard-evict.

AI summary (feature 25): in the reader, a signed-in user can click "Summarize" to generate a TL;DR + 3–5 key points via `/api/summarize` (Claude Haiku, auth-gated, rate-limited, input truncated to 12k chars). The result is cached on `Article.summary` so reopening shows it instantly with no API call; re-capturing the article clears it (new Article row).

### Reader Mode (feature 24)

A captured Article is read in-app at `/read/[id]` (full-page, outside the dashboard chrome). The HTML is re-sanitized client-side (DOMPurify) before render. Typography (`readerFontSize`/`readerFontFamily`/`readerWidth`) and `theme` (light/dark) live in `Preferences`; a root-mounted `ThemeApplier` applies `data-theme` to the document root (the light theme's CSS vars were dormant until F24). Scroll position persists to `Bookmark.readProgress` (throttled) and restores on reopen; reaching ≥95% auto-marks the bookmark `finished`. Entry: "Read article" action on captured bookmarks.

### SmartCollection (feature 27)

A named, rule-based saved search that auto-populates. **Local-only** (Dexie `smartCollections` table; not synced). A flat `Rule[]` combined with **AND** — every rule must match. v1 rule fields: `readState`, `captureStatus`, `tag` (has/lacks), `untagged`, `folder` (in/unfiled), `readingMinutesGte` (uses the local `articleReadingMinutes` corpus), `createdWithinDays`. An empty rule list matches nothing. Selecting a collection (`ui.activeSmartCollectionId`) filters the grid via the pure `matchesRules` evaluator and is **mutually exclusive** with the folder/tag/read-state filters. Created/edited via the sidebar builder dialog; hard-deleted (no tombstone).

### Folder

A named container for Bookmarks. Hierarchical, up to 3 levels deep (see ADR-003). Canonical term: **Folder** (not `Collection`, `Category`, `Group`).

- `id`, `name`, `parentId`, `order`, `pinned`, `color`, `createdAt`, `updatedAt`

Lifecycle: created via inline editor in the sidebar (depth-0) or via overflow → "New subfolder" (depth 1–2) → nameable up to 64 chars, sibling-name collision rejected → pinnable at depth-0 only (sorts to top of root list) → collapsible per-row (state ephemeral in `ui.collapsedFolderIds`) → renameable through overflow → deletable (empty: immediate; non-empty: confirm dialog cascades subfolders + reassigns bookmarks to root). Order field defaults to `createdAt`; manual reordering arrives with drag/drop in feature 07. Color field stays `null` until feature 08 ships the swatch picker.

### Tag

A label assigned to one or more Bookmarks. Multi-assign, color-coded. Canonical term: **Tag** (not `Label`, `Keyword`).

- `id`, `name` (≤ 32 chars), `color` (from curated 8 swatches, ADR-005), `createdAt`, `updatedAt`

Lifecycle: created on-the-fly in the BookmarkForm combobox (typing a new name + selecting "Create" creates and assigns in one step) → case-insensitive uniqueness means typing an existing name in any case reuses the existing tag → color computed deterministically from name via FNV-1a hash modulo 8 palette → filterable from sidebar (single-select; click a second time to clear) → renameable inline from the sidebar row (collision against another tag rejected with toast) → deletable via the kebab (immediate when N=0 bookmarks affected; confirm dialog when N>0; cascade strips the tag id from every `bookmark.tagIds`). Color override is not exposed — color is name-derived. Tag-rename collision merge is not supported (renames are rejected on collision, not merged).

### Preview

Lifecycle: created by the preview-worker after a successful `/api/preview` fetch (or hydrated from a prior session) → read by the worker on subsequent pending bookmarks of the same URL (cache-first, 30-day TTL) → deleted by `useBookmarks().refreshPreview(id)` to force a fresh server fetch → survives bookmark soft-delete + eviction (separate table, keyed by URL).

### Layout

The active view mode for the bookmark grid: `masonry` | `list` | `gallery`. Persisted in `preferences.layout` via the Dexie `preferences` table + `PreferencesAdapter`. Single global choice (not per-filter). Switched via topbar `<LayoutSwitcher>` segmented control or Cmd/Ctrl+1/2/3. Grid dispatches on layout to render `<BookmarkCard>` (masonry), `<BookmarkListRow>`, or `<BookmarkGalleryCard>`. Crossfade transition via `<AnimatePresence mode="wait">`.

### Search query

The current filter applied to the visible Bookmark set. Combines free-text (over title/url/description/domain), tag filter, folder scope. Stored in `uiSlice` (ephemeral).

### Embedding

A dense vector representation of a bookmark's text (`title + description + truncated article body`), computed locally via Transformers.js (`Xenova/all-MiniLM-L6-v2`, 384-dim, L2-normalized) in `lib/search/embedder.ts`. Persisted in the Dexie `embeddings` table (v8, keyed by `bookmarkId`) via `EmbeddingsAdapter`, and mirrored into the in-memory `embeddingById` map on `RootState` (filled on hydrate, on capture success, dropped on evict — same lifecycle as the F26 `articleText` corpus). Produced by the **embed worker** (`store/embed-worker.ts`), the 3rd background worker (clone of the preview/capture workers; concurrency 1, no cache/retry, ghost-write guard). Enqueued on add and re-enqueued on capture success (so the vector upgrades from title-only to include the article body). Local-only — no cloud/pgvector.

### Semantic search

Meaning-based retrieval (Feature 28). `lib/search/semantic.ts` embeds the query, ranks `embeddingById` by cosine similarity (`lib/search/cosine.ts`), and applies a `minScore` floor. Surfaced as a **"Related"** group in the command palette below the keyword "Bookmarks" group (`hooks/use-semantic-results.ts`, debounced 250ms, 3-char floor). Hybrid: ids already shown by keyword search are excluded; each Related row's cmdk `value` is pinned to the live query so cmdk's lexical filter never hides a semantic hit.

### Canonical URL key

The de-duplication match key for a bookmark URL (Feature 29). `canonicalizeUrl` (`lib/dedupe/canonicalize.ts`) = `normalizeUrl` + drop fragment + strip a tracking-param denylist (`utm_*`, `fbclid`, `gclid`, `igshid`, `si`, `ref`, …) + sort remaining params. Used by `findBookmarkByUrl` so utm/fbclid/share-fragment variants of the same page collide as duplicates (existing "Already saved" warn-and-block toast). The stored `Bookmark.url` keeps the original — only the match key is canonical. Local, derived; not persisted or synced.

### Similar bookmarks

Embedding-nearest bookmarks to a source (Feature 29). `findSimilar` (`lib/dedupe/similar.ts`) ranks `embeddingById` by `cosineSim`, min 0.8, top-5, source excluded. Surfaced as the `ui.similarToBookmarkId` **grid filter mode** (mutually exclusive with folder/tag/read-state/smart-collection filters — clones the F27 pattern): entered via a "N similar" pill on the masonry `BookmarkCard`, cleared via a header strip above the grid. Reuses F28 vectors; no new data.

### Note

A free-text note attached to a single Bookmark (Feature 30). Additive nullable `Bookmark.note` field — **synced** through the existing F11 bookmark entity (LWW, like any other field; column added in migration `0005`). Edited in the add/edit dialog and the reader note panel; surfaced as a small note glyph on the masonry card. Distinct from a [[Highlight]] annotation, which is local-only and attached to a text range.

### Highlight

A colored text range saved against a captured [[Article]] (Feature 30). **Local-only** (mirrors the Article it anchors into — never synced; `QueueEntity` unchanged). New Dexie `highlights` table (v9) + `highlights-slice` + `highlightsByBookmarkId`-style in-memory map. Each Highlight has a `color` (yellow/green/blue/pink) and an optional `annotation`. Anchored by a [[Text-quote anchor]], painted into the reader as `<mark data-hl-id>`. Deleted when its bookmark is evicted (cascade in `use-bookmarks`).

### Text-quote anchor

How a [[Highlight]] locates itself in article HTML without persisting DOM offsets (Feature 30, `lib/highlights/anchor.ts`). Stores the exact `quote` plus ~32 chars of `prefix`/`suffix` context. `resolveAnchor` walks the rendered text nodes, finds every occurrence of the quote, and picks the one whose surrounding text best matches the context (longest common prefix/suffix). Survives re-sanitization, re-render, and markup tweaks; an unresolvable anchor is listed (dimmed) in the highlights sidebar rather than deleted.

### Snapshot

A generated, text-only PNG preview image for an **image-less** bookmark (Feature 31). Built fully on-device from `Bookmark` fields (`title` + `description` + a `domain`-derived gradient) via `lib/snapshot/generate.ts` + `html-to-image` — no remote images, so no CORS canvas taint; no infra, no network. **Local-only**, mirrors [[Embedding]] storage: Dexie `snapshots` table (v10), `snapshotsAdapter`, in-memory `snapshotByBookmarkId` map; never synced (`QueueEntity` unchanged); cascade-deleted with the bookmark. Generated lazily once per image-less, on-screen card through a module-level single-flight gate (`useBookmarkSnapshot`). Shown on the card with precedence: og:image → snapshot → `PreviewPlaceholder`. A true page screenshot was rejected (needs chromium infra or a 3rd-party API + off-device URL — both ruled out); see ADR-015.

### Import / Export

Data portability (Feature 32, `lib/io/`). **Import** a Netscape bookmarks HTML file (browser / Raindrop / Pocket) via `parseNetscape`, or a LinkNest JSON via `parseLinkNestJson`; both produce `ImportEntry[]` fed to the dependency-injected `runImport` engine, which skips duplicates by the [[Canonical URL key]] (`findBookmarkByUrl`), get-or-creates folders (clamped to `FOLDER_MAX_DEPTH=3`) + tags by name, and adds via the existing `applyAddBookmark` path — chunked + idle-yielded so large files never freeze. **Export** via `buildExport` (pure: store → portable names-not-ids `LinkNestExport` v1, tombstones + local-derived data excluded) → `serializeLinkNestJson`/`serializeNetscape` → `downloadFile`. No schema change, no new infra, fully local. Entry: command-palette "Import/Export bookmarks" + sidebar footer link → the import-export dialog. v1 caveat: imported items get an import-time `createdAt` (original `addDate` parsed but not stored). See ADR-016.

### PWA / Offline shell

### Link health

Dead / redirected bookmark detection (Feature 34). A **manual** "Check link health" command (`useLinkCheck`/`triggerLinkCheck`, module-level single-flight) runs `runLinkCheck` over visible bookmarks: each calls `/api/link-check` → `checkLink` (reuses the F02 SSRF-guarded GET; reads status + final URL, not the body) → pure `classifyHealth`. Conservative mapping — only definitive deadness (404/410/4xx) → `"broken"`; restricted (401/403/405/429) → `"ok"`; transient (5xx/network/timeout/SSRF) → `"unknown"`; a redirect counts only when canonical URLs differ (reuses F29 `canonicalizeUrl`, avoids http→https/trailing-slash noise). Results stamp **synced** `Bookmark` fields `linkStatus`/`linkCheckedAt`/`linkRedirectUrl` (migration `0006`, LWW, F30-note pattern) via `applyUpdateBookmark`. UI: a sidebar "Broken links" pseudo-filter (`ui.linkStatusFilter` + `setLinkStatusFilter`, read-state pattern; `selectBrokenCount`), a card "Broken"/"Moved" badge, and a one-click "Update" that swaps `url` to `linkRedirectUrl`. See ADR-018.

### PWA / Offline shell

Installable PWA + offline app shell (Feature 33). `public/manifest.webmanifest` + SVG icons (`/icon.svg`, `/icon-maskable.svg`) + `metadata.manifest`/`icons`/`appleWebApp` + `viewport.themeColor` make it installable ("Add to Home Screen"). A hand-rolled `public/sw.js` (dependency-free, Turbopack-safe) serves the shell offline: **network-first** for navigations (a fresh deploy's HTML always wins online — no stale chunks), **stale-while-revalidate** for `/_next/static` + icons + manifest, an `/offline` precached fallback (`app/offline/page.tsx`), and **passthrough** (never intercepted) for non-GET, cross-origin, `/api/*`, and `*.worker.*` — so F31 `html-to-image` + the preview/capture/embed Web Workers are untouched. The routing rules are the pure, unit-tested `swStrategyFor` (`lib/pwa/sw-strategy.ts`), which `sw.js` mirrors. A **production-only** registrar (`registerServiceWorker` + `ServiceWorkerRegistrar`) registers the SW and shows a plain info "New version available" toast when a new worker installs (the `ToastAction` system is bookmark-specific, so no action button). Cache bump = rename `linknest-shell-v1`. Data is already offline via Dexie/[[F10]]. See ADR-017.

### Browser extension

A standalone Manifest-V3 browser extension (Feature 35) in `browser-extension/` — its own Vite + `@crxjs/vite-plugin` build, vitest, and tsconfig; **not** part of the Next app tree (the main repo's husky/tsc/vitest don't cover it; run `cd browser-extension && npm run typecheck && npm test && npm run build`). One-click "Save current tab to LinkNest": the React popup talks to Supabase **directly** — email/password auth (`supabase.auth.signInWithPassword`, session in `chrome.storage.local`) — and writes through the **same `upsert_bookmarks_lww` RPC** the app uses (`buildBookmarkRow` builds the full snake_case row), so saves can't drift as columns evolve and appear in the app via realtime. Exact-URL duplicate pre-check (the extension can't import the app's F29 canonicalizer). The bundled Supabase anon key is public by design (RLS protects data). Used via "Load unpacked" (free); Chrome Web Store submission (one-time $5) is deferred. See ADR-019.

### Drag operation

A user-initiated reorganization gesture. Begins on pointer down + threshold (8px mouse, 250ms touch, Space key). Carries an `active` item id and an `over` target id; both encoded in `<kind>:<id>:<role>` form. State lives in dnd-kit's `DndContext` (not in a Zustand slice — there is no `dragSlice`). Handlers in `hooks/use-drag-drop.ts` parse the ids and dispatch the matching `apply*` helper from bookmarks-slice or folders-slice.

### Drop target

A destination registered via `useDroppable`. Two flavors: a sortable slot (managed by `SortableContext`, id `<kind>:<id>:sortable`) and an explicit body droppable (`<DropZoneBody>` overlay on folder rows, id `folder:<id>:body`). A droppable can be `disabled` (cycle prevention, depth cap, self-drop).

### Sortable context

A `<SortableContext>` instance from `@dnd-kit/sortable`. LinkNest mounts two: the bookmark grid (`rectSortingStrategy`) and the folder sidebar (`verticalListSortingStrategy`). Drags can cross contexts (bookmark in grid → folder body in sidebar) because both contexts live inside the same `<DndContext>` mounted at `components/dnd/dnd-provider.tsx`.

### Sync state

Per-entity last-sync timestamp + pending mutation queue. Populated in Phase 8 with Supabase sync. Until then, the entity stays empty.

---

## Relationships

```
Folder ───── parentId (self, nullable) — up to depth 2
   │
   └── contains 0..N ── Bookmark
                          │
                          └── tagged with 0..N ── Tag
                          │
                          └── has 0..1 ── Preview (cached by URL)

UI state references:
  Search query  ──filters──▶  Bookmark
  Layout        ──renders──▶  Bookmark grid
  Drag op       ──moves──▶    Bookmark | Folder (source) into Folder (target)
```

**Cardinality rules:**

- A Bookmark belongs to exactly one Folder (or none = root).
- A Bookmark has 0..N Tags.
- Folders form a tree, max depth 3.
- Tags are flat (no nesting).
- Previews are 1:1 with URLs, shared across Bookmarks of the same URL.

---

## Modules

> Full module graph + dependency direction in `docs/architecture.md`. Tree below is the canonical layout — additions require ADR.

```
app/
  (dashboard)/       — main bookmark grid pages
  (collections)/     — folder detail pages
  search/            — dedicated search route (Cmd+K opens overlay; this is the deep link)
  settings/
  api/
    preview/         — POST /api/preview { url } → metadata

components/
  cards/             — BookmarkCard, BookmarkSkeleton, BookmarkActions
  folders/           — FolderTree, FolderRow, FolderActions
  tags/              — TagPicker, TagBadge, TagFilter
  search/            — CommandPalette, SearchInput, SearchResults
  layout/            — Sidebar, TopBar, AppShell
  dragdrop/          — DragContext, DragOverlay, DropZone
  motion/            — primitives that wrap motion.ts tokens
  ui/                — shadcn primitives (Card, Button, Tooltip, Popover, Dialog, Kbd)

lib/
  db/                — Dexie adapter (open, schema, migrations, queries)
  validation/        — zod schemas for URL, Bookmark, Folder, Tag
  preview/           — server-side URL fetch + og:image / favicon / title parse
  utils/             — cn(), order utilities (fractional indexing), domain extraction

hooks/               — use* hooks that bridge Zustand + React Query
store/               — Zustand store + sliced reducers + selectors
styles/              — motion.ts, globals.css
types/               — shared TS types
```

---

## Decisions

- **ADR-001 — State Management**: Zustand (sliced, persisted via Dexie) + React Query (server state). See `docs/adr/001-state-management.md`.
- **ADR-002 — Animation System**: Framer Motion only, tokens in `app/styles/motion.ts`. See `docs/adr/002-animation-system.md`.
- **ADR-003 — Folder Architecture**: 3-level max nesting, fractional ordering, pinning at depth-0. See `docs/adr/003-folder-architecture.md`.
- **ADR-004 — Storage Strategy**: IndexedDB (Dexie) primary, Supabase sync in feature 8. See `docs/adr/004-storage-strategy.md`.
- **ADR-005 — Design Principles**: zinc base + 8-swatch tag palette, no glassmorphism, no big rounded radii, transform+opacity only (density/variance/motion design budget). See `docs/adr/005-design-principles.md`.
- **ADR-006 — Drag & Drop Architecture**: dnd-kit 6, single DndContext + two SortableContexts, colon-delimited droppable ids, array-based order, cycle+depth belt-and-suspenders, no new motion tokens. See `docs/adr/006-drag-drop-architecture.md`.
- **ADR-007 — Command Palette Architecture**: cmdk, single instance at dashboard layout, Bookmarks + Actions + Navigation groups, filter context bleed prevention, one-off wrapper exception. See `docs/adr/007-command-palette-architecture.md`.
- **ADR-008 — Layout Modes Architecture**: PreferencesAdapter mirrors existing pattern, global layout scope, 3 separate card components, crossfade transition, responsive auto-fill columns per layout. See `docs/adr/008-layout-modes-architecture.md`.

---

## Glossary

| Term            | Use                                                                                                                                                                                                                                          | Avoid                       | Why                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| Bookmark        | the saved URL entity                                                                                                                                                                                                                         | Link, Item, Card, Entry     | Card = the rendered visual; Link = the URL string only; Item/Entry = too generic               |
| Folder          | the hierarchical container                                                                                                                                                                                                                   | Collection, Category, Group | Spec used both — Folder won for brevity and familiarity (Raindrop "collections" reads jargony) |
| Tag             | the multi-assign label                                                                                                                                                                                                                       | Label, Keyword              | Tag is the industry-standard term users expect                                                 |
| Preview         | the fetched metadata snapshot                                                                                                                                                                                                                | Snapshot, Card metadata     | Card is the rendered surface; Preview is the data behind it                                    |
| Layout          | the grid view mode                                                                                                                                                                                                                           | View, Display mode          | Layout names the visual structure; View overloads with "page"                                  |
| Drag operation  | the in-progress dnd state                                                                                                                                                                                                                    | Drag session, Move op       | Operation = atomic from user's POV                                                             |
| Sync state      | the Tier 2 (Supabase) synchronization metadata                                                                                                                                                                                               | Mirror, Replica             | Sync = the action it tracks                                                                    |
| Command palette | the Cmd+K overlay — cmdk-powered modal with three result groups (Actions, Navigation, Bookmarks). Single instance mounted at dashboard layout. State in `ui.commandPaletteOpen`. Searches the FULL bookmark set (no sidebar filter scoping). | Quick switcher, Spotlight   | Command palette = correct term for search + actions UI                                         |
| Stack rule      | "no GSAP + Framer Motion in same tree"                                                                                                                                                                                                       | "library conflict"          | Stack rule, enforced in reviews                                                                |

---

## Flagged ambiguities

Resolved during Phase 1 grilling:

1. ~~Folder nesting depth~~ → **3 levels max** (ADR-003)
2. ~~Tag color system~~ → **curated 8 swatches** (ADR-005)
3. ~~Cmd+K scope~~ → **full command palette** (search + actions). Feature 26: command-palette search also matches captured **article bodies** via an in-memory `articleText` corpus (bookmarkId → truncated 2k lowercased body) folded into each bookmark's cmdk `searchableValue`. Corpus filled on hydrate, on capture success, dropped on evict; local-only.
4. ~~Preview pipeline~~ → **server-side via `/api/preview`** (ADR-004 cross-cut)
5. ~~Storage: IndexedDB-only vs Supabase from day 1~~ → **IndexedDB primary, Supabase as feature 8** (ADR-004)

Deferred to later phases:

- **Authentication model** — single-user offline assumed for MVP. Supabase Auth wired during feature 8. RLS policies in Phase 8 (production hardening).
- **CRDT for concurrent edits across devices** — Phase 2+ when "Shared Collections" feature lands.
- **Preview image storage (blobs vs URLs)** — currently URL-only; revisit if dead-link rate proves high in production.
- **Browser extension** — Phase 2+ (out of MVP, but architecture should not preclude it).

---

## Version note

The scaffold uses **Next.js 16.2.6** (current stable as of 2026-05-21), not Next.js 15 as the original spec said. 16 ships App Router + React 19 cleanly; no architectural impact. Recorded in commit `853534d` and ADR-001.
