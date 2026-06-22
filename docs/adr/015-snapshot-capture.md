# ADR-015 — Snapshot Capture

**Status:** Accepted (2026-06-19)
**Context feature:** F31 — Snapshot Capture

## Context

The masonry grid looks uneven: bookmarks without an og:image fall back to a plain
favicon/domain placeholder. We want a richer visual snapshot per bookmark — but
the project is hard local-first and private (F23 article capture and F28
embeddings are device-local, no cloud), and adds no heavy infrastructure.

## Decision

- **Text-only generated snapshot — a true page screenshot was rejected.** A real
  screenshot of an arbitrary page needs one of: headless chromium (new infra —
  ruled out), a 3rd-party screenshot API (external call + API key + sends the URL
  off-device — breaks the local-first/private posture), or client-side canvas of
  a cross-origin page (blocked by CORS; `html-to-image` of the captured article
  would also taint the canvas on cross-origin `<img>`). So F31 generates a
  **text-only** card — title + description + a deterministic domain-derived
  gradient, **no `<img>`** — rendered to PNG with `html-to-image`. Fully local,
  private, no network, no infra, no CORS taint.

- **`html-to-image`, not `html2canvas`.** Smaller, SVG-foreignObject based, and
  the generation is a double-`toPng` call (first warms fonts, second is clean).

- **Local-only, no new sync entity.** Snapshots mirror the embeddings storage
  pattern exactly: a `snapshots` Dexie table (v10), `snapshotsAdapter`, and a flat
  in-memory `snapshotByBookmarkId` map — **no slice** (it's a derived id→dataUrl
  map). Never enqueued; `QueueEntity` unchanged; cascade-deleted with the bookmark.

- **Lazy single-flight generation, no worker.** Snapshots are generated in the
  card via `useBookmarkSnapshot` only when the bookmark has no og:image, has no
  snapshot yet, and is on-screen (IntersectionObserver). A module-level
  single-flight gate + `requestIdleCallback` ensures one generation at a time and
  no scroll jank. Cheaper than standing up a 4th background worker; one snapshot
  per image-less bookmark, generated once.

- **Card precedence: og:image → snapshot → placeholder.** The snapshot only fills
  the gap; a real og:image always wins and the placeholder still covers the brief
  window before generation. The snapshot `<img>` reuses the og:image slot's
  aspect/`object-cover`, so there is no layout shift.

- **Built from `Bookmark` fields, not the `Article`.** An image-less bookmark may
  not have a captured article, so the snapshot uses always-present
  `title`/`description`/`domain` (`excerpt == bookmark.description ?? ""`).

## Consequences

- Image-less cards gain a consistent, premium look with zero network and full
  privacy. The snapshot is intentionally a designed card, not a fidelity copy of
  the page — that fidelity is unattainable under the constraints.
- One-time client-side render cost per image-less bookmark; bounded by the
  single-flight gate + idle scheduling. Escape hatch if it bites very large
  libraries: precompute on capture-success instead of on view.
- If a future cloud-render budget appears, a real-page screenshot could be added
  behind the same `snapshotByBookmarkId` slot without touching the card.
- Snapshots are device-local; another device regenerates its own (deterministic
  gradient per domain keeps them visually consistent).
