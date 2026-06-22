# ADR-011 — Smart Collections

**Status:** Accepted (2026-06-18)
**Context feature:** F27 — Smart Collections

## Context

Users want rule-based saved searches that auto-populate ("untagged",
">10 min reads", "saved this month"). The folder/tag system covers manual
organization; this adds dynamic, rule-driven collections.

## Decision

- **Local-only entity.** A `SmartCollection` (`{ id, name, rules[], order, timestamps }`) lives in a new Dexie `smartCollections` table (schema **v7**, additive). No Supabase table, LWW, tombstone, or realtime this slice — collection definitions don't sync (deferred). Hard delete.
- **Flat AND rules.** `Rule` is a zod discriminated union by `field` (readState, captureStatus, tag has/lacks, untagged, folder in/unfiled, readingMinutesGte, createdWithinDays). All rules must match (`matchesRules` = `every`). An empty rule list matches **nothing** (a rule-less collection is empty, not "everything"). OR/nesting deferred.
- **Pure evaluator.** `lib/collections/evaluate-rules.ts` is side-effect-free; it takes a `RuleContext` (reading-minutes lookup, folder-subtree predicate, `now`) so it's trivially testable and reused by both the grid filter and the sidebar count.
- **Reading-minutes corpus.** The `readingMinutesGte` rule needs article reading time in memory, so `RootState.articleReadingMinutes` is populated alongside the F26 `articleText` corpus (hydrate/capture/evict) — a second small map rather than coupling to the F26 text map.
- **Filter mode.** `ui.activeSmartCollectionId` is a distinct grid mode, **mutually exclusive** with the folder/tag/read-state filters (selecting one clears the others). Centralized in `setActiveSmartCollection` + the folder/tag/read-state setters.

## Consequences

- Collections are device-local; cross-device sync is a clean follow-up (add the folder/tag-style stack).
- Sidebar counts + the grid both run the evaluator over visible bookmarks per render; memoized, fine at this app's scale (same shape as folder counts). A dedicated index would be the escape hatch at large scale.
- New rule fields extend the discriminated union + the evaluator switch + the builder's value control — a clear, bounded extension point.
