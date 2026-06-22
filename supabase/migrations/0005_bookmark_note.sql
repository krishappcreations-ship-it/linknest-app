-- 0005 — F30 notes & highlights.
-- Additive note column (synced per-bookmark note) + LWW RPC replacement to
-- carry the column. Highlights are local-only and never reach the server.
-- Idempotent / re-runnable.

alter table bookmarks
  add column if not exists note text;

create or replace function upsert_bookmarks_lww(rows jsonb)
returns void language plpgsql security invoker as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into bookmarks (
      id, user_id, url, title, description, preview_image_url,
      favicon_url, domain, preview_status, folder_id, tag_ids,
      created_at, updated_at, deleted_at,
      preview_failure_kind, preview_attempt, read_state, note
    ) values (
      r->>'id', (r->>'user_id')::uuid, r->>'url', r->>'title',
      r->>'description', r->>'preview_image_url',
      r->>'favicon_url', r->>'domain', r->>'preview_status',
      r->>'folder_id',
      array(select jsonb_array_elements_text(r->'tag_ids')),
      (r->>'created_at')::bigint, (r->>'updated_at')::bigint,
      nullif(r->>'deleted_at','')::bigint,
      r->>'preview_failure_kind',
      coalesce((r->>'preview_attempt')::integer, 0),
      coalesce(r->>'read_state', 'inbox'),
      r->>'note'
    )
    on conflict (id) do update set
      url = excluded.url, title = excluded.title,
      description = excluded.description,
      preview_image_url = excluded.preview_image_url,
      favicon_url = excluded.favicon_url, domain = excluded.domain,
      preview_status = excluded.preview_status,
      folder_id = excluded.folder_id, tag_ids = excluded.tag_ids,
      updated_at = excluded.updated_at, deleted_at = excluded.deleted_at,
      preview_failure_kind = excluded.preview_failure_kind,
      preview_attempt = excluded.preview_attempt,
      read_state = excluded.read_state,
      note = excluded.note
    where bookmarks.updated_at < excluded.updated_at;
  end loop;
end $$;
