# ADR-012 — AI Semantic Search

**Status:** Accepted (2026-06-18)
**Context feature:** F28 — AI Semantic Search

## Context

Keyword search (F26) misses meaning-based matches — "offline-first sync" should
surface a "CRDTs explained" bookmark even with no shared words. The roadmap
called for vector embeddings + hybrid ranking, originally scoped to Supabase
pgvector + a cloud embedding API. Anthropic has no embeddings API, so the cloud
path meant adding a second vendor (OpenAI/Voyage/Cohere), a pgvector migration,
RLS, and a per-bookmark API cost.

## Decision

- **Local embeddings, no cloud.** Embeddings are computed in-browser via
  Transformers.js (`@xenova/transformers`, `Xenova/all-MiniLM-L6-v2`, 384-dim,
  L2-normalized) in `lib/search/embedder.ts` (lazy dynamic import; client-only).
  Zero API cost, zero new vendor, works offline, no PII leaves the device.
  Trade-off: first query downloads the model (~25MB, cached by the browser); the
  embed worker runs at concurrency 1 since the model is the bottleneck.
- **No Bookmark schema change.** Embed state is tracked by **presence in the
  `embeddings` table**, not a field on `Bookmark` — deliberately avoiding the
  required-field literal cascade across test factories + dev preview. The
  `embeddings` table (Dexie **v8**, additive, keyed by `bookmarkId`) stores
  `{ bookmarkId, vector, model, embeddedAt }`.
- **Third worker, cloned not abstracted.** `store/embed-worker.ts` clones the
  preview/capture worker shape (queue/inflight/pump/process, singleton
  mount/get, injectable `embed`, ghost-write guard). Per the roadmap's
  cross-cutting note, a generic `createEnrichmentWorker` is **not** extracted —
  three concrete clones, but each is ~110 lines and the variation (status gate,
  cache, retry) outweighs the shared skeleton. YAGNI.
- **In-memory vector map.** `RootState.embeddingById` mirrors the table, filled
  on hydrate / capture success / dropped on evict — identical lifecycle to the
  F26 `articleText` corpus and F27 `articleReadingMinutes` map. Cosine search
  runs over this map (no async DB reads on the hot path).
- **Enqueue twice.** `enqueue` on add embeds title+description immediately;
  capture success re-enqueues so the vector upgrades to include the article
  body. `enqueue` bypasses the `needsEmbedding` check (which `kick` respects),
  so re-embedding a captured article is forced even when a vector exists.
- **Hybrid, keyword-first.** The palette shows keyword hits in "Bookmarks" and
  semantic hits in a separate **"Related"** group below it
  (`hooks/use-semantic-results.ts`). Ids already in the keyword group are
  excluded. cmdk's lexical filter stays on; each Related row's `value` is pinned
  to the live query so the semantic hit is never filtered out. Debounced 250ms,
  3-char floor, top-5, `minScore` 0.2.

## Consequences

- Embeddings are device-local; cross-device vector sync is a clean follow-up
  (the table is already there). F29 (Duplicate & Similar) reuses
  `embeddingById` + `cosineSim` directly.
- The model download is a one-time per-device cost on first semantic query; the
  "Related" group simply stays empty until vectors exist, so there is no broken
  state — it degrades to keyword-only.
- A larger library means a longer initial embed sweep (concurrency 1). Acceptable
  at this app's scale; a Web Worker / WASM-thread move is the escape hatch.
- Tests never load the real model: `embed` is injected everywhere (worker,
  `semanticSearch`, the hook), and the store/index test pre-mounts a stub embed
  worker so hydrate's kick can't trigger a model download in jsdom.
