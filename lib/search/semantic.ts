/**
 * Semantic search (feature 28) — embed the query, then rank the in-memory
 * embedding map by cosine similarity. `embed` is injected so tests never load
 * the real Transformers.js model. Pure given its inputs.
 */

import { cosineTopK } from "@/lib/search/cosine";

export interface SemanticHit {
  id: string;
  score: number;
}

/**
 * Returns the top-k bookmark ids by cosine similarity to `query`. Empty query
 * or empty corpus → []. A `minScore` floor filters weak matches (default 0.2,
 * tuned for all-MiniLM-L6-v2 normalized vectors).
 */
export async function semanticSearch(
  query: string,
  byId: Record<string, number[]>,
  k: number,
  embed: (text: string) => Promise<number[]>,
  minScore = 0.2
): Promise<SemanticHit[]> {
  const trimmed = query.trim();
  if (!trimmed || Object.keys(byId).length === 0) return [];
  const queryVec = await embed(trimmed);
  return cosineTopK(queryVec, byId, k).filter((h) => h.score >= minScore);
}
