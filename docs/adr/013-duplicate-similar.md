# ADR-013 — Duplicate & Similar Detection

**Status:** Accepted (2026-06-18)
**Context feature:** F29 — Duplicate & Similar Detection

## Context

Two gaps: (1) the same page saved with different tracking junk (`?utm_*`,
`fbclid`, share `#fragment`) slipped past duplicate detection, which matched on
`normalizeUrl` (case/port/trailing-slash only); (2) no way to find topically
similar bookmarks, even though F28 already computes embeddings.

## Decision

- **Canonical key, denylist not allowlist.** `canonicalizeUrl`
  (`lib/dedupe/canonicalize.ts`) extends `normalizeUrl` by dropping the fragment
  and a **denylist** of known tracking params, then sorting the rest. Denylist
  (not allowlist) so real params (`id`, `q`, `page`) are preserved — the risk is
  over-merging distinct URLs, so we only strip params known to be tracking
  noise. `findBookmarkByUrl` compares canonical keys; the stored `Bookmark.url`
  is **unchanged** (original kept for display + open).
- **No merge, no schema change.** Existing warn-and-block "Already saved" toast
  is reused as-is. Embed-similarity adds no persisted data — `findSimilar`
  reads the F28 `embeddingById` map. So **no Dexie bump, no zod change, no
  literal cascade**.
- **No similar-on-add.** At add time a bookmark has only its URL; its
  title/description/article (and thus embedding) arrive later via the async
  preview/capture/embed workers. "Similar to the thing I just saved" has no
  vector yet, so similarity is surfaced _after_ enrichment, never on add.
- **Filter mode, not a detail panel.** No bookmark detail panel exists (focus =
  ring highlight + scroll). Rather than build one, similar reuses the **F27
  smart-collection filter-mode pattern**: `ui.similarToBookmarkId` (mutually
  exclusive with folder/tag/read-state/smart-collection filters, cleared by all
  competing setters), a highest-priority branch in the `bookmark-grid` `useMemo`,
  a "N similar" entry pill, and a clear strip above the grid.
- **Masonry card only (staged).** The pill ships on the masonry `BookmarkCard`;
  list-row + gallery-card pills are deferred (same staged-rollout discipline as
  earlier features). `findSimilar` (pure) is reused by both the grid branch and
  the pill, so extending to other layouts is a one-line render addition.

## Consequences

- More duplicates caught at save time with zero UI change (Part 1 is pure key
  improvement). The denylist is a clear, bounded extension point as new tracking
  params appear.
- `findSimilar` runs per visible masonry card per render (O(cards × vectors)).
  Memoized per card; fine at this app's scale (same cost shape as folder counts).
  Escape hatch if it bites large libraries: precompute neighbors or gate the
  pill behind hover.
- Similar is device-local (rides F28 vectors). Cross-device parity is automatic
  once embeddings sync — no F29-specific work.
- F29 fully reuses F28 (`cosineSim`, `embeddingById`) and F27 (filter mode),
  validating both as durable platform primitives.
