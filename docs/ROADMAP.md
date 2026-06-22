# LinkNest Roadmap — to 36 Features

**Status:** Milestone complete through **F35**. F32–F35 shipped + merged to `main`.
**F36 (Shared Collections) is deferred to a future update** — it's the multi-user /
RLS epic (~2–3 sessions) and leaves the local-first single-user model, so it ships
on its own later rather than in this milestone. Each remaining feature still gets
its own spec → plan → implement → merge cycle.

**Last updated:** 2026-06-21

---

## Shipped (31 numbered + 2 polish slices)

F01 Save bookmarks · F02 Preview cards · F03 Folders · F04 Tags · F05 Drag &
drop · F06 Command palette · F07 Layout modes · F07.5 polish · F08 Cloud sync ·
F08.5 polish · F09 Multi-select drag · F10 Offline write queue · F11
Folder/tag tombstones · F12 Account UX · F13 Realtime sync · F14 Sync queue UI ·
F15 Tombstone GC · F16 Realtime DELETE · F17 AI tag suggestions · F18 Sync-status
dot · F19 Tone tokens · F21 Mobile UX · F22 Read-later · F23 Article capture ·
F24 Reader mode · F25 AI summaries · F26 Full-text search · F27 Smart
collections · F28 Semantic search · F29 Duplicate & similar · F30 Notes &
highlights · F31 Snapshot capture.

> Gap at F20 (Browser Extension — spec'd, deferred). All 8 PROJECT_SPEC MVP-core
> features are done.

---

## Shipped this milestone: F32 ✅ · F33 ✅ · F34 ✅ · F35 ✅ — Deferred: F36 ⏸

> F32 Import/Export, F33 PWA, F34 Link health, F35 Browser extension are merged to
> `main`. F36 (Shared Collections) is **deferred to a future update**. Original
> plan below (kept for reference).

## Original plan (5 features → F32–F36)

Sequenced by escalating complexity/risk: data portability first, the offline
platform layer next, then maintenance, then the two multi-codebase/backend epics
last. Each is a proposal — swap freely before its brainstorm.

### F32 — Import / Export (data portability)

**Why:** Onboarding's biggest friction is getting existing bookmarks _in_, and
users expect their data _out_. Highest immediate value; fully local; no new infra.
**Scope (sketch):** Import the Netscape bookmarks HTML format (browser/Raindrop/
Pocket export) + a LinkNest JSON; map folders→folders, tags→tags, dedup via the
existing F29 canonical-URL key. Export to JSON + Netscape HTML. Drag-drop or file
picker; progress + summary toast; reuse F10 optimistic write path.
**Complexity:** Medium. ~6 slices. Local-first, in-pattern.
**Risks:** Large-file parsing on the main thread (mitigate: chunk + the existing
single-flight/idle pattern); malformed HTML (tolerant parser).

### F33 — PWA / Installable Offline App

**Why:** PROJECT*SPEC calls for "offline-ready architecture" (already true for
data via Dexie/F10). F33 makes the \_app shell* installable + offline: manifest,
icons, service worker caching the static shell, "Add to Home Screen", offline
fallback. Leverages work already done; strong mobile/premium signal.
**Scope (sketch):** `manifest.webmanifest` + icon set, a service worker (or
`next-pwa`-style precache of the app shell), offline route fallback, install
prompt affordance, update-available toast. No data changes — Dexie already
offline.
**Complexity:** Medium. ~5 slices. Mostly config + a small UI affordance.
**Risks:** SW caching correctness vs Next static assets; must not break the F31
`html-to-image` / worker code paths. Browser-smoke gate required (see lessons).

### F34 — Link Health Checker (dead-link detection)

**Why:** Bookmark rot is the #1 long-term pain of any bookmark manager. Flags
dead/redirected links so the library stays trustworthy. Distinct from every
shipped feature.
**Scope (sketch):** A server route that HEAD/GET-checks a URL (reusing the F02
preview fetch + F08 rate-limit infra) returning `ok | redirected(newUrl) |
dead`; a lazy/idle background checker (single-flight gate, F31 pattern) that
stamps a `linkStatus` + `checkedAt` on bookmarks; a sidebar "Broken links" pseudo
-filter (F22/F27 pattern) + a card badge; one-click "update to redirect target".
**Complexity:** Medium-high. ~7 slices. Adds a synced field (rides F11) + a route.
**Risks:** CORS/blocked HEAD on many hosts (treat ambiguous as "unknown", never
false-"dead"); rate limits; privacy (server-side fetch already exists for F02, so
no new posture).

### F35 — Browser Extension (resurrect F20)

**Why:** One-click save from any page — the canonical premium bookmark feature.
**Scope (sketch):** Manifest V3 extension (Chrome/Edge): popup + context-menu
"Save to LinkNest", capture current tab URL/title/selection, POST to the existing
capture/add API with the user's session. Separate `extension/` workspace + build.
**Complexity:** High. Separate codebase + build/test pipeline + store packaging.
Multi-session. Re-validate the 2026-06-05 spec against current API surface first.
**Risks:** Auth from extension → app session; MV3 service-worker constraints;
two build systems.

### F36 — Shared Collections (collaboration) — ⏸ DEFERRED (future update)

> **Deferred** out of this milestone (decided 2026-06-21). It's the multi-user/RLS
> epic that leaves the local-first single-user model — ships on its own later, with
> a dedicated data-model ADR + `/security-review`. Recommended first slice when
> resumed: a **read-only share link (v1)** before any collaborative editing.

**Why:** The last PROJECT_SPEC premium item; turns LinkNest multi-player.
**Scope (sketch):** Share a collection via token/link (read-only first), then
invited collaborators; Supabase RLS for shared rows; realtime presence reuses
F13. Breaks the single-user local-first assumption — needs a deliberate data-model
ADR before any code.
**Complexity:** Very high (epic, multiple PRs). Backend-heavy; auth + permissions

- realtime + conflict handling.
  **Risks:** Largest scope; security/permissions surface; local-first model
  tension. Do last; gate behind a dedicated architecture review.

---

## Suggested execution order

`F32 → F33 → F34 → F35 → F36` (ascending complexity; ship value early, defer the
two epics). F32–F34 are single-session-ish local-first slices; F35–F36 are
multi-session.

## Per-feature gate (unchanged)

Every feature: spec → plan → vertical-slice implementation → typecheck + build +
full test suite + **browser smoke** (Playwright `/` load, assert no console errors
/ error boundary) → PR → merge.
