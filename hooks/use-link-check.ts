"use client";

import { useStore } from "@/store";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import { pushToast } from "@/store/slices/ui-slice";
import { runLinkCheck } from "@/lib/link/run-check";
import type { LinkCheckResult } from "@/lib/link/check-link";
import { useBookmarks, getUseBookmarksApi } from "@/hooks/use-bookmarks";

export async function postLinkCheck(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<LinkCheckResult> {
  try {
    const res = await fetchImpl("/api/link-check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) return { status: "unknown" };
    return (await res.json()) as LinkCheckResult;
  } catch {
    return { status: "unknown" };
  }
}

// Module-level single-flight: one link-check pass at a time.
let running = false;

type UpdateFn = Parameters<typeof runLinkCheck>[1]["updateBookmark"];

async function runPass(update: UpdateFn): Promise<void> {
  if (running) return;
  running = true;
  const bookmarks = selectVisibleBookmarks(useStore.getState().bookmarks);
  useStore.setState((s) => ({
    ui: pushToast(s.ui, {
      tone: "info",
      title: "Checking links…",
      description: `0 / ${bookmarks.length}`,
      ttlMs: 60_000,
    }),
  }));
  try {
    const summary = await runLinkCheck(bookmarks, {
      checkUrl: (url) => postLinkCheck(url),
      updateBookmark: update,
    });
    useStore.setState((s) => ({
      ui: pushToast(s.ui, {
        tone: summary.broken > 0 ? "warn" : "success",
        title: "Link check complete",
        description: `${summary.ok} ok · ${summary.broken} broken · ${summary.redirected} moved`,
        ttlMs: 6000,
      }),
    }));
  } finally {
    running = false;
  }
}

/** Non-hook entry for the command palette action. */
export function triggerLinkCheck(): void {
  const api = getUseBookmarksApi();
  void runPass((id, patch) => api.update(id, patch));
}

export function useLinkCheck() {
  const { update } = useBookmarks();
  return { run: () => runPass((id, patch) => update(id, patch)) };
}
