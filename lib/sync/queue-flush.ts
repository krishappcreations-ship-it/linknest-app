import type { SyncQueueAdapter } from "./sync-queue";
import type { SyncAdapter } from "./types";
import type { Bookmark, Folder, Tag, Preferences } from "@/types";

const MAX_ATTEMPTS = 5;

export interface FlushDeps {
  queue: SyncQueueAdapter;
  sync: SyncAdapter;
  userId: string;
  onDrop: (count: number) => void;
}

/** Drains the queue FIFO. Per-item skip-on-fail; drops items after MAX_ATTEMPTS. */
export async function flushQueue(deps: FlushDeps): Promise<void> {
  const rows = await deps.queue.list();
  if (rows.length === 0) return;

  let dropped = 0;

  for (const row of rows) {
    try {
      switch (row.entity) {
        case "bookmark":
          await deps.sync.putBookmark(deps.userId, row.payload as Bookmark);
          break;
        case "folder":
          await deps.sync.putFolder(deps.userId, row.payload as Folder);
          break;
        case "tag":
          await deps.sync.putTag(deps.userId, row.payload as Tag);
          break;
        case "preferences":
          await deps.sync.putPreferences(
            deps.userId,
            row.payload as Preferences
          );
          break;
      }
      await deps.queue.remove(row.key);
    } catch (err) {
      const attempts = await deps.queue.incrementAttempts(row.key);
      if (attempts >= MAX_ATTEMPTS) {
        await deps.queue.remove(row.key);
        dropped++;
        console.warn(
          `[queue] dropped after ${MAX_ATTEMPTS} attempts:`,
          row.key,
          err
        );
      }
      // else: skip; will retry on next flush
    }
  }

  if (dropped > 0) deps.onDrop(dropped);
}

export { MAX_ATTEMPTS };
