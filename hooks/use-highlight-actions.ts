"use client";

/**
 * Highlight CRUD bridge (feature 30) — updates the local-only highlights slice
 * and persists each change through the highlightsAdapter. Mirrors the
 * slice+adapter bridging used by the other local-only features.
 */

import { useCallback } from "react";
import { useStore } from "@/store";
import {
  addHighlight,
  updateHighlight,
  removeHighlight,
} from "@/store/slices/highlights-slice";
import { buildHighlight, type HighlightInput } from "@/lib/highlights/build";
import type { Highlight, HighlightId } from "@/types";

export function useHighlightActions() {
  const create = useCallback(
    async (input: HighlightInput): Promise<Highlight> => {
      const h = buildHighlight(input);
      useStore.setState((s) => ({ highlights: addHighlight(s.highlights, h) }));
      await useStore.getState().highlightsAdapter.put(h);
      return h;
    },
    []
  );

  const update = useCallback(
    async (
      id: HighlightId,
      patch: Partial<Pick<Highlight, "color" | "annotation">>
    ): Promise<void> => {
      useStore.setState((s) => ({
        highlights: updateHighlight(s.highlights, id, patch),
      }));
      const updated = useStore.getState().highlights.byId[id];
      if (updated) await useStore.getState().highlightsAdapter.put(updated);
    },
    []
  );

  const remove = useCallback(async (id: HighlightId): Promise<void> => {
    useStore.setState((s) => ({
      highlights: removeHighlight(s.highlights, id),
    }));
    await useStore.getState().highlightsAdapter.remove(id);
  }, []);

  return { create, update, remove };
}
