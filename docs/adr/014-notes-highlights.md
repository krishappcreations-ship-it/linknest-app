# ADR-014 — Notes & Highlights

**Status:** Accepted (2026-06-19)
**Context feature:** F30 — Notes & Highlights

## Context

Users could save and read articles (F23/F24) but not annotate them. Two needs:
a free-text note per bookmark, and the ability to highlight passages while
reading. The reader renders the article as an **opaque
`dangerouslySetInnerHTML` blob**, re-sanitized each mount — so highlight
positions cannot rely on stable DOM nodes or character offsets.

## Decision

- **Text-quote anchoring (not XPath/offset).** `lib/highlights/anchor.ts` stores
  the exact `quote` plus ~32 chars of `prefix`/`suffix` context, and resolves it
  by walking the rendered text nodes and scoring occurrences by surrounding-text
  match. This is the W3C-Annotation / hypothes.is approach. Rejected
  alternatives: DOM XPath + offset (breaks on any sanitizer/markup change) and
  plaintext char offset (no duplicate disambiguation, breaks on whitespace
  normalization). Persisting no DOM offsets is what makes highlights survive
  re-capture and re-render.

- **Note synced, highlights local-only.** `bookmark.note` is an additive
  nullable field that rides the **existing F11 bookmark entity** (zod + supabase
  converter + LWW RPC update in migration `0005`) — no new sync entity. A
  Highlight anchors into article HTML, which is itself device-local (F23), so
  highlights are local-only too: new Dexie `highlights` table (v9), new
  `highlightsAdapter` + `highlights-slice`, never enqueued. `QueueEntity` stays
  `bookmark | folder | tag | preferences`.

- **Unresolved highlights are kept, not deleted.** If a re-captured article no
  longer contains a highlight's quote, `resolveAnchor` returns `null`; the
  highlight is listed dimmed under "Not found in current article" in the
  sidebar. Silently dropping user annotations is unacceptable; an article can
  change and change back.

- **New slice, not folded into bookmarks.** Highlights get their own pure-reducer
  slice (matches the smart-collections / embeddings precedent) so
  `bookmarks-slice` stays lean and the local-only lifecycle is explicit.

- **Both note levels.** A bookmark-level note (synced) plus an optional
  annotation on each highlight (local). The annotation is just a text field on
  the Highlight record — no separate table.

## Consequences

- Notes get cross-device sync for free via F11; highlights are device-local and
  gain cross-device parity only if/when the article snapshot itself syncs (out
  of scope, same posture as F23/F28).
- `resolveAnchor` runs O(occurrences × context) per highlight per repaint;
  memoized per article render, fine at this app's scale. Escape hatch for very
  long articles: cache resolved ranges between repaints.
- Painting mutates the live reader DOM (`<mark>` wrapping). `clearHighlights`
  unwraps + `normalize()`s before each repaint to stay idempotent; the paint
  layer is pure-function-tested (`paint.test.ts`) independent of React.
- The "N similar"/note glyph and the note textarea ship on the masonry card +
  add/edit dialog + reader; list-row and gallery-card note glyphs are deferred
  (staged rollout, same as F29).
