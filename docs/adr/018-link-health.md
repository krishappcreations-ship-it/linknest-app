# ADR-018 — Link Health Checker

**Status:** Accepted (2026-06-20)
**Context feature:** F34 — Link Health Checker

## Context

Bookmark rot is the long-term pain of any bookmark manager — links die or move
and the library silently loses trust. We want to detect dead/redirected
bookmarks. Constraints: reuse the existing fetch/rate-limit infra, respect the
local-first/private posture, and don't flood servers.

## Decision

- **Manual trigger only.** A user-initiated "Check link health" command runs the
  pass; nothing fires automatically. Avoids surprise background traffic, privacy
  concerns, and rate-limit pressure. (Auto-on-view was rejected.)

- **Synced status fields.** `linkStatus` / `linkCheckedAt` / `linkRedirectUrl`
  are additive synced `Bookmark` fields (migration `0006`, LWW, the F30-note
  pattern) — a dead link found on one device shows broken everywhere. They are
  **optional** in the schema (like `note`) to avoid touching every Bookmark
  fixture; `buildBookmark`/`bookmarkFromRow` set defaults.

- **GET, never false-dead.** `checkLink` reuses F02's SSRF-guarded GET and reads
  only status + final URL (not the body). Pure `classifyHealth` maps: 2xx → ok;
  2xx + meaningful redirect → redirected; 404/410/4xx → broken; **401/403/405/429
  → ok** (alive, just restricted); 5xx/network/timeout/SSRF → unknown. Only
  definitive deadness is "broken". HEAD was rejected (servers reject/lie about it).

- **Canonical-redirect filter.** `res.redirected` is true for trivial redirects
  (http→https, trailing-slash) — flagging those "Moved" would be noise. A redirect
  counts only when `canonicalizeUrl(final) !== canonicalizeUrl(original)` (reuses
  F29).

- **Injected-deps runner.** `runLinkCheck(bookmarks, deps)` takes `checkUrl` +
  `updateBookmark` as deps → unit-tested with fakes, no fetch/store. Sequential
  (respects the route rate-limit; this app's scale is dozens). The command wires
  real deps via `postLinkCheck` + `getUseBookmarksApi().update`; a module-level
  single-flight guard prevents a double-run.

- **Reuse the read-state filter pattern.** A `ui.linkStatusFilter` + sidebar
  "Broken links" pseudo-row + a grid branch + `selectBrokenCount` — mirrors F22's
  read-state filter (mutually exclusive with the other filters). The sidebar row
  count selector returns a `.length` primitive (the F31 stable-selector rule).

## Consequences

- Users get a trustworthy library: broken links surface with a badge + a filter,
  and moved links fix in one click.
- CORS/geo/firewall differences can yield false "unknown" on some hosts — by
  design we never escalate ambiguity to "broken".
- The route has its own rate limit (`60/min`); a very large library checked
  sequentially is slow but bounded — acceptable for a manual action.
- Privacy: the server already fetches arbitrary bookmark URLs for F02 previews,
  so link-check adds no new posture.
- **Apply migration `0006_link_health.sql`** to Supabase before relying on synced
  link status in production.
