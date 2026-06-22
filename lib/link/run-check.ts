/**
 * Link-check runner (feature 34). Dependency-injected (unit-tested with fakes).
 * Sequential — respects the route rate-limit; expected scale is dozens.
 */

import type { Bookmark, BookmarkId, LinkPatch } from "@/types";
import type { LinkCheckResult } from "./check-link";

export interface LinkCheckSummary {
  ok: number;
  broken: number;
  redirected: number;
  unknown: number;
}

export interface RunCheckDeps {
  checkUrl: (url: string) => Promise<LinkCheckResult>;
  updateBookmark: (id: BookmarkId, patch: LinkPatch) => Promise<void>;
  now?: () => number;
}

export async function runLinkCheck(
  bookmarks: Bookmark[],
  deps: RunCheckDeps,
  onProgress?: (done: number, total: number) => void
): Promise<LinkCheckSummary> {
  const now = deps.now ?? Date.now;
  const targets = bookmarks.filter((b) => b.deletedAt === null);
  const summary: LinkCheckSummary = {
    ok: 0,
    broken: 0,
    redirected: 0,
    unknown: 0,
  };
  for (let i = 0; i < targets.length; i++) {
    const b = targets[i]!;
    const r = await deps.checkUrl(b.url);
    await deps.updateBookmark(b.id, {
      linkStatus: r.status,
      linkCheckedAt: now(),
      linkRedirectUrl:
        r.status === "redirected" ? (r.redirectUrl ?? null) : null,
    });
    summary[r.status]++;
    onProgress?.(i + 1, targets.length);
  }
  return summary;
}
