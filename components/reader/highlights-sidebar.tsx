"use client";

import { useMemo } from "react";
import { useStore } from "@/store";
import { selectHighlightsForBookmark } from "@/store/slices/highlights-slice";
import { asBookmarkId, type BookmarkId, type Highlight } from "@/types";

const DOT: Record<string, string> = {
  yellow: "bg-[rgba(250,204,21,0.8)]",
  green: "bg-[rgba(74,222,128,0.8)]",
  blue: "bg-[rgba(96,165,250,0.8)]",
  pink: "bg-[rgba(244,114,182,0.8)]",
};

function scrollToMark(id: string): void {
  const mark = document.querySelector<HTMLElement>(`mark[data-hl-id="${id}"]`);
  if (!mark) return;
  mark.scrollIntoView({ behavior: "smooth", block: "center" });
  mark.classList.add("is-flash");
  setTimeout(() => mark.classList.remove("is-flash"), 700);
}

function Row({ h, dim }: { h: Highlight; dim?: boolean }) {
  return (
    <button
      type="button"
      onClick={dim ? undefined : () => scrollToMark(h.id)}
      className={`flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        dim ? "opacity-50" : "hover:bg-surface-hover"
      }`}
    >
      <span
        className={`mt-1 size-2 shrink-0 rounded-full ${DOT[h.color] ?? ""}`}
      />
      <span className="min-w-0 flex-1">
        <span className="text-foreground line-clamp-2">{h.quote}</span>
        {h.annotation && (
          <span className="text-foreground-muted mt-0.5 block text-xs">
            {h.annotation}
          </span>
        )}
      </span>
    </button>
  );
}

export function HighlightsSidebar({
  bookmarkId,
  unresolved,
}: {
  bookmarkId: BookmarkId;
  unresolved: Highlight[];
}) {
  const highlightsState = useStore((s) => s.highlights);
  const all = useMemo(
    () =>
      selectHighlightsForBookmark(highlightsState, asBookmarkId(bookmarkId)),
    [highlightsState, bookmarkId]
  );
  const unresolvedIds = new Set(unresolved.map((u) => u.id));
  const resolved = all.filter((h) => !unresolvedIds.has(h.id));

  return (
    <aside className="border-border bg-surface w-72 shrink-0 space-y-3 rounded-lg border p-3">
      <h2 className="text-foreground text-sm font-medium">Highlights</h2>
      {all.length === 0 ? (
        <p className="text-foreground-subtle text-sm">
          Select text in the article to highlight it.
        </p>
      ) : (
        <div className="space-y-0.5">
          {resolved.map((h) => (
            <Row key={h.id} h={h} />
          ))}
        </div>
      )}
      {unresolved.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-foreground-subtle px-2 text-xs">
            Not found in current article
          </p>
          {unresolved.map((h) => (
            <Row key={h.id} h={h} dim />
          ))}
        </div>
      )}
    </aside>
  );
}
