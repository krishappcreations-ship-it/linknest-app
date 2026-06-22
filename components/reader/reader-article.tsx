"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import createDOMPurify from "dompurify";
import { usePreferences } from "@/hooks/use-preferences";
import { useStore } from "@/store";
import { selectHighlightsForBookmark } from "@/store/slices/highlights-slice";
import { paintHighlights } from "@/lib/highlights/paint";
import { createAnchor } from "@/lib/highlights/anchor";
import { useHighlightActions } from "@/hooks/use-highlight-actions";
import { HighlightToolbar, type ToolbarPosition } from "./highlight-toolbar";
import { HighlightPopover } from "./highlight-popover";
import {
  asBookmarkId,
  type Article,
  type Highlight,
  type HighlightColor,
} from "@/types";

/**
 * Re-sanitize captured HTML in the browser before render (defense in depth —
 * capture already sanitized server-side). Same allowlist as the capture path.
 */
export function sanitizeArticleHtml(html: string): string {
  const purify = createDOMPurify(window);
  return purify.sanitize(html, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ReaderArticle({
  article,
  onUnresolved,
}: {
  article: Article;
  onUnresolved?: (unresolved: Highlight[]) => void;
}) {
  const { readerFontSize, readerFontFamily, readerWidth } = usePreferences();
  const contentRef = useRef<HTMLDivElement>(null);
  const highlightsState = useStore((s) => s.highlights);
  const highlights = useMemo(
    () =>
      selectHighlightsForBookmark(
        highlightsState,
        asBookmarkId(article.bookmarkId)
      ),
    [highlightsState, article.bookmarkId]
  );

  const sanitizedHtml = useMemo(
    () => sanitizeArticleHtml(article.html),
    [article.html]
  );

  // Paint after the article HTML mounts and whenever highlights/html change.
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const unresolved = paintHighlights(root, highlights);
    onUnresolved?.(unresolved);
  }, [sanitizedHtml, highlights, onUnresolved]);

  const { create } = useHighlightActions();
  const [toolbarPos, setToolbarPos] = useState<ToolbarPosition | null>(null);
  const pendingAnchor = useRef<{
    quote: string;
    prefix: string;
    suffix: string;
  } | null>(null);

  // Detect a non-empty selection inside the article root → surface the toolbar.
  const onSelect = useCallback(() => {
    const root = contentRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) {
      setToolbarPos(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (
      !root.contains(range.commonAncestorContainer) ||
      !range.toString().trim()
    ) {
      setToolbarPos(null);
      return;
    }
    pendingAnchor.current = createAnchor(range, root);
    const rect = range.getBoundingClientRect();
    setToolbarPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [onSelect]);

  const onPick = useCallback(
    (color: HighlightColor) => {
      const anchor = pendingAnchor.current;
      if (!anchor) return;
      void create({
        bookmarkId: asBookmarkId(article.bookmarkId),
        quote: anchor.quote,
        prefix: anchor.prefix,
        suffix: anchor.suffix,
        color,
      });
      pendingAnchor.current = null;
      setToolbarPos(null);
      window.getSelection()?.removeAllRanges();
    },
    [create, article.bookmarkId]
  );

  // Click an existing mark → open the edit popover anchored to it.
  const [editing, setEditing] = useState<{
    id: string;
    pos: ToolbarPosition;
  } | null>(null);
  const onContentClick = useCallback((e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest("mark[data-hl-id]");
    if (!mark) {
      setEditing(null);
      return;
    }
    const id = mark.getAttribute("data-hl-id");
    if (!id) return;
    const rect = mark.getBoundingClientRect();
    setEditing({
      id,
      pos: { top: rect.top - 8, left: rect.left + rect.width / 2 },
    });
  }, []);

  const published = formatDate(article.publishedTime);
  const meta = [
    article.byline,
    article.siteName,
    `${article.readingMinutes} min read`,
    published,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <article
        className="reader-prose mx-auto"
        data-size={readerFontSize}
        data-family={readerFontFamily}
        data-width={readerWidth}
      >
        <header className="reader-header">
          <h1>{article.title ?? "Untitled"}</h1>
          {meta && <p className="reader-meta">{meta}</p>}
        </header>
        <div
          ref={contentRef}
          onClick={onContentClick}
          // Sanitized via DOMPurify (sanitizedHtml memo).
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      </article>
      <HighlightToolbar position={toolbarPos} onPick={onPick} />
      <HighlightPopover
        highlightId={editing?.id ?? null}
        position={editing?.pos ?? null}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
