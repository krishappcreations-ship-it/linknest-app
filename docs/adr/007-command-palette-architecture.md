# ADR-007: Command Palette Architecture (feature 06)

**Status:** Accepted (2026-05-29)
**Context:** Feature 06 ships an instant-search + Cmd+K command palette per PROJECT_SPEC §6 and the CONTEXT.md locked decision "Cmd+K scope → full command palette (search + actions)". Three result groups: Actions, Navigation (folders + tags), Bookmarks.

## Decisions

1. **Library: cmdk** (Vercel/pacocoursey, ^1.x). ~10KB gzipped. Built-in keyboard nav, fuzzy matching via `command-score`, group support, accessibility. Used by Linear, Vercel, GitHub, Raycast clones. Custom alternative would re-implement keyboard event loop + scoring → ~150-200 LOC + bugs. shadcn ships a `<Command>` wrapper for it; we use cmdk's `Command.Dialog` directly (see decision 4).

2. **Single mount.** One `<CommandPalette>` at `app/(dashboard)/layout.tsx` inside `<DndProvider>`. Cmd+K listener is global; palette state lives in `ui-slice.commandPaletteOpen`.

3. **Result types — Bookmarks + Actions + Navigation.** Folders and tags surface as Navigation commands ("Go to <folder>", "Filter by <tag>") rather than raw entity rows. Matches Linear/Raycast pattern: "everything in the palette is something I can do". Avoids the "what happens when I click a tag row?" ambiguity.

4. **One-off exception to the @/components/ui/dialog wrapper convention.** cmdk's `<Command.Dialog>` bundles dialog + command behavior (focus management + keyboard event loop must share a context). Wrapping cmdk inside our existing dialog primitive would break this. We mirror the wrapper's animation classes (`data-[state=open]:animate-in fade-in-0 zoom-in-95 duration-300/200`) manually so visual identity stays consistent. Documented here so the next session doesn't try to "fix" by rewrapping.

5. **Filter context bleed prevention.** Palette searches the FULL `selectVisibleBookmarks` set, NOT the currently-filtered sidebar view. Filters live in the sidebar; the palette is global search. Avoids the "I searched but my saved bookmark isn't here because of a filter I forgot was on" footgun.

6. **Bookmark click = open URL + close palette.** Plain click and Enter both open in a new tab via `window.open(url, '_blank', 'noopener,noreferrer')`. No modifier surface (Cmd-click, Shift-click) — the palette is a discovery + action surface, not a card-clone. Card-style modifier behavior remains on the grid.

7. **Three actions for v1.** `Add bookmark`, `New folder`, `Clear filters`. Context-aware actions (Refresh preview when focused, Delete selected when selection > 0) deferred — Cmd+Backspace already handles delete; refresh is kebab-only. Future-proof placeholders for unbuilt features (layout switcher, dark mode toggle) deliberately skipped — disabled UI for unimplemented features is bad pattern.

8. **Search field scope — spec-literal.** `searchableValue` per bookmark = lowercased concat of `title + domain + url + description + tagNames`. cmdk's default `command-score` algorithm handles ranking. No field weighting (premature), no prefix-scoped syntax (`title:` etc — YAGNI), no result highlighting (Linear ships without; defer).

9. **Empty-state shows Actions + Navigation; bookmarks appear once user types.** When query non-empty, cmdk filters all three groups against the query. `Add bookmark` is still matchable by typing `add` — power-user shortcut.

## Consequences

- Bundle size: ~10KB gzipped for cmdk. Acceptable for a core feature called out in PROJECT_SPEC §6.
- Wrapper-convention exception (decision 4) documented here. If a second exception appears (some future library bundling its own modal), revisit whether the wrapper convention is the right abstraction.
- Folder count > 50 → Navigation group bloat. MVP target is <50 folders; cmdk handles 1000s of items fine but visual density may want virtualization later.
- Action set grows incrementally with features 07+ (layout switcher → "Switch to list", etc). Each new action adds one row in `useCommandResults`.
- Per-row icons landed in feature 07.5 polish slice. Each row carries an `icon: ReactNode`: plus glyph for Add bookmark, folder outline for New folder + Go to <folder>, filter-with-slash for Clear filters, color dot for Filter by <tag> (using `tag.color`), favicon for bookmark rows (with first-letter fallback on missing/error).

## Amendment — Feature 26 (2026-06-18)

Full-text search over captured article bodies.

- The command palette gains body-text matching by **folding each captured article's body into the bookmark row's `searchableValue`** — cmdk's existing filter then matches it. No new search surface, no index library.
- An in-memory `RootState.articleText` corpus (`bookmarkId → truncateForIndex(textContent)`, 2000 chars lowercased) is the source. Lifecycle: built on `hydrateFromDexie`, written by the capture worker on success, dropped on hard-evict; re-capture overwrites.
- **2000-char truncation** bounds cmdk's per-keystroke scoring cost (it scores every item's `value` each keystroke). Adequate for this app's scale; a dedicated index (minisearch) is the documented escape hatch if a real corpus grows large.
- Local-only (articles are local-first); no snippet/highlight in v1.
