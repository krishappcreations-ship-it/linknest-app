# ADR-008: Layout Modes Architecture (feature 07)

**Status:** Accepted (2026-05-30)
**Context:** Feature 07 ships three bookmark grid view modes (masonry, list, gallery) per PROJECT_SPEC §7. Layout choice persisted globally via the existing `preferences` Dexie table. Segmented control in topbar + Cmd+1/2/3 shortcuts.

## Decisions

1. **PreferencesAdapter** mirrors the existing bookmarks/folders/tags adapter pattern. Dexie variant reads/writes the `preferences` table (key/value rows). Memory variant for tests. Default `Preferences = { layout: "masonry", pinnedFolderIds: [], theme: "dark" }`.

2. **preferences-slice** owns layout state via `setLayout(state, mode)` + `applySetLayout(state, mode, { adapter })`. Same `{next, inverse}` + apply\* pattern as ADR-001.

3. **Global layout scope.** One `preferences.layout` field, applied everywhere. Per-filter memory deferred until requested.

4. **Three card components, not one with variant prop.** Existing `<BookmarkCard>` stays as the masonry variant (zero touch). New `<BookmarkListRow>` (compact, 48px height) and `<BookmarkGalleryCard>` (preview-first, aspect-[4/3], min-width 360px). Grid dispatches via `<AnimatePresence mode="wait">` branches.

5. **Two new sortable wrappers, not refactored.** `<SortableBookmarkRow>` (vertical list, no compress) + `<SortableBookmarkGalleryCard>` (rect, full compress like masonry). Parallel approach matches feature 05's pattern; refactor to generic `<SortableItem render={...}>` if a 3rd variant emerges.

6. **Crossfade transition** via `<AnimatePresence mode="wait">` keyed on layout. Old layout exits (150ms), new enters (200ms). `mode="wait"` ensures sequential transition, no overlap. Container-only — per-card position FLIP rejected (clashes with feature 05 layout="position" on FolderRow).

7. **Responsive via CSS auto-fill** per-layout min-widths (masonry 260px, gallery 360px, list always 1-col). No JS viewport listener. User agency preserved on all viewports.

8. **Switcher disabled mid-drag.** `<LayoutSwitcher>` uses `useDndContext().active !== null` to disable buttons during drag. Prevents mid-drag layout swap from fighting dnd-kit transform/animation state.

9. **Cmd+1/2/3 keyboard shortcuts** registered via `useEffect` in `usePreferences`. `preventDefault()` to suppress browser tab-switch (Cmd+1 on Chrome). If user reports breakage, fall back to Cmd+Option+1 in a follow-up.

## Consequences

- `bookmark.order` array remains global. Reorder in list mode visually appears as "swap positions" but in masonry could split rows visually. Acceptable — one ordered list, multiple renderings.
- Two parallel sortable wrappers (`SortableBookmarkRow` + `SortableBookmarkGalleryCard`) double the wrapper surface. Documented; revisit with generic `<SortableItem render={...}>` if 3rd emerges.
- `Preferences.pinnedFolderIds` + `theme` fields scaffolded but not wired (only `layout` consumed). Future features get adapter parity for free.
- PreferencesAdapter is single-row (3 keys) vs bookmarks/folders/tags which are per-id. Adapter surface diverges accordingly (`get(): Preferences` + `set(prefs)` vs `list/put/remove/get(id)`). Acceptable — single-instance config doesn't fit the multi-row pattern.

## Amendment — Feature 24 (2026-06-18)

Reader Mode extends the preferences/theme system:

- **Theme applied at last.** `Preferences.theme` + the `:root[data-theme="light"]` CSS vars existed since early on but nothing set the attribute. F24 adds `ThemeApplier` (root-layout client effect) that sets `document.documentElement.dataset.theme` from `Preferences.theme`, plus `applySetTheme` (mirrors `applySetLayout`). The reader toolbar is the first toggle; the apply is app-wide.
- **Reader typography** — three new flat `Preferences` fields (`readerFontSize`/`readerFontFamily`/`readerWidth`, defaults m/serif/normal) persisted via the existing key/value preferences adapter (`DEFAULT_PREFS` + `preferencesFromRow` default the new keys; reader typography is local-only, no cloud columns). Applied as `data-*` attributes on `.reader-prose` (CSS in `globals.css`).
- **`Bookmark.readProgress`** (Dexie v6, local-only) drives scroll restore + auto-`finished` at ≥95%; persisted throttled via `useBookmarks.setReadProgress`.
- **Reader route** `/read/[id]` lives outside the `(dashboard)` group (no chrome); a client island re-sanitizes the captured HTML with DOMPurify before render.
