"use client";

/**
 * Lazy snapshot generation (feature 31). Returns the snapshot dataUrl for a
 * bookmark plus a `setRef` to attach an IntersectionObserver. Generates one
 * snapshot per image-less, on-screen bookmark through a module-level
 * single-flight gate, scheduled on idle so scroll never blocks. Mirrors the
 * embeddings storage pattern; never synced.
 *
 * `setRef` is a STABLE useCallback (never a state setter) — framer-motion
 * re-invokes callback refs on every render, so a state setter there would loop
 * (React #185). It sets `visible` only via the observer, and `setVisible(true)`
 * is idempotent (React bails when the value is unchanged).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { generateSnapshot } from "@/lib/snapshot/generate";
import { getSupabaseClient } from "@/lib/sync/supabase-client";
import type { Bookmark } from "@/types";

export function shouldGenerateSnapshot(
  bookmark: Pick<Bookmark, "previewImageUrl" | "kind" | "assetPath">,
  hasSnapshot: boolean
): boolean {
  if (hasSnapshot) return false;
  if (bookmark.kind === "image" || bookmark.kind === "prompt") return false;
  if (bookmark.kind === "pdf") return bookmark.assetPath != null; // render page 1
  return bookmark.previewImageUrl == null; // link: only when no og image
}

// Module-level single-flight: one generation at a time + de-dupe in-flight ids.
let running = false;
const inflight = new Set<string>();
const queue: Array<() => Promise<void>> = [];

function pump(): void {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = true;
  const idle =
    typeof requestIdleCallback !== "undefined"
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 0);
  idle(() => {
    void job().finally(() => {
      running = false;
      pump();
    });
  });
}

export interface BookmarkSnapshot {
  dataUrl: string | null;
  setRef: (el: HTMLElement | null) => void;
}

export function useBookmarkSnapshot(bookmark: Bookmark): BookmarkSnapshot {
  const dataUrl = useStore((s) => s.snapshotByBookmarkId[bookmark.id]) ?? null;
  const [visible, setVisible] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Stable ref callback — safe to be re-invoked every render by framer-motion.
  const setRef = useCallback((el: HTMLElement | null) => {
    if (el === nodeRef.current) return;
    observerRef.current?.disconnect();
    observerRef.current = null;
    nodeRef.current = el;
    if (el && typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setVisible(true);
        },
        { rootMargin: "200px" }
      );
      io.observe(el);
      observerRef.current = io;
    }
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const { id, title, description, domain, previewImageUrl, kind, assetPath } =
    bookmark;
  useEffect(() => {
    if (!visible) return;
    if (
      !shouldGenerateSnapshot(
        { previewImageUrl, kind, assetPath },
        dataUrl != null
      )
    )
      return;
    if (inflight.has(id)) return;
    inflight.add(id);
    queue.push(async () => {
      try {
        let url: string | null = null;
        if (kind === "pdf" && assetPath) {
          // Render page 1 of the PDF to a thumbnail (pdf.js lazy-loaded).
          const supabase = getSupabaseClient();
          const signed = supabase
            ? (
                await supabase.storage
                  .from("assets")
                  .createSignedUrl(assetPath, 600)
              ).data?.signedUrl
            : null;
          if (signed) {
            const { renderPdfThumb } = await import("@/lib/pdf/render-thumb");
            url = await renderPdfThumb(signed);
          }
        } else {
          url = await generateSnapshot({
            title,
            excerpt: description ?? "",
            domain,
          });
        }
        if (!url) return;
        await useStore.getState().snapshotsAdapter.put({
          bookmarkId: id,
          dataUrl: url,
          generatedAt: Date.now(),
        });
        useStore.setState((s) => ({
          snapshotByBookmarkId: { ...s.snapshotByBookmarkId, [id]: url },
        }));
      } finally {
        inflight.delete(id);
      }
    });
    pump();
  }, [
    visible,
    dataUrl,
    id,
    title,
    description,
    domain,
    previewImageUrl,
    kind,
    assetPath,
  ]);

  return { dataUrl, setRef };
}
