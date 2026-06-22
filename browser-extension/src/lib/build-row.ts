/**
 * Build a full snake_case bookmark row for the shared upsert_bookmarks_lww RPC
 * (feature 35). One write path for app + extension — drift-proof as columns evolve.
 */

export interface SaveInput {
  url: string;
  title: string;
  domain: string;
  folderId: string | null;
  tagIds: string[];
}

export function buildBookmarkRow(
  input: SaveInput,
  userId: string,
  now: number
) {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    url: input.url,
    title: input.title,
    description: null,
    preview_image_url: null,
    favicon_url: `https://www.google.com/s2/favicons?domain=${input.domain}&sz=64`,
    domain: input.domain,
    preview_status: "pending",
    folder_id: input.folderId,
    tag_ids: input.tagIds,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    preview_failure_kind: null,
    preview_attempt: 0,
    read_state: "inbox",
    note: null,
    link_status: "unknown",
    link_checked_at: null,
    link_redirect_url: null,
  };
}
