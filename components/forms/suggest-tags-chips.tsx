"use client";
import { useState } from "react";
import { useStore } from "@/store";
import {
  selectVisibleTags,
  selectTagByNameInsensitive,
  applyCreateOrGetTag,
} from "@/store/slices/tags-slice";
import { suggestTags, type TagSuggestion } from "@/lib/ai/suggest-tags-client";
import type { TagId } from "@/types";

interface Props {
  url: string;
  title?: string | null;
  description?: string | null;
  currentTagIds: TagId[];
  onApply: (tagId: TagId) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; suggestions: TagSuggestion[] }
  | { kind: "error"; message: string };

export function SuggestTagsChips({
  url,
  title,
  description,
  currentTagIds,
  onApply,
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const tagsState = useStore((s) => s.tags);
  const tagsAdapter = useStore((s) => s.tagsAdapter);

  const handleClick = async () => {
    setStatus({ kind: "loading" });
    const existingTags = selectVisibleTags(tagsState).map((t) => t.name);
    const result = await suggestTags({ url, title, description, existingTags });
    if (!result.ok) {
      const message =
        result.error === "unauthorized"
          ? "Sign in to use AI suggestions."
          : result.error === "network"
            ? "Network error. Try again."
            : "Couldn't suggest tags right now.";
      setStatus({ kind: "error", message });
      return;
    }
    const filtered = result.suggestions.filter((s) => {
      if (s.kind !== "existing") return true;
      const existing = selectTagByNameInsensitive(tagsState, s.name);
      return !existing || !currentTagIds.includes(existing.id);
    });
    setStatus({ kind: "loaded", suggestions: filtered });
  };

  const handleChipClick = async (suggestion: TagSuggestion) => {
    if (suggestion.kind === "existing") {
      const existing = selectTagByNameInsensitive(tagsState, suggestion.name);
      if (existing) onApply(existing.id);
    } else {
      const r = await applyCreateOrGetTag(
        tagsState,
        { name: suggestion.name },
        { adapter: tagsAdapter }
      );
      if (r.kind === "added" || r.kind === "existing") onApply(r.tag.id);
    }
    if (status.kind === "loaded") {
      setStatus({
        kind: "loaded",
        suggestions: status.suggestions.filter(
          (s) => s.name !== suggestion.name
        ),
      });
    }
  };

  if (
    status.kind === "idle" ||
    (status.kind === "loaded" && status.suggestions.length === 0)
  ) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="text-text-muted hover:text-foreground border-border inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-100 ease-out active:scale-[0.97]"
      >
        <SparkleIcon />
        Suggest tags
      </button>
    );
  }

  if (status.kind === "loading") {
    return (
      <div className="text-text-muted inline-flex items-center gap-1.5 text-xs">
        <SparkleIcon />
        Suggesting…
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="text-tone-error hover:text-foreground border-tone-error/40 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors duration-100 ease-out"
        title={status.message}
      >
        Retry
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status.suggestions.map((s) => (
        <button
          key={`${s.kind}:${s.name}`}
          type="button"
          onClick={() => void handleChipClick(s)}
          className="border-border bg-surface-elevated/50 hover:bg-surface-elevated inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors duration-100 ease-out active:scale-[0.97]"
        >
          <span className="text-text-muted">{s.kind === "new" ? "+" : ""}</span>
          {s.name}
        </button>
      ))}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="size-3.5"
      aria-hidden
    >
      <path
        d="M8 2v3M8 11v3M2 8h3M11 8h3M4.5 4.5l2 2M9.5 9.5l2 2M4.5 11.5l2-2M9.5 6.5l2-2"
        strokeLinecap="round"
      />
    </svg>
  );
}
