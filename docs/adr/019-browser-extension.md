# ADR-019 — Browser Extension

**Status:** Accepted (2026-06-21)
**Context feature:** F35 — Browser Extension (finish + re-validate the F20 scaffold)

## Context

A near-complete MV3 extension scaffold existed in `browser-extension/` (F20:
manifest, Vite build, React popup, auth/save flow, 27 tests) but was never
finished — `typecheck` had 6 errors and its `.insert()` write predated several
schema changes. The goal: make it build/typecheck/test green and save reliably,
without re-drifting.

## Decision

- **Standalone extension, separate workspace.** `browser-extension/` keeps its own
  Vite + vitest + tsconfig and talks to Supabase directly (it is not part of the
  Next app tree). The main repo's husky/CI do not cover it; its gates
  (`npm run typecheck && npm test && npm run build`) are run manually.

- **Write through the shared `upsert_bookmarks_lww` RPC**, not a raw `.insert()`.
  `buildBookmarkRow` (pure, unit-tested) builds the full snake_case row; the popup
  calls `supabase.rpc("upsert_bookmarks_lww", { rows: [row] })`. One write path for
  app + extension = it can't drift again as columns are added (a future column is
  handled in the RPC only); idempotent; RLS-respecting (RPC is `security invoker`).

- **Email/password auth only.** OAuth in an MV3 popup needs `chrome.identity` + a
  redirect flow (YAGNI). The Supabase **anon key in the bundle is public by
  design** (RLS protects rows) — documented, not a leaked secret. Session lives in
  `chrome.storage.local`.

- **Exact-URL dedup (v1).** A pre-save `.select().eq("url", normalizeUrl)` check.
  The extension can't cleanly import the app's F29 `canonicalizeUrl`, so canonical
  variants (utm/fragment) aren't deduped at save time — the common re-save-same-URL
  case is. The app's own dedup still applies on its side.

- **Drift fixes.** `src/vite-env.d.ts` declares `import.meta.env` directly (not via
  `vite/client`, which drags Vite's node types and collides with `@types/chrome`);
  `tsconfig` gains `skipLibCheck`; `useFolders` binds a non-null const so the nested
  `getDepth` closure narrows.

- **Store submission deferred.** Usable via "Load unpacked" (free). Chrome Web
  Store needs a one-time $5 developer fee + manual review — out of this milestone.

## Consequences

- Saving from any tab works and syncs to the app immediately via the shared RPC +
  realtime. Re-validation is drift-proof going forward.
- The extension is verified by its own typecheck/test/build + a build-artifact
  smoke (`dist/manifest.json` emit + a manifest-shape test); the popup is
  `chrome-extension://` context, so end-to-end is the documented manual
  load-unpacked flow, not an automated browser smoke.
- The bundle ships the public anon key — acceptable (RLS), standard for client-side
  Supabase.
- To publish later: register on the Chrome Web Store ($5 one-time), zip `dist/`,
  submit. Edge Add-ons / Firefox AMO are free.
