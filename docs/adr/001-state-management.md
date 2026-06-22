# ADR-001 — State Management

**Status:** Accepted
**Date:** 2026-05-21
**Phase:** 1 (Context Grounding)

## Context

LinkNest manages multiple concurrent state surfaces:

1. **Persistent domain state** — bookmarks, folders, tags, user preferences. Survives page reload, must support offline-first.
2. **Server-derived state** — preview metadata fetched from the `/api/preview` route handler; later, Supabase sync results.
3. **Ephemeral UI state** — layout mode (masonry/list/gallery), search query, drag-in-progress, modal open, selection.
4. **Cross-component coordination** — drag/drop source/destination, multi-select set, command palette open state.

Spec rules: optimistic updates, instant reloads, offline-ready, smooth synchronization. Performance budget keeps client JS minimal — server components first.

## Decision

**Three-tier state model:**

| Tier                 | Tool                                                                       | Scope                                                 |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Persistent domain | **Zustand** with `persist` middleware → IndexedDB (via Dexie, see ADR-004) | bookmarks, folders, tags, preferences                 |
| 2. Server state      | **`@tanstack/react-query` v5**                                             | preview fetches, future Supabase sync                 |
| 3. Ephemeral UI      | **Zustand** (no persist)                                                   | layout mode, search, drag, selection, command palette |

**Zustand slice structure** (single store, sliced):

```
useStore = create<RootState>()(
  persist(
    combine(
      bookmarksSlice,   // CRUD + selectors
      foldersSlice,
      tagsSlice,
      uiSlice,          // not persisted
      dragSlice,        // not persisted, ephemeral
    ),
    { name: "linknest", partialize: persistDomainSlicesOnly }
  )
)
```

**Selectors only** — components never read the entire store; they import named selectors from `store/selectors/*.ts`. Components dispatch via slice action functions.

**Optimistic update pattern:**

1. Action mutates Zustand store synchronously.
2. Persist middleware writes to IndexedDB in next tick.
3. (Phase 8) React Query mutation fires Supabase sync; on failure, rollback Zustand action via inverse mutation.

## Consequences

**Positive:**

- Server components default, hydrate selected slices on mount via React Server Components → client boundary.
- No global Context provider tree; Zustand selectors fire surgical re-renders.
- React Query handles cache/refetch/retry for preview and sync without rolling our own.
- Persistence middleware ships out of the box, no manual IndexedDB plumbing in store layer.

**Negative:**

- Two state libraries (Zustand + React Query). Mitigated by hard split: domain ≠ server-derived. Cross-rules in `docs/agents/domain.md`.
- Optimistic rollback requires inverse-mutation discipline. Test contract enforced per slice (TDD).
- Drag state lives in `dragSlice` rather than dnd-kit context for cross-component reads (multi-select). dnd-kit handlers dispatch to Zustand.

**Rejected alternatives:**

- Redux Toolkit — heavier API surface, reducer boilerplate over Zustand's set/get.
- React Context only — re-render fan-out kills card grid perf.
- Jotai — atom proliferation harder to enforce as the codebase grows.
- Putting server state in Zustand — would re-implement what React Query already does (stale time, retry, dedupe).

## Concrete contracts (Phase 3)

The optimistic + rollback pattern is now verified in code.

- Slice state shape: `{ byId: Record<id, T>, order: id[] }`.
- Pure reducers return `{ next, inverse }` where `inverse(next) === state` for any reversible mutation.
- Effectful actions `apply<Verb>(state, args, { adapter })` orchestrate optimistic commit + persistence + rollback. Signature lives in `store/slices/bookmarks-slice.ts`.
- Adapter interface (e.g. `BookmarksAdapter` in `lib/db/bookmarks-adapter.ts`) decouples the slice from Dexie. `memoryBookmarksAdapter()` lets tests run under jsdom without IndexedDB.

Verified: 10 vitest cases in `store/slices/bookmarks-slice.test.ts` covering add / remove / update / failed-persist rollback / sequential adds.

## Cross-references

- ADR-004 — Storage Strategy (IndexedDB schema, Supabase sync semantics)
- CONTEXT.md → Entities (Bookmark, Folder, Tag, Sync state)
- `docs/architecture.md` — module graph and layer contracts
- `types/index.ts` — branded ids, zod schemas, URL normalization
- `lib/db/bookmarks-adapter.ts` — adapter seam
- `store/slices/bookmarks-slice.ts` — pure + effectful reducer pattern
- A failing test is written against each slice contract before implementation (TDD). Folders / tags / preferences slices mirror the bookmarks shape.

## Note on Next.js version

Scaffold uses **Next.js 16.2.6** (current stable). Spec said Next.js 15. 16 ships App Router + React 19 cleanly, no architectural impact on this ADR. Re-evaluate only if React Server Components semantics shift.

## Amendment — Feature 01 (2026-05-22)

The original "Optimistic update pattern" described above reads:

> 1. Action mutates Zustand store synchronously.
> 2. Persist middleware writes to IndexedDB in next tick.
> 3. (Phase 8) React Query mutation fires Supabase sync; on failure, rollback Zustand action via inverse mutation.

Implementation of feature 01 surfaced a hazard: persist-middleware in next tick decouples the write from the rollback path. If the adapter throws, the inverse fires before persist has even attempted — leaving Dexie ahead of (or behind) the in-memory state. Race-prone, hard to test.

**Updated pattern (feature 01 onward):**

Each `apply*` action in `store/slices/bookmarks-slice.ts` performs the optimistic state mutation AND the adapter write inside the same async function. Rollback is the inverse of the pure reducer, applied if the adapter throws. The Zustand `persist` middleware is therefore NOT used by `store/index.ts`.

Hydration is explicit: `hydrateFromDexie()` runs on the first dashboard mount via `useEffect` inside `<BookmarkGrid>`, and flips `state.hydrated`.

Folders / tags / preferences slices (features 03 / 04 / later) follow the same direct-apply pattern.

Verified by 31 vitest cases in `store/slices/bookmarks-slice.test.ts` covering every apply\* happy + rollback path, plus 9 hook integration tests in `hooks/use-bookmarks.test.ts` exercising the full slice → adapter → eviction-queue → toast pipeline.
