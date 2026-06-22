/**
 * Bound + normalize article body text for the in-memory full-text corpus
 * (feature 26). 2000 chars caps cmdk's per-keystroke filter cost — the lede +
 * early body carry most search signal. Lowercased to match the lowercased
 * `searchableValue`.
 */
export const INDEX_MAX_CHARS = 2000;

export function truncateForIndex(text: string): string {
  return text.slice(0, INDEX_MAX_CHARS).toLowerCase();
}
