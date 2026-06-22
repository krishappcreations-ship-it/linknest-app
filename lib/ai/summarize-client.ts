"use client";

export type SummarizeResult =
  | { ok: true; tldr: string; keyPoints: string[] }
  | {
      ok: false;
      error:
        | "unauthorized"
        | "bad_request"
        | "ai_error"
        | "config"
        | "network"
        | "rate_limited";
    };

export async function summarize(input: {
  text: string;
  title?: string | null;
}): Promise<SummarizeResult> {
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      tldr?: string;
      keyPoints?: string[];
      error?: string;
    } | null;
    if (!res.ok || !json?.ok) {
      const err = (json?.error ?? "ai_error") as Exclude<
        SummarizeResult,
        { ok: true }
      >["error"];
      return { ok: false, error: err };
    }
    return { ok: true, tldr: json.tldr ?? "", keyPoints: json.keyPoints ?? [] };
  } catch {
    return { ok: false, error: "network" };
  }
}
