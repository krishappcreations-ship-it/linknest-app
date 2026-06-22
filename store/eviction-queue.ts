/**
 * Singleton eviction queue for soft-deleted bookmarks.
 *
 * Lives outside React lifecycle — unmounting the toast component does NOT
 * drop the pending hard-delete. Public API is intentionally tiny:
 * schedule / cancel / flush / has / size / clear.
 */

import type { BookmarkId } from "@/types";

type TimerHandle = ReturnType<typeof setTimeout>;

interface PendingEviction {
  bookmarkId: BookmarkId;
  scheduledAt: number;
  fireAt: number;
  timer: TimerHandle;
}

const pending = new Map<BookmarkId, PendingEviction>();

export interface EvictionQueue {
  /** Schedule onFire to run after delayMs. Replaces any prior timer for same id. */
  schedule(
    id: BookmarkId,
    delayMs: number,
    onFire: () => void | Promise<void>
  ): void;
  /** Cancel pending timer. Returns whether one was present. */
  cancel(id: BookmarkId): boolean;
  /** Cancel WITHOUT firing. Reserved for beforeunload handlers (deferred). */
  flush(id: BookmarkId): Promise<void>;
  has(id: BookmarkId): boolean;
  size(): number;
  /** Test-only: cancel all timers and empty the map. */
  clear(): void;
}

export const evictionQueue: EvictionQueue = {
  schedule(id, delayMs, onFire) {
    const existing = pending.get(id);
    if (existing) clearTimeout(existing.timer);

    const fireAt = Date.now() + delayMs;
    const timer = setTimeout(async () => {
      pending.delete(id);
      try {
        await onFire();
      } catch (err) {
        // Eviction callback failure must surface — caller is responsible
        // for resilience inside the callback.
        // eslint-disable-next-line no-console
        console.error("[eviction-queue] callback failed for", id, err);
      }
    }, delayMs);

    pending.set(id, { bookmarkId: id, scheduledAt: Date.now(), fireAt, timer });
  },
  cancel(id) {
    const existing = pending.get(id);
    if (!existing) return false;
    clearTimeout(existing.timer);
    pending.delete(id);
    return true;
  },
  async flush(id) {
    const existing = pending.get(id);
    if (!existing) return;
    clearTimeout(existing.timer);
    pending.delete(id);
  },
  has(id) {
    return pending.has(id);
  },
  size() {
    return pending.size;
  },
  clear() {
    for (const p of pending.values()) clearTimeout(p.timer);
    pending.clear();
  },
};
