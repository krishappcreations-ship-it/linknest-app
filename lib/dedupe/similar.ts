/**
 * Find bookmarks whose embedding is closest to a source bookmark's (feature
 * 29). Pure over the F28 `embeddingById` map; the caller filters out
 * tombstoned / URL-duplicate ids. Returns [] if the source has no vector.
 */

import { cosineSim } from "@/lib/search/cosine";

export interface SimilarHit {
  id: string;
  score: number;
}

export function findSimilar(
  id: string,
  byId: Record<string, number[]>,
  opts: { k?: number; minScore?: number } = {}
): SimilarHit[] {
  const k = opts.k ?? 5;
  const minScore = opts.minScore ?? 0.8;
  const source = byId[id];
  if (!source) return [];
  return Object.entries(byId)
    .filter(([other]) => other !== id)
    .map(([other, vec]) => ({ id: other, score: cosineSim(source, vec) }))
    .filter((h) => h.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}
