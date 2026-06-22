/**
 * Local text embedder (feature 28) — Transformers.js, all-MiniLM-L6-v2.
 *
 * Client-only. The model package is dynamically imported on first use so it
 * stays out of the SSR / initial bundle; the ~25MB model downloads once and is
 * browser-cached. Returns a 384-dim L2-normalized vector (cosine === dot).
 *
 * Tests never import this — the embed-worker and semantic search take an
 * injectable `embed` fn and are tested with fakes.
 */

export const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipePromise: Promise<any> | null = null;

async function getPipeline() {
  if (!pipePromise) {
    pipePromise = import("@xenova/transformers").then((m) =>
      m.pipeline("feature-extraction", EMBED_MODEL, { quantized: true })
    );
  }
  return pipePromise;
}

export async function embed(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}
