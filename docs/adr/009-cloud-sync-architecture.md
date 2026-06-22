# ADR-009 — Cloud Sync Architecture (Phase 1)

**Status:** Accepted
**Date:** 2026-05-31
**Phase:** Feature 08 Phase 1

## Context

LinkNest ships local-first via Dexie (ADR-004). Phase 1 cloud sync layers Supabase on top without breaking the offline-first contract or the optimistic-update flow.

## Decision

- **Auth:** Anon-default + opt-in Google OAuth via Supabase Auth. No magic-link / email-password Phase 1.
- **Dexie remains canonical.** All reads stay local-first. Cloud is a mirror.
- **Write-through (fire-and-forget).** Every `apply*` helper fires `sync.put*` after the Dexie write. Not awaited. Failure = log + toast, no retry queue.
- **LWW by `updatedAt`.** Enforced at write time via Postgres RPC `upsert_*_lww(rows jsonb)` functions with `WHERE existing.updated_at < excluded.updated_at`. `@supabase/supabase-js` `.upsert()` alone can't do conditional upsert — RPC is required for correctness.
- **Tombstones cross-sync (bookmarks only).** `deletedAt` syncs as-is; cloud retains tombstones. Folders + tags don't have `deletedAt` — their deletes don't propagate cross-device in Phase 1 (Phase 1 limitation).
- **Schema mirror is 1:1.** snake_case at SQL boundary, camelCase everywhere else. Single conversion site per entity in `lib/sync/supabase-sync.ts`.
- **No FK constraints Phase 1.** `bookmarks.folder_id` and `bookmarks.tag_ids` not enforced — allows out-of-order bootstrap upsert.
- **`previewCache` + `syncMeta` stay local.** Derived data, no sync value.

## Consequences

**Positive:**

- Sync is purely additive to ADR-004 — no breakage if env vars absent.
- Fire-and-forget keeps `apply*` synchronous from caller perspective; UI never blocks on network.
- LWW correctness via RPC means no last-writer-wins-by-write-order race.
- Anon-default + dynamic-import sync-runtime keeps the SSR bundle clean of supabase code paths.

**Negative:**

- Offline writes are queued via Dexie syncQueue (Phase 2a, feature 10). Hybrid enqueue: skip-network-when-offline OR enqueue-on-failure. Flush on online event + opportunistic + initial mount. Drop after 5 attempts per item with warn toast. LWW correctness inherited from RPC.
- LWW is whole-row; concurrent edits to different fields collide. Phase 2 may add per-field merge.
- Folder + tag deletes propagate cross-device via tombstones (Phase 2b, feature 11). `deletedAt: number | null` added to both schemas. `applyDeleteFolder` cascades tombstones through subtree. `applyDeleteTag` tombstones tag only — bookmarks retain ghost tag id references in `tagIds[]`, filtered out by selectors. Tombstones stay in Dexie/Postgres indefinitely (Phase 3 will add GC).
- RPC functions add SQL surface (3 functions, ~80 lines). Migration evolution requires keeping RPC + Postgres schema aligned.

**Rejected alternatives:**

- **Plain `.upsert()` without LWW** — last-writer-wins-by-write-order would silently overwrite cloud with stale local during multi-device bootstrap.
- **Bidirectional realtime subscriptions** — Phase 2 territory; adds reconnect logic + churn during local-cloud race.
- **CRDT** — overkill for single-user across few devices.
- **Normalized junction tables (`bookmark_tags`)** — clean SQL but diverges from Dexie shape + adds write surface per tag toggle.

## Cross-references

- ADR-001 — State Management (apply\* pattern preserved; new optional `sync`/`userId`/`onSyncError` fields)
- ADR-004 — Storage Strategy (Dexie canonical, Supabase mirrors)
- Migration: `supabase/migrations/0001_initial.sql`
- Setup: `supabase/README.md` + `README.md` § "Cloud sync (optional)"
