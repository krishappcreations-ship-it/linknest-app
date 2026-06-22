# ADR-004 — Storage Strategy

**Status:** Accepted
**Date:** 2026-05-21
**Phase:** 1 (Context Grounding)

## Context

LinkNest must persist user data with these properties:

- **Offline-first** — no network dependency for read or write of any MVP feature.
- **Optimistic updates** — UI never waits on a write to confirm.
- **Instant reloads** — open the app and bookmarks render immediately, no skeleton flash beyond first paint.
- **Smooth synchronization** — Supabase sync (feature 8) layers on top without changing local UX.
- **Multi-device sync** — Phase 2 of the project (post-MVP for v0.1).

Open questions during grilling:

- IndexedDB only vs IndexedDB + Supabase from day 1
- Schema versioning / migration policy
- Conflict resolution when Supabase sync arrives
- Storage of preview images: data URLs vs blob storage

## Decision

**Two-tier storage:**

| Tier             | Tool                    | Phase                                            | Role                                        |
| ---------------- | ----------------------- | ------------------------------------------------ | ------------------------------------------- |
| Tier 1 (primary) | **IndexedDB via Dexie** | Phase 0 → MVP                                    | Single source of truth for all reads/writes |
| Tier 2 (sync)    | **Supabase Postgres**   | Feature 8 (post-MVP feature in Phase 4 ordering) | Mirrors Tier 1, enables multi-device        |

**Library:** `dexie` v4. Thin wrapper around IndexedDB with promise API + reactive queries via `dexie-react-hooks`. Hidden behind a `lib/db/` adapter — the rest of the app never imports Dexie directly.

**Schema (v1):**

```ts
// lib/db/schema.ts
db.version(1).stores({
  bookmarks: "id, folderId, *tagIds, createdAt, updatedAt, title, url",
  folders: "id, parentId, order, pinned, updatedAt",
  tags: "id, name, color, updatedAt",
  preferences: "key", // singletons: layout, sidebar pinned, theme
  previewCache: "url, fetchedAt", // server-fetched preview metadata cache
  syncMeta: "entity", // last sync timestamps per entity table (Phase 8)
});
```

`*tagIds` denotes multi-entry index for tag lookup. `url` indexed for duplicate detection.

**Migration policy:** Dexie version bumps are explicit. Every schema change adds a `db.version(N).stores({...}).upgrade(tx => ...)` block. No silent migrations.

**Preview image storage:** Images themselves stay on remote servers — only URL + fetched metadata stored in `previewCache`. No blob storage in IndexedDB for MVP. If the source URL is dead at render time, fall back to favicon, then to a generated initials tile.

**Write pipeline:**

```
User action
  ↓ (sync)
Zustand slice action — mutates store
  ↓ (next tick, via persist middleware)
Dexie.put / .delete on the relevant table
  ↓ (Phase 8 — async)
React Query mutation → Supabase upsert
  ↓
On conflict: write-wins by `updatedAt` (last-write-wins) for v0.1
```

**Read pipeline:**

```
App mount
  ↓
Dexie.openDB → hydrate Zustand slices in parallel (bookmarks, folders, tags, preferences)
  ↓
Render begins with full local state
  ↓ (Phase 8 — background)
React Query → Supabase fetch → diff → patch Zustand slices
```

**Conflict resolution (Phase 8):**

- v0.1: last-write-wins by `updatedAt` field on each record.
- v0.2+: per-field merge for non-conflicting field updates (e.g., title vs tag changes on the same bookmark from different devices). Out of MVP scope; flagged in CONTEXT.md.

**Storage quota:** soft cap warned at 80% of `navigator.storage.estimate()`. Hard cap UX behavior tabled for Phase 2 features (notes/highlights/screenshots which produce larger blobs).

## Consequences

**Positive:**

- Offline-first by construction — Tier 2 is purely additive.
- Single source of truth (Tier 1) eliminates flicker / dual-rendering bugs.
- Dexie hooks integrate with React Query for the few server-derived queries without bridging code.
- Versioned migrations make schema evolution safe and reviewable.

**Negative:**

- Dexie adds ~30KB gzipped. Acceptable given offline-first requirement.
- Last-write-wins is lossy for concurrent edits. Documented limitation for v0.1.
- Preview image staleness — if the source removes the og:image, the cached metadata still points at a dead URL. Fallback chain handles this gracefully.

**Rejected alternatives:**

- **`idb-keyval`** — too primitive for indexed multi-entry tag lookup.
- **Pure localStorage** — synchronous, quota too small (5MB), no indexes.
- **Supabase-only (no IndexedDB)** — breaks offline requirement.
- **OPFS (Origin Private File System)** — Safari support gaps as of 2026-05; revisit later.
- **CRDT (Yjs/Automerge) for sync** — overkill for single-user across few devices; revisit only if collaborative editing arrives (Phase 2 "Shared Collections" feature).

## Concrete contracts (Phase 3)

- Dexie wrapper class: `lib/db/schema.ts` exports `LinkNestDb` extending `Dexie`, with `bookmarks` / `folders` / `tags` / `preferences` / `previewCache` / `syncMeta` tables. `createDb(name?)` factory.
- Indexes (v1): `bookmarks: id, folderId, *tagIds, createdAt, updatedAt, url, domain`. The multi-entry `*tagIds` index enables tag filtering; `url` is the duplicate-detection key (after `normalizeUrl`).
- Adapter contract: `BookmarksAdapter` in `lib/db/bookmarks-adapter.ts` exposes `list / put / remove / get`. Two implementations: `dexieBookmarksAdapter(db)` (production) and `memoryBookmarksAdapter()` (tests + the Phase 3 prototype). Folders / tags / preferences adapters land in Phase 5 with identical shape.
- URL normalization: `normalizeUrl(url)` in `types/index.ts` — lowercase scheme + host, strip default ports, trim trailing slash. Applied at every URL boundary so duplicate detection by `url` index is reliable.

## Cross-references

- ADR-001 — State Management (Zustand persist middleware → Dexie adapter)
- ADR-003 — Folder Architecture (Folder schema persisted here)
- ADR-005 — Design Principles (preview fallback chain UX)
- CONTEXT.md → Entities (Sync state)
- `docs/architecture.md` — module graph and dependency direction
- Plan Phase 3 — `/prototype` proved the optimistic + rollback pattern via in-memory adapter (10 tests). Supabase round-trip remains a Phase 8 deliverable.
- Plan Phase 8 — Production hardening adds RLS policies for Supabase tables.

## Amendment — Feature 01 (2026-05-22)

### Two non-indexed fields added to `bookmarks`

`Bookmark` now carries two additional fields not present in the v1 schema declaration:

- `previewStatus: "pending" | "ready" | "failed"` — drives skeleton / ready / failed UI states. Feature 01 ships every new bookmark as `"pending"`; feature 02's `/api/preview` server route drives transitions to `"ready"` or `"failed"`.
- `deletedAt: number | null` — tombstone marker for soft-delete with a 5s undo window. List reads filter `deletedAt !== null` (via `selectVisibleBookmarks`). Hard delete fires either after the eviction queue timer expires (`store/eviction-queue.ts`) or immediately on bulk delete.

Dexie v1 schema does NOT bump — these fields are stored as plain row props. They become eligible for indexing only if a future feature requires it (an ADR would land then).

### Single write path

Per the ADR-001 amendment (same date), persist middleware is removed. Each apply\* action in `store/slices/bookmarks-slice.ts` calls `adapter.put` or `.remove` directly inside its happy path; failure triggers the inverse reducer in the same closure. Storage and state stay atomic from the caller's perspective.

### Adapter list semantics

`dexieBookmarksAdapter.list()` returns ALL rows (including tombstones). The slice's `selectVisibleBookmarks` selector filters `deletedAt === null` at the read boundary. Reason: keeps the adapter dumb (no business policy in the storage layer) and lets tests inspect tombstone state directly.

## Amendment — Feature 02 (2026-05-22)

### `previewCache` semantics locked

ADR-004 declared the `previewCache` table in v1 but didn't specify how the cache is read or invalidated. Feature 02 locks the semantics:

- **Cache-first read.** The preview worker (`store/preview-worker.ts`) consults `previewCache[url]` before calling `/api/preview`. A hit younger than the TTL skips the network round-trip and writes the cached metadata directly onto the Bookmark via `applyUpdatePreviewSuccess`.
- **TTL = 30 days.** Hard-coded in the worker (`DEFAULT_CACHE_TTL_MS`). Stale entries trigger a refetch on the next worker pass.
- **Failure path does not write cache.** Only `ok: true` responses produce a `previewCache.put`. This keeps the cache clean — a `failed-permanent` bookmark doesn't poison subsequent re-adds of the same URL.
- **Refresh bypass.** `useBookmarks().refreshPreview(id)` deletes `previewCache[url]` before kicking the worker. Guarantees the next fetch hits the server, regardless of TTL.
- **Cache survives bookmark eviction.** Cache rows are keyed by URL, not Bookmark id. Re-adding the same URL after a soft-delete eviction reuses the cached metadata (within TTL) for instant ready state.

### Single write path holds

Same direct-apply discipline as the feature 01 amendment: the cache `put` and the slice `applyUpdatePreviewSuccess` both happen inside the worker's `commitResult`. Failures in cache write are non-fatal (logged); failures in bookmark write follow the slice's rollback path.

### Indexes unchanged

Cache reads are by primary key (`url`) only. The existing v1 schema (`previewCache: "url, fetchedAt"`) covers the worker's access patterns. No version bump.

## Amendment — Feature 04 (2026-05-26)

### Tags table

Schema v1 already declared the `tags` table (`tags: "id, name, color, updatedAt"`). Feature 04 wires the slice + adapter without a version bump.

- `id` — primary key (`tag_<uuid>`).
- `name` — secondary index for future case-insensitive lookups against IDB directly (slice handles in-memory dedup; the index keeps options open).
- `color` — indexed but not currently queried.
- `updatedAt` — indexed for ordering at hydrate time. Slice replays in `createdAt` ASC.

### Cascade semantics

Tag delete cascade is owned by `applyDeleteTag` in `tags-slice.ts` — adapter has no FK awareness. Tag deletion walks all bookmarks in JS, strips the tag id from each `bookmark.tagIds` array, and persists modified bookmarks via the bookmarks adapter before removing the tag row. On adapter throw mid-cascade, bookmark writes are rolled back (restore tagIds + re-persist restored rows).

### Color is derived, not stored

`Tag.color` is computed via `hashColor(name)` at create time and recomputed on rename. The value persisted to IDB is the result of the hash. No separate "is-overridden" flag — color override is not exposed in MVP.

## Amendment — Feature 08 Phase 1 (2026-05-31)

### Tier 2 (Supabase) Phase 1 landed

Tier 2 declared in §Decision now ships in opt-in form. Anon-default; Google OAuth sign-in routes through Supabase Auth. Write-through is fire-and-forget (per ADR-009). LWW enforced via Postgres RPC.

Phase 1 includes:

- 4 mirror tables (`bookmarks`, `folders`, `tags`, `preferences`) with RLS = `auth.uid() = user_id`.
- Per-entity LWW RPC (`upsert_bookmarks_lww`, `upsert_folders_lww`, `upsert_tags_lww`).
- Bookmark tombstones cross-sync via `deletedAt`.

Phase 1 does NOT include:

- Offline write queue (writes while offline = lost).
- Real-time subscriptions.
- Per-field merge (LWW is whole-row).
- Conflict UI.
- Folder + tag tombstones (their deletes don't propagate cross-device; bookmark `folderId`/`tagIds` references may orphan on cloud until next bookmark write touches them).
- `previewCache` + `syncMeta` cloud sync (stay local).
- Account settings page (just sign-in/out in sidebar footer).

These remain Phase 2 work. See ADR-009 for the cloud-sync architecture in full.

## Amendment — Feature 22 (2026-06-18)

Read-later workflow adds `readState` (`"inbox" | "reading" | "finished" | "archived"`, default `inbox`) to the Bookmark row.

- **Dexie v4** — first bump since v3 (F11). Additive only; `readState` is a plain row prop, NOT indexed (read-state counts + filtering run in-memory over `selectVisibleBookmarks`, mirroring folder filtering). The v4 `.upgrade()` backfills existing rows to `readState: "inbox"`.
- **Backfill coverage is triple-layered:** parse-time `ReadStateSchema.catch("inbox").default("inbox")`, the Dexie v4 upgrade, and the Supabase `read_state` column DEFAULT (migration 0004). No read path can observe an undefined `readState`.
- **Cloud sync** — `read_state` rides the existing whole-row LWW upsert RPC (migration 0004 replaces `upsert_bookmarks_lww`) and the realtime inbound path via the `bookmarkToRow` / `bookmarkFromRow` converters. No new sync mechanism.

## Amendment — Feature 23 (2026-06-18)

Permanent Article Capture adds a local-first readable-snapshot store.

- **Dexie v5** — first bump since v4 (F22). Additive `articles` table keyed by `bookmarkId` (`articles: "bookmarkId, capturedAt"`) + capture state on bookmarks (`captureStatus`/`captureFailureKind`/`captureAttempt`, non-indexed, mirroring the preview fields). The v5 `.upgrade()` backfills existing bookmarks to `captureStatus: "pending"` (existing library gets captured; worker concurrency 3 throttles).
- **Local-first, no cloud sync** — captured articles live only in Dexie. The Supabase schema gains **no** `articles` table this slice; `bookmarkToRow` does not emit capture columns, and `bookmarkFromRow` defaults capture fields to `pending` so a bookmark synced from another device is captured locally. Cross-device article sync is a deferred future slice.
- **New fetch boundary** `/api/capture` reuses the preview pipeline's `guardSsrf` + `readCapped` (now exported from `lib/preview/fetch-preview.ts`) — single SSRF blocklist, no duplication. 8s timeout, 5 MB raw cap, 10/min/IP rate limit. Extraction via jsdom + `@mozilla/readability`; output sanitized with DOMPurify at capture time (render-safe for F24).
- **Concurrency fix** — the preview and capture workers both do read-modify-write on the `bookmarks` slice with an awaited `adapter.put` between read and `setState`. Whole-object `setState` caused a lost-update once both workers touched one bookmark; both now merge only their owned fields via functional `setState` (`mergePreviewFields` / `mergeCaptureFields`).
