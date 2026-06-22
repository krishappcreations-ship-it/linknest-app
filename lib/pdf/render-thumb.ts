"use client";

/**
 * Render page 1 of a PDF to a JPEG data URL (thumbnail). Client-only; pdf.js is
 * dynamically imported by the caller so it stays out of the main bundle. The
 * worker is served same-origin from /public (CSP: worker falls back to
 * default-src 'self'). Returns null on any failure — the card keeps its icon.
 */

import * as pdfjs from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export async function renderPdfThumb(
  url: string,
  width = 640
): Promise<string | null> {
  try {
    const pdf = await pdfjs.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      await pdf.destroy();
      return null;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    await pdf.destroy();
    return dataUrl;
  } catch {
    return null;
  }
}
