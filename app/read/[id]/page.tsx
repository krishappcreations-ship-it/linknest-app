"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { asBookmarkId } from "@/types";
import { useReaderData } from "@/components/reader/use-reader-data";
import { ReaderArticle } from "@/components/reader/reader-article";
import { ReaderSummary } from "@/components/reader/reader-summary";
import { ReaderToolbar } from "@/components/reader/reader-toolbar";
import { HighlightsSidebar } from "@/components/reader/highlights-sidebar";
import { useReadingProgress } from "@/components/reader/use-reading-progress";
import { useBookmarks } from "@/hooks/use-bookmarks";
import type { Bookmark, Article, Highlight } from "@/types";

function CenteredPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6">
      <div className="max-w-sm space-y-4 text-center">{children}</div>
    </div>
  );
}

function ReaderReady({
  bookmark,
  article,
}: {
  bookmark: Bookmark;
  article: Article;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progress = useReadingProgress(containerRef, bookmark);
  const { update } = useBookmarks();
  const [showHighlights, setShowHighlights] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [unresolved, setUnresolved] = useState<Highlight[]>([]);

  return (
    <div ref={containerRef} className="h-[100dvh] overflow-y-auto">
      <ReaderToolbar
        progress={progress}
        onToggleHighlights={() => setShowHighlights((v) => !v)}
        onToggleNote={() => setShowNote((v) => !v)}
        noteActive={showNote}
      />
      <main className="px-4 py-10">
        <div className="mx-auto flex max-w-[60rem] justify-center gap-6">
          <div className="min-w-0 flex-1">
            <div className="mx-auto max-w-2xl">
              <ReaderSummary bookmarkId={bookmark.id} article={article} />
              {showNote && (
                <textarea
                  defaultValue={bookmark.note ?? ""}
                  onBlur={(e) =>
                    void update(bookmark.id, {
                      note: e.target.value.trim() || null,
                    })
                  }
                  placeholder="Add a note for this bookmark…"
                  rows={3}
                  className="border-border bg-surface text-foreground placeholder:text-foreground-subtle focus:border-border-strong mb-6 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
                />
              )}
            </div>
            <ReaderArticle article={article} onUnresolved={setUnresolved} />
          </div>
          {showHighlights && (
            <HighlightsSidebar
              bookmarkId={bookmark.id}
              unresolved={unresolved}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function ReaderPage() {
  const params = useParams<{ id: string }>();
  const id = asBookmarkId(params.id);
  const { status, bookmark, article } = useReaderData(id);
  const { recaptureArticle } = useBookmarks();

  if (status === "loading") {
    return (
      <CenteredPanel>
        <p className="text-foreground-muted text-sm">Loading…</p>
      </CenteredPanel>
    );
  }

  if (status === "missing") {
    return (
      <CenteredPanel>
        <h1 className="text-foreground text-lg font-medium">
          Bookmark not found
        </h1>
        <Link href="/" className="text-accent-blue text-sm hover:underline">
          ← Back to LinkNest
        </Link>
      </CenteredPanel>
    );
  }

  if (status === "not-captured" && bookmark) {
    return (
      <CenteredPanel>
        <h1 className="text-foreground text-lg font-medium">
          No readable snapshot yet
        </h1>
        <p className="text-foreground-muted text-sm">
          This page hasn’t been captured for reading.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void recaptureArticle(bookmark.id)}
            className="bg-surface-elevated text-foreground hover:bg-surface-hover rounded-md px-3 py-1.5 text-sm transition-colors active:scale-[0.97]"
          >
            Capture article
          </button>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue text-sm hover:underline"
          >
            Open original ↗
          </a>
        </div>
        <Link
          href="/"
          className="text-foreground-subtle block text-xs hover:underline"
        >
          ← Back
        </Link>
      </CenteredPanel>
    );
  }

  if (bookmark && article) {
    return <ReaderReady bookmark={bookmark} article={article} />;
  }
  return null;
}
