# ADR-003 — Folder Architecture

**Status:** Accepted
**Date:** 2026-05-21
**Phase:** 1 (Context Grounding)

## Context

LinkNest must support hierarchical organization of Bookmarks. Spec requirements:

- Create folders, create nested collections
- Drag bookmarks between folders, reorder collections
- Pin favorite folders to top of sidebar
- Drag/drop must feel premium (spring-based, physical, responsive)
- Multi-select drag supported

Open questions resolved during Phase 1 grilling:

- **Nesting depth:** unbounded recursion creates UX hell (drag/drop ambiguity, sidebar virtualization complexity, breadcrumb explosion).
- **Folder vs Collection:** spec uses both interchangeably; pick one canonical term.
- **What does "pinning" mean:** sticky-at-top in sidebar, independent of normal ordering.

## Decision

**Canonical term: Folder.** "Collection" is a rejected synonym (logged in CONTEXT.md glossary). All code, types, UI labels use `Folder`.

**Nesting depth: 3 levels maximum.**

```
Folder (root)            depth 0
├── Folder               depth 1
│   └── Folder           depth 2  ← deepest allowed
│       └── (Bookmark only; no further folders)
```

Validation enforced at the action layer in `foldersSlice`: `createFolder({ parentId })` rejects if computed depth > 2 (zero-indexed).

**Folder shape:**

```ts
type Folder = {
  id: string; // UUID v4
  name: string; // 1..64 chars, no leading/trailing whitespace
  parentId: string | null; // null = root-level
  order: number; // float for cheap reorders (LexoRank-style or fractional indexing)
  pinned: boolean; // sticky at top of sidebar list (depth 0 only)
  color: string | null; // optional accent from curated palette (ADR-005)
  createdAt: number; // epoch ms
  updatedAt: number;
};
```

**Drag/drop semantics** (via `@dnd-kit`):

| Action                      | Drop target                                | Visual hint                                         |
| --------------------------- | ------------------------------------------ | --------------------------------------------------- |
| Drop **into** a folder      | hover over folder body                     | folder body pulses + scales to ~1.02                |
| Drop **between** folders    | hover over gap                             | thin accent line appears at insertion point         |
| Drop bookmark into folder   | hover over folder body                     | folder accepts, bookmark animates into card         |
| Multi-select drag           | shift-click or cmd-click to select         | dragged stack shows compressed counter badge        |
| Drop on depth-3 folder body | invalid for new folder, valid for bookmark | folder body shakes if attempting nested folder drop |

**Pinning rule:** only depth-0 folders can be pinned. Pinned folders sort by `pinned DESC, order ASC` in the sidebar.

**Order field:** uses fractional indexing — inserting between A (order=1) and B (order=2) gets order=1.5. Periodic rebalance (Phase 7 milestone) if any order has > 5 decimal places.

## Consequences

**Positive:**

- Depth limit means sidebar can render statically without virtualization for MVP.
- Drop-zone calculation is O(visible folders), small and predictable.
- Multi-select drag uses Zustand `dragSlice` (per ADR-001) so dnd-kit doesn't need to know about selection.
- Color tokens scoped to ADR-005 palette → no rainbow folder explosion.

**Negative:**

- Power users may want deeper nesting; will need ADR revision if usage data demands it.
- Fractional ordering requires occasional rebalance; can be skipped at the Phase 7 cost.

**Rejected alternatives:**

- Unlimited nesting: breaks drag/drop UX, creates breadcrumb hell, requires sidebar virtualization for MVP.
- Flat (1 level): contradicts spec "nested collections" requirement.
- Tags-instead-of-folders: orthogonal feature (Tag is separate per ADR-005); not a replacement.

## Cross-references

- ADR-001 — State Management (`foldersSlice`, `dragSlice`)
- ADR-004 — Storage (Folder schema in IndexedDB)
- ADR-005 — Design Principles (curated color palette)
- CONTEXT.md → Entities (Folder, Drag operation, relationships)
- Plan Phase 4 — feature 3 (folders) implemented before feature 7 (drag/drop) so the tree exists before drag interactions wire up.

## Amendment — Feature 03 (2026-05-25)

### Delete cascade policy

Original ADR-003 declared depth + pin + order semantics but didn't specify delete cascade. Feature 03 locks the policy:

- **Bookmarks survive folder delete.** All bookmarks whose `folderId` is in the deleted subtree are reassigned to `folderId: null` (root). No bookmark data is destroyed.
- **Subfolders cascade-delete.** Deleting a folder removes the folder AND all its descendant folders. Folder hierarchy is the only thing lost.
- **No folder soft-delete / undo.** Folder removal is immediate after confirm. The confirm dialog is skipped for empty folders (no risk) and shown for non-empty (real cost).
- **Pinned subfolders unpin automatically as they're removed.** No orphan pins.

### Depth validation

Single source of truth: `applyCreateFolder` in `store/slices/folders-slice.ts` rejects with `{ kind: "depth-error" }` when `selectFolderDepth(state, parentId) + 1 >= FOLDER_MAX_DEPTH`. UI also hides the "New subfolder" menu entry at depth 2 (defensive — error path is exercised by tests but should never user-surface).

### Order field initialization

`order = createdAt` for fresh folders. Drag/drop reordering (feature 07) will edit this field via LexoRank-style insertion. Until then, the sort key is `[pinned DESC, order ASC]` which produces "pinned-first, then chronological."

### Selector locations

- `selectFolderSubtreeIds(state, rootId)` — folders-slice. Used by delete cascade + grid filter + count badges.
- `selectVisibleFolderRows(state, collapsed)` — folders-slice. Used by sidebar render + folder picker.
- `selectFilteredBookmarks({bookmarks, folders, filter})` — bookmarks-slice. Composes `selectVisibleBookmarks` with the filter discriminator.

### Cross-slice helper

`applyDeleteFolder` is the only cross-slice apply\* in the codebase. Lives in folders-slice; accepts both `FoldersState` + `BookmarksState` and writes via both adapters. If feature 04 (tags) adds similar cross-cutting ops, refactor to a `cross-slice-actions` module.
