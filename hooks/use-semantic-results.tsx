"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { selectBookmarkById } from "@/store/slices/bookmarks-slice";
import { semanticSearch } from "@/lib/search/semantic";
import { embed as defaultEmbed } from "@/lib/search/embedder";
import type { PaletteResultRow } from "@/hooks/use-command-results";
import type { BookmarkId } from "@/types";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LEN = 3;
const TOP_K = 5;

function close() {
  void import("@/store/slices/ui-slice").then(({ closeCommandPalette }) =>
    useStore.setState((s) => ({ ui: closeCommandPalette(s.ui) }))
  );
}

/**
 * Semantic "Related" results for the command palette (feature 28). Debounces
 * the query, embeds it, ranks the in-memory embedding map by cosine, and drops
 * ids already shown by keyword search (`excludeIds`). Each row's value is
 * pinned to the live query so cmdk's lexical filter never hides a semantic hit.
 * `embed` is injectable so tests pass a fake (never load the real model).
 */
export function useSemanticResults(
  query: string,
  excludeIds: Set<string>,
  embed: (text: string) => Promise<number[]> = defaultEmbed
): PaletteResultRow[] {
  const [hits, setHits] = useState<{ id: string }[]>([]);
  const embeddingById = useStore((s) => s.embeddingById);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const ranked = await semanticSearch(trimmed, embeddingById, TOP_K, embed);
      if (!cancelled) setHits(ranked.map((h) => ({ id: h.id })));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, embeddingById, embed]);

  const bookmarks = useStore((s) => s.bookmarks);
  return hits
    .filter((h) => !excludeIds.has(h.id))
    .map((h) => selectBookmarkById(bookmarks, h.id as BookmarkId))
    .filter(
      (b): b is NonNullable<typeof b> => b != null && b.deletedAt === null
    )
    .map((b) => ({
      id: `related:${b.id}`,
      kind: "bookmark" as const,
      label: b.title,
      // Pin to the query so cmdk's lexical filter keeps the semantic hit.
      searchableValue: `${query} related ${b.id}`,
      onSelect: () => {
        window.open(b.url, "_blank", "noopener,noreferrer");
        close();
      },
    }));
}
