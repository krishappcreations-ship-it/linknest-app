# LinkNest Architecture

> Phase 3 deliverable. Module graph + concrete contracts the rest of the build hangs off.

Cross-references: CONTEXT.md, ADR-001 (state), ADR-003 (folders), ADR-004 (storage), ADR-005 (design).

---

## Module graph

```
┌─────────────────────────────────────────────────────────────────────┐
│                              app/                                   │
│  ┌────────────┐  ┌────────────┐  ┌───────────┐  ┌────────────────┐  │
│  │ (dashboard)│  │(collections)│  │  search   │  │   settings     │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  └────────┬───────┘  │
│        │               │               │                 │           │
│        └───────────────┴───────┬───────┴─────────────────┘           │
│                                │ uses                                │
│  ┌──────────────────┐          │          ┌──────────────────────┐   │
│  │  api/preview     │←─────────┴─────────→│ components/* (UI)    │   │
│  │  (server route)  │                     │   cards, folders,    │   │
│  └────────┬─────────┘                     │   tags, search,      │   │
│           │                               │   layout, dragdrop,  │   │
│           │ fetch + parse                 │   motion, ui (Radix) │   │
│           ▼                               └──────────┬───────────┘   │
│  ┌──────────────────┐                                │                │
│  │ lib/preview/*    │                                │                │
│  │   og parser,     │                                ▼                │
│  │   favicon, etc.  │                     ┌──────────────────────┐    │
│  └──────────────────┘                     │ hooks/*              │    │
│                                           │ (Zustand + RQ glue)  │    │
│                                           └──────────┬───────────┘    │
│                                                      │ selectors      │
│                                                      ▼                │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                       store/                                  │   │
│   │  ┌─────────────┐ ┌──────────┐ ┌──────┐ ┌─────┐ ┌──────────┐  │   │
│   │  │ bookmarks   │ │  folders │ │ tags │ │ ui  │ │  drag    │  │   │
│   │  │   slice     │ │   slice  │ │slice │ │slice│ │  slice   │  │   │
│   │  └──────┬──────┘ └────┬─────┘ └──┬───┘ └──┬──┘ └────┬─────┘  │   │
│   │         └─────────────┴──────────┴────────┴─────────┘        │   │
│   │                          │ persist middleware                │   │
│   └──────────────────────────┼──────────────────────────────────┘   │
│                              ▼                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │ lib/db/  — Dexie adapter (single source of truth)            │   │
│   │   schema.ts  · bookmarks-adapter · folders-adapter ·         │   │
│   │   tags-adapter · preferences-adapter · preview-cache         │   │
│   └────────────────────────────┬─────────────────────────────────┘   │
│                                │ (Phase 8) sync mutations            │
│                                ▼                                     │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │ @tanstack/react-query → Supabase (Tier 2, feature 8)         │   │
│   └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Direction of dependency

- Components only depend on **hooks** and **store selectors** — never directly on Dexie or React Query.
- Hooks bridge Zustand state and React Query results into ergonomic shapes.
- The store layer reads/writes via adapter **interfaces** (`BookmarksAdapter`, etc.) — never imports Dexie directly.
- `lib/db/*` implements those adapter interfaces and is the only file that imports `dexie`.
- `app/api/preview` (server) is the only consumer of `lib/preview/*` — it fetches and parses metadata server-side, then returns clean JSON.

### What is **not** in this graph (and won't be unless ADR amended)

- No global Context provider tree for state.
- No Redux. No Jotai. No SWR.
- No direct `dexie` imports outside `lib/db/`.
- No GSAP anywhere in the tree.
- No `'use client'` in files under `lib/` or `store/` (state read/written from client components only; server components don't touch the store).

---

## Layer contracts

### 1. Domain types (`types/index.ts`)

- Branded ids: `BookmarkId`, `FolderId`, `TagId`.
- Zod schemas mirror each type — validate at every external boundary (form input, API responses, IndexedDB reads on first hydration).
- `normalizeUrl(url)` and `extractDomain(url)` — utility functions used at the URL boundary.
- `FOLDER_MAX_DEPTH = 3` (enforced in `foldersSlice.createFolder`).
- `TAG_COLORS` — locked 8-swatch palette.

### 2. Adapter interfaces (`lib/db/*-adapter.ts`)

Each entity has a `*Adapter` interface with `list / put / remove / get`. Two implementations:

- `dexie<Entity>Adapter(db)` — production
- `memory<Entity>Adapter()` — tests and Phase 3 prototype

This seam is non-negotiable: it makes slice tests run under jsdom without IndexedDB.

### 3. Slice contracts (`store/slices/*-slice.ts`)

Each slice exports:

- `<entity>State` type — `{ byId: Record<id, T>, order: id[] }` shape for indexable + ordered access.
- `initial<Entity>State` constant.
- Pure reducers — `(state, args) => { next, inverse }`. Inverse is a function that undoes the mutation when applied to `next`.
- Effectful actions — `apply<Action>(state, args, { adapter })` — applies pure reducer, persists via adapter, rolls back on failure. Returns `{ state, rolledBack, error? }`.

The Phase 5 Zustand `create()` wires these into the live store. Phase 3 proves the pattern via vitest with `memory<Entity>Adapter`.

### 4. Optimistic + rollback pattern (verified in Phase 3)

```
applyAction(state, args, { adapter })
  1. const { next, inverse } = pureReducer(state, args);
  2. set(next);                          // optimistic UI commit
  3. try   { await adapter.persist(...) }
     catch { set(inverse(next)); }       // roll back on failure
```

This pattern is fundamental and reused for every slice. Verified by 10 tests in `store/slices/bookmarks-slice.test.ts`. Folders, tags, preferences will mirror exactly.

### 5. Preview pipeline

```
Client paste / "Add bookmark" form
  → POST /api/preview { url }
  → server: fetch(url) → parse <meta og:* /> → return { title, description, imageUrl, faviconUrl, domain, fetchedAt }
  → client: BookmarkSchema.parse(server response merged with input)
  → applyAddBookmark(state, bookmark, { adapter })
```

No client-side fetch of arbitrary URLs (CORS + IP leakage + sanitization risk).

### 6. Drag/drop wiring (per ADR-003)

```
dnd-kit DndContext
  ↓ DragStartEvent / DragMoveEvent / DragEndEvent
dragSlice action (setDragging / setOver / commitDrop)
  ↓ on commit
bookmarksSlice.moveToFolder(id, targetFolderId)
  OR
foldersSlice.reorder(id, beforeId)
  ↓
adapter.put (optimistic + rollback)
```

dnd-kit is the input layer; the slice is the source of truth. dnd-kit doesn't store drag state long-term — it dispatches into Zustand.

---

## Anti-shallow-module audit (Phase 3 `/improve-codebase-architecture`)

Modules currently in repo:

| Module                            | Lines      | Depth            | Status                                                      |
| --------------------------------- | ---------- | ---------------- | ----------------------------------------------------------- |
| `lib/utils/cn.ts`                 | 8          | shallow          | Acceptable — universally used, no growth pressure           |
| `types/index.ts`                  | 142        | deep             | One file owns all domain types + zod schemas + utils. Good. |
| `lib/db/schema.ts`                | 32         | shallow          | Acceptable — Dexie boilerplate, no further depth needed     |
| `lib/db/bookmarks-adapter.ts`     | 51         | medium           | Will grow when folders/tags adapters land — keep            |
| `store/slices/bookmarks-slice.ts` | 130        | deep             | Pure reducers + inverse + apply\* — appropriately deep      |
| `app/styles/motion.ts`            | 138        | deep             | Single source of truth for motion — by design               |
| `components/ui/*`                 | 30–80 each | shallow per file | Acceptable — primitives are by nature small                 |

**No premature abstractions** detected. All shallow modules are either universally-used utilities (`cn`) or Dexie boilerplate that can't be made deeper without losing clarity.

---

## What this graph promises Phase 4+

When feature planning starts:

1. Every feature is a **vertical slice** through this graph: types → adapter → slice → hook → component → test.
2. New features must reuse existing adapters / slices where applicable — `foldersSlice` is added in feature 03, not duplicated per page.
3. No new top-level module categories without an ADR amendment.
4. The optimistic-rollback contract is the only pattern for mutation; never raw `setState(...)` followed by hopeful persistence.
