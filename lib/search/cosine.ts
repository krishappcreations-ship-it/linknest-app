/**
 * Cosine similarity over embedding vectors (feature 28). Vectors are
 * L2-normalized at embed time, so cosine === dot product.
 */

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot;
}

export function cosineTopK(
  query: number[],
  byId: Record<string, number[]>,
  k: number
): { id: string; score: number }[] {
  const scored = Object.entries(byId).map(([id, vec]) => ({
    id,
    score: cosineSim(query, vec),
  }));
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, k);
}
