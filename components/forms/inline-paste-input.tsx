"use client";

import { useState } from "react";
import { useBookmarks } from "@/hooks/use-bookmarks";

/**
 * InlinePasteInput — L2 + E1.
 *
 * Sits above the bookmark grid. Enter saves with URL only — bookmark
 * commits to the store immediately with previewStatus="pending" and
 * the skeleton card appears in the grid until feature 02 wires the
 * preview pipeline.
 *
 * Duplicate flow is handled by useBookmarks (focus + toast); this
 * input just clears on success/duplicate.
 */
export function InlinePasteInput() {
  const { add } = useBookmarks();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      const r = await add({ url: trimmed });
      if (!r.ok && r.reason === "error") {
        setError(r.error?.message ?? "Could not save");
        return;
      }
      setUrl("");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-surface mb-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
        error ? "border-tag-rose/50" : "border-border"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="text-foreground-subtle size-3.5 shrink-0"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <input
        type="text"
        inputMode="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Paste a URL and press Enter"
        disabled={pending}
        aria-label="Paste a URL to add a bookmark"
        className="text-foreground placeholder:text-foreground-subtle min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      {pending ? (
        <span
          aria-hidden
          className="border-border-strong border-t-accent-cyan size-3 animate-spin rounded-full border-[1.5px]"
        />
      ) : error ? (
        <span role="alert" className="text-tag-rose text-[11px]">
          {error}
        </span>
      ) : (
        <kbd className="border-border bg-surface-elevated text-foreground-subtle rounded border px-1.5 py-px font-mono text-[11px]">
          enter
        </kbd>
      )}
    </form>
  );
}
