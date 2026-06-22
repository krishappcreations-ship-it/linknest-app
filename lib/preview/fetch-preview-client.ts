/**
 * Client-side caller for the /api/preview route — feature 02.
 * Used by the production preview-worker singleton.
 */

import { PreviewResponseSchema, type PreviewResponse } from "@/types";

export async function postPreview(url: string): Promise<PreviewResponse> {
  try {
    const res = await fetch("/api/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    const parsed = PreviewResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { ok: false, kind: "network", retriable: true };
    }
    return parsed.data;
  } catch {
    return { ok: false, kind: "network", retriable: true };
  }
}
