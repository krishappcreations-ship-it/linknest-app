# ADR-010 — AI Features (Claude-backed routes)

**Status:** Accepted (2026-06-18)
**Context features:** F17 (AI tag suggestions), F25 (AI summaries)

## Context

LinkNest uses Claude for two assistive features: tag suggestions (F17) and
article summaries (F25). Both call the Anthropic API, which requires a secret
key that must never reach the client.

## Decision

AI features run through **auth-gated Next.js Node-runtime route handlers**, one
per feature, following a single shared shape:

- `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Config guard: `ANTHROPIC_API_KEY` + Supabase env present, else 500 `config`.
- **Supabase `getUser()` gate** — signed-in only (401 `unauthorized` for anon).
  AI is a signed-in feature; the server holds the key.
- Per-user rate limit via `checkRateLimit("<feature>:${user.id}", …)` (429).
- Zod-validated request; **Claude Haiku** (`claude-haiku-4-5-20251001`) — cheapest
  capable model — with a tight `max_tokens`.
- Model returns JSON; a permissive `extractJson` regex + a strict Zod
  `ResponseSchema` guard against prose-wrapped or malformed output (502 `ai_error`).
- A typed client wrapper (`lib/ai/*-client.ts`) maps every non-ok path to a
  discriminated error union, adding `network` for fetch throws.

## F25 specifics

- Input (`article.textContent`) **truncated to 12k chars** server-side — bounded
  token cost; the lede + early body carry the gist.
- Result **cached** on `Article.summary` (local-only), so each article is
  summarized at most once (re-capture overwrites the Article → clears it).
- On-demand only (reader "Summarize" button) — no auto-summarize, no per-capture
  cost.

## Consequences

- AI never works offline / anon — acceptable; it's an enhancement, not core.
- Cost is bounded by auth + rate limit + truncation + caching.
- New AI features clone this shape (route + client + state-machine UI) rather
  than inventing new patterns.
