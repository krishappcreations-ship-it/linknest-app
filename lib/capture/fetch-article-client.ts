/**
 * Client-side caller for /api/capture — feature 23.
 * Used by the production capture-worker singleton.
 */

import { CaptureResponseSchema, type CaptureResponse } from "@/types";

export async function postCapture(url: string): Promise<CaptureResponse> {
  try {
    const res = await fetch("/api/capture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    const parsed = CaptureResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { ok: false, kind: "network", retriable: true };
    }
    return parsed.data;
  } catch {
    return { ok: false, kind: "network", retriable: true };
  }
}
