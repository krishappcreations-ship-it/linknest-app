"use client";

import { useState } from "react";
import { ReloadIcon } from "@radix-ui/react-icons";
import { useBookmarks } from "@/hooks/use-bookmarks";

/**
 * Re-fetches every bookmark with no preview image — heals cards saved before a
 * preview improvement (e.g. the screenshot fallback) that still hold a stale
 * null. One click; the preview worker + toast handle the rest.
 */
export function RefreshPreviewsButton() {
  const { refreshMissingPreviews } = useBookmarks();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await refreshMissingPreviews();
        } finally {
          setBusy(false);
        }
      }}
      className="text-foreground-muted hover:bg-surface-hover hover:text-foreground flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors active:scale-[0.99] disabled:opacity-50"
    >
      <ReloadIcon className={`size-4 ${busy ? "animate-spin" : ""}`} />
      Refresh previews
    </button>
  );
}
