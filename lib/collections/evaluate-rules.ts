/**
 * Pure smart-collection rule evaluator (feature 27). Flat AND: every rule must
 * pass. An empty rule list matches NOTHING (a rule-less collection is empty,
 * not "everything" — avoids a surprise "all bookmarks" view).
 */

import type { Bookmark, FolderId, Rule } from "@/types";

export interface RuleContext {
  readingMinutes: (bookmarkId: string) => number | undefined;
  inFolderSubtree: (bookmarkId: string, folderId: FolderId) => boolean;
  now: number;
}

export function matchesRule(
  rule: Rule,
  b: Bookmark,
  ctx: RuleContext
): boolean {
  switch (rule.field) {
    case "readState":
      return b.readState === rule.value;
    case "captureStatus":
      return b.captureStatus === rule.value;
    case "tag":
      return rule.op === "has"
        ? b.tagIds.includes(rule.value)
        : !b.tagIds.includes(rule.value);
    case "untagged":
      return b.tagIds.length === 0;
    case "folder":
      if (rule.op === "unfiled") return b.folderId === null;
      return (
        rule.value != null && ctx.inFolderSubtree(b.id, rule.value as FolderId)
      );
    case "readingMinutesGte":
      return (ctx.readingMinutes(b.id) ?? 0) >= rule.value;
    case "createdWithinDays":
      return b.createdAt >= ctx.now - rule.value * 86_400_000;
  }
}

export function matchesRules(
  rules: Rule[],
  b: Bookmark,
  ctx: RuleContext
): boolean {
  if (rules.length === 0) return false;
  return rules.every((r) => matchesRule(r, b, ctx));
}
