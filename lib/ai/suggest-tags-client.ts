"use client";

export type TagSuggestion = { name: string; kind: "existing" | "new" };

export type SuggestTagsResult =
  | { ok: true; suggestions: TagSuggestion[] }
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

export async function suggestTags(input: {
  url: string;
  title?: string | null;
  description?: string | null;
  existingTags: string[];
}): Promise<SuggestTagsResult> {
  try {
    const res = await fetch("/api/suggest-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      const err = (json?.error ?? "ai_error") as
        | "unauthorized"
        | "bad_request"
        | "ai_error"
        | "config"
        | "rate_limited";
      return { ok: false, error: err };
    }
    const json = await res.json();
    if (!json?.ok || !Array.isArray(json.suggestions)) {
      return { ok: false, error: "ai_error" };
    }
    return { ok: true, suggestions: json.suggestions };
  } catch {
    return { ok: false, error: "network" };
  }
}
