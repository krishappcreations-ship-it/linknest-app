/**
 * Embed worker — feature 28. Event-driven background embedder; sibling of the
 * preview/capture workers but simpler (no cache, no transient/permanent retry —
 * a failed embed is just retried on the next kick). Concurrency 1 (the model is
 * the bottleneck). Writes vectors to the embeddings table + the in-memory
 * `embeddingById` map. `embed` is injected (tests pass a fake; production wires
 * the Transformers.js embedder).
 */

import { useStore } from "@/store";
import { selectBookmarkById } from "@/store/slices/bookmarks-slice";
import { truncateForIndex } from "@/lib/search/truncate-for-index";
import { EMBED_MODEL } from "@/lib/search/embedder";
import type { BookmarkId } from "@/types";

export interface EmbedWorker {
  kick(): void;
  enqueue(id: BookmarkId): void;
  inflight(): number;
  pending(): number;
  clear(): void;
}

export interface EmbedWorkerCtx {
  embed: (text: string) => Promise<number[]>;
  now?: () => number;
  concurrency?: number;
}

export function createEmbedWorker(ctx: EmbedWorkerCtx): EmbedWorker {
  const concurrency = ctx.concurrency ?? 1;
  const now = ctx.now ?? Date.now;
  const queue: BookmarkId[] = [];
  const inflight = new Set<BookmarkId>();

  function needsEmbedding(id: BookmarkId): boolean {
    const s = useStore.getState();
    const b = s.bookmarks.byId[id];
    if (!b || b.deletedAt !== null) return false;
    const existing = s.embeddingById[id];
    if (!existing) return true;
    return false; // re-embed-on-newer-article is handled by enqueue-on-capture
  }

  function kick(): void {
    const state = useStore.getState();
    for (const id of state.bookmarks.order) {
      if (needsEmbedding(id)) enqueue(id);
    }
  }

  function enqueue(id: BookmarkId): void {
    if (inflight.has(id) || queue.includes(id)) return;
    queue.push(id);
    pump();
  }

  function pump(): void {
    while (queue.length > 0 && inflight.size < concurrency) {
      const id = queue.shift()!;
      inflight.add(id);
      void process(id);
    }
  }

  async function process(id: BookmarkId): Promise<void> {
    try {
      const bookmark = selectBookmarkById(useStore.getState().bookmarks, id);
      if (!bookmark || bookmark.deletedAt !== null) return;
      const body = truncateForIndex(useStore.getState().articleText[id] ?? "");
      const text = [bookmark.title, bookmark.description ?? "", body]
        .join(" ")
        .trim();
      if (!text) return;
      const vector = await ctx.embed(text);
      // Ghost-write guard: the bookmark may have been deleted mid-embed.
      const after = selectBookmarkById(useStore.getState().bookmarks, id);
      if (!after || after.deletedAt !== null) return;
      try {
        await useStore.getState().embeddingsAdapter.put({
          bookmarkId: id,
          vector,
          model: EMBED_MODEL,
          embeddedAt: now(),
        });
      } catch {
        return;
      }
      useStore.setState((s) => ({
        embeddingById: { ...s.embeddingById, [id]: vector },
      }));
    } catch {
      // Never throw out of the queue loop; retried on next kick.
    } finally {
      inflight.delete(id);
      pump();
    }
  }

  return {
    kick,
    enqueue,
    inflight: () => inflight.size,
    pending: () => queue.length,
    clear: () => {
      queue.length = 0;
      inflight.clear();
    },
  };
}

let singleton: EmbedWorker | null = null;
export function mountEmbedWorker(ctx: EmbedWorkerCtx): EmbedWorker {
  if (singleton) singleton.clear();
  singleton = createEmbedWorker(ctx);
  return singleton;
}
export function embedWorker(): EmbedWorker {
  if (!singleton) {
    return {
      kick: () => {},
      enqueue: () => {},
      inflight: () => 0,
      pending: () => 0,
      clear: () => {},
    };
  }
  return singleton;
}
export function embedWorkerMounted(): boolean {
  return singleton !== null;
}
