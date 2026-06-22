/**
 * Pure factory for a Highlight (feature 30). Test seam: pass `now`/`id`.
 */

import {
  asHighlightId,
  type BookmarkId,
  type Highlight,
  type HighlightColor,
} from "@/types";

export interface HighlightInput {
  bookmarkId: BookmarkId;
  quote: string;
  prefix: string;
  suffix: string;
  color: HighlightColor;
}

export interface BuildHighlightCtx {
  now?: () => number;
  id?: () => string;
}

function defaultId(): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `hl_${raw}`;
}

export function buildHighlight(
  input: HighlightInput,
  ctx: BuildHighlightCtx = {}
): Highlight {
  return {
    id: asHighlightId((ctx.id ?? defaultId)()),
    bookmarkId: input.bookmarkId,
    quote: input.quote,
    prefix: input.prefix,
    suffix: input.suffix,
    color: input.color,
    annotation: null,
    createdAt: (ctx.now ?? Date.now)(),
  };
}
