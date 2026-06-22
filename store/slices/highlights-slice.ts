/**
 * Highlights slice — local-only (feature 30). Pure reducers over a byId map.
 * Persistence (highlightsAdapter) is driven by the hook layer, mirroring how
 * the smart-collections slice separates reducers from the adapter.
 */

import type { Highlight, HighlightId, BookmarkId } from "@/types";

export interface HighlightsState {
  byId: Record<string, Highlight>;
}

export const initialHighlightsState: HighlightsState = { byId: {} };

export function addHighlight(
  state: HighlightsState,
  h: Highlight
): HighlightsState {
  return { byId: { ...state.byId, [h.id]: h } };
}

export function updateHighlight(
  state: HighlightsState,
  id: HighlightId,
  patch: Partial<Pick<Highlight, "color" | "annotation">>
): HighlightsState {
  const prev = state.byId[id];
  if (!prev) return state;
  return { byId: { ...state.byId, [id]: { ...prev, ...patch } } };
}

export function removeHighlight(
  state: HighlightsState,
  id: HighlightId
): HighlightsState {
  if (!state.byId[id]) return state;
  const next = { ...state.byId };
  delete next[id];
  return { byId: next };
}

export function removeHighlightsForBookmark(
  state: HighlightsState,
  bookmarkId: BookmarkId
): HighlightsState {
  const entries = Object.entries(state.byId).filter(
    ([, h]) => h.bookmarkId !== bookmarkId
  );
  if (entries.length === Object.keys(state.byId).length) return state;
  return { byId: Object.fromEntries(entries) };
}

export function selectHighlightsForBookmark(
  state: HighlightsState,
  bookmarkId: BookmarkId
): Highlight[] {
  return Object.values(state.byId)
    .filter((h) => h.bookmarkId === bookmarkId)
    .sort((a, b) => a.createdAt - b.createdAt);
}
