# ADR-006: Drag & Drop Architecture (feature 05)

**Status:** Accepted (2026-05-29)
**Context:** Feature 05 introduces drag/drop for bookmark reorder, folder reorder, drop-bookmark-to-folder, and drop-folder-to-nest. Required: premium spring-based feel, keyboard accessibility, touch-friendly. PROJECT_SPEC §3.5 calls this the "core feature".

## Decisions

1. **Library: dnd-kit 6** (`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`). Chosen over react-dnd for: smaller bundle, no provider hell, first-class keyboard + touch support, accessibility primitives built in. Over `react-beautiful-dnd`: actively maintained.

2. **Single DndContext** mounted at `components/dnd/dnd-provider.tsx` (client wrapper around the server-side `app/(dashboard)/layout.tsx`). Sidebar + grid share one drag event stream. Lets a bookmark dragged in the grid land on a folder row in the sidebar without context-bridge gymnastics.

3. **Two SortableContexts** — bookmark grid uses `rectSortingStrategy`; folder sidebar uses `verticalListSortingStrategy`. Items are identified by colon-delimited ids (`bookmark:<id>:sortable`, `folder:<id>:sortable`) so a single switch in `useDragDrop` routes events.

4. **Droppable id scheme.** `<kind>:<id>:<role>`. Two roles: `sortable` (handled by the SortableContext strategy) and `body` (explicit `useDroppable` per folder row, accepts both bookmark moves and folder nests).

5. **Order persistence: array-based.** `BookmarksState.order: BookmarkId[]` is mutated by array splice. Folder children arrays in `childrenByParent` are similarly spliced. No LexoRank / fractional indexing — MVP target is hobbyist library (<10k bookmarks). Revisit if feature 09 adds virtualization or 10k+ catalogs become common.

6. **Sensors.** PointerSensor (8px distance threshold) for mouse. TouchSensor (250ms delay, 5px tolerance) for touch — long-press disambiguates from scroll. KeyboardSensor with `sortableKeyboardCoordinates` for full keyboard access. Sensors live inside the React-only `useDragDrop()` hook; the pure factory `getUseDragDropApi()` returns only handlers + announcements (testable outside React).

7. **Cycle + depth enforcement** lives in `nestFolder` reducer (pure, returns next === state on refusal) AND in `<DropZoneBody>` (disables the droppable so users get no swell affordance to attempt the invalid move). Belt + suspenders — UI prevents the gesture, slice rejects if it ever fires anyway.

8. **Visual treatment.** Original in place: `opacity-0.5 + scale(0.97)` (compress cue per PROJECT_SPEC §Motion). DragOverlay clone: same scale + `shadow-2xl`. Drop targets: sibling slide-apart via `useSortable`'s `transform` (free); folder body swell via `bg-accent-blue/10 + ring-2 + scale(1.02)`. dropAnimation uses bezier matching `ease.out` token (`cubic-bezier(0.23, 1, 0.32, 1)`).

9. **No new motion tokens.** `spring.drag` was added speculatively in Phase 2 — feature 05 doesn't end up using it because dnd-kit's internal transform follow is preferred over spring lag (lag reads as input lag). Token stays for future use (multi-select cluster physics in feature 05.5).

## Consequences

- Bundle size: ~30KB gzipped for the three dnd-kit packages. Acceptable for a core feature.
- `touch-action: none` on draggable items means iOS users cannot trigger the native context menu on a long-press. Trade for drag clarity; document in user-facing docs once we have any.
- The colon-delimited id scheme is stringly-typed but compact and readable. A typed registry alternative was rejected as YAGNI.
- Cross-slice nature of drag (bookmark drops touch the folders slice via `folderId`) follows the same pattern as feature 04's tag cascade — eventual extract to `cross-slice-actions/` is still a future refactor candidate (now 3 cross-slice ops: applyDeleteFolder, applyDeleteTag, applyMoveBookmarkToFolder).
- The hook split (`getUseDragDropApi` pure + `useDragDrop` React) is a deviation from the original plan but forced by the test runtime — sensors need React render context. Pure handlers stay testable; sensors stay encapsulated.
