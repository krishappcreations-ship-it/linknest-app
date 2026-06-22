import type { ArticlesAdapter } from "@/lib/db/articles-adapter";
import type { Article, BookmarkId } from "@/types";

/**
 * Merge a generated summary onto the cached Article (feature 25). No-op if the
 * article row is gone. Summary is article-scoped, so it lives with the articles
 * adapter — not the bookmark hook.
 */
export async function persistSummary(
  adapter: ArticlesAdapter,
  bookmarkId: BookmarkId,
  summary: NonNullable<Article["summary"]>
): Promise<void> {
  const article = await adapter.get(bookmarkId);
  if (!article) return;
  await adapter.put({ ...article, summary });
}
