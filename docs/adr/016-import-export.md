# ADR-016 — Import / Export

**Status:** Accepted (2026-06-20)
**Context feature:** F32 — Import / Export

## Context

Onboarding's biggest friction is getting existing bookmarks _in_ (from a browser,
Raindrop, or Pocket), and users expect their data _out_. LinkNest had no
portability path. Constraints: stay local-first, no new infra, no schema change.

## Decision

- **Skip duplicates on import.** `runImport` checks the F29 canonical-URL key
  (`findBookmarkByUrl`) and skips matches, so re-importing the same file is
  idempotent. Rejected merge-on-duplicate (ambiguous conflict rules) and
  import-all (pollutes on re-import).

- **Clamp imported folders to `FOLDER_MAX_DEPTH = 3`.** Netscape trees nest
  arbitrarily; folders below level 3 collapse into their deepest allowed
  ancestor (`ensureFolderPath` stops creating past depth 3 and returns the
  deepest id). The item always lands in a real folder; no data loss of the
  bookmark itself. Rejected flatten-path-into-name (ugly labels) and
  deep-folders-as-tags (mixes two organizing systems).

- **Pure parsers + dependency-injected engine.** `parseNetscape`/`parseLinkNest
Json` are pure string↔data (DOMParser, no dependency). `runImport` takes its
  writes as injected `ImportDeps`, so it unit-tests with in-memory fakes — no
  React/Dexie. The UI wires the real `applyAddBookmark`/`createFolder`/
  `createOrGet`. This keeps the risky logic (folder nesting, dedup, chunking)
  framework-free and fully covered.

- **No schema change, no new sync entity.** Import/export ride the existing
  write paths and store. Export carries **names, not internal ids**
  (`LinkNestExport` v1) so a file is portable across devices/installs; local-
  derived data (snapshot/embedding/highlight/article) and tombstoned rows are
  excluded; the user-authored **note** is included.

- **Chunked main-thread import, no Web Worker.** Parse + writes run on the main
  thread, chunked (~50) and yielded to a macrotask between chunks, so a 10k-entry
  file never freezes the UI. A worker was rejected as overkill (Dexie + store are
  main-thread anyway).

- **One dialog, two entry points.** Command-palette actions + a sidebar footer
  link open a single `import-export` dialog (no settings page). The open selector
  is a **boolean** (`dialog.kind === "import-export"`) — heeding the F31 lesson
  that fresh-array `useStore` selectors loop React 19.

## Consequences

- Users can move in/out in seconds; JSON round-trips losslessly (skip-dup makes
  re-import a no-op); HTML is portable to any browser/Raindrop/Pocket.
- **v1 timestamp loss:** `applyAddBookmark`/`buildBookmark` set `createdAt = now`
  and accept no override, so imported items get an import-time `createdAt`
  (`addDate` is parsed but not stored). Lossless timestamps would mean threading
  an optional `createdAt` through the add path — deferred to keep scope tight.
- `foldersCreated`/`tagsCreated` in the summary count distinct paths/names seen
  in the run (get-or-create dedups against the store), an approximate "new this
  import" — exact created-vs-reused was not worth threading through the engine.
- The Netscape parser is the riskiest piece (folder nesting varies by exporter);
  tests cover the standard browser/Raindrop shape, and `findFollowingDl` handles
  the sibling-`<DL>` layout. New real-world variants extend that one function
  without touching the engine or UI.
