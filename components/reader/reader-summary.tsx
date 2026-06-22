"use client";

import { useState } from "react";
import { useStore } from "@/store";
import { summarize } from "@/lib/ai/summarize-client";
import { persistSummary } from "@/lib/ai/persist-summary";
import type { Article, BookmarkId } from "@/types";

const MODEL = "claude-haiku-4-5-20251001";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; tldr: string; keyPoints: string[] }
  | { kind: "error"; message: string };

export function ReaderSummary({
  bookmarkId,
  article,
}: {
  bookmarkId: BookmarkId;
  article: Article;
}) {
  const [status, setStatus] = useState<Status>(
    article.summary
      ? {
          kind: "loaded",
          tldr: article.summary.tldr,
          keyPoints: article.summary.keyPoints,
        }
      : { kind: "idle" }
  );

  const handleSummarize = async () => {
    setStatus({ kind: "loading" });
    const result = await summarize({
      text: article.textContent,
      title: article.title,
    });
    if (!result.ok) {
      const message =
        result.error === "unauthorized"
          ? "Sign in to summarize."
          : result.error === "network"
            ? "Network error. Try again."
            : "Couldn’t summarize right now.";
      setStatus({ kind: "error", message });
      return;
    }
    await persistSummary(useStore.getState().articlesAdapter, bookmarkId, {
      tldr: result.tldr,
      keyPoints: result.keyPoints,
      model: MODEL,
      summarizedAt: Date.now(),
    });
    setStatus({
      kind: "loaded",
      tldr: result.tldr,
      keyPoints: result.keyPoints,
    });
  };

  if (status.kind === "loaded") {
    return (
      <div className="border-border bg-surface mb-8 rounded-lg border p-4">
        <p className="text-foreground-subtle mb-2 text-[11px] font-medium tracking-wider uppercase">
          Summary
        </p>
        <p className="text-foreground text-sm leading-relaxed">{status.tldr}</p>
        {status.keyPoints.length > 0 && (
          <ul className="text-foreground-muted mt-3 space-y-1.5 text-sm">
            {status.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-foreground-subtle">
                  •
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => void handleSummarize()}
        disabled={status.kind === "loading"}
        className="border-border bg-surface text-foreground-muted hover:bg-surface-hover hover:text-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors active:scale-[0.97] disabled:opacity-60"
      >
        <span aria-hidden>✦</span>
        {status.kind === "loading" ? "Summarizing…" : "Summarize"}
      </button>
      {status.kind === "error" && (
        <p className="text-tone-error mt-2 text-xs">{status.message}</p>
      )}
    </div>
  );
}
