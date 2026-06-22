-- 0004 — F22 read-later workflow.
-- Additive read_state column + LWW RPC replacement. Idempotent / re-runnable.

alter table bookmarks
  add column if not exists read_state text not null default 'inbox';

alter table bookmarks
  drop constraint if exists bookmarks_read_state_chk;
alter table bookmarks
  add constraint bookmarks_read_state_chk
  check (read_state in ('inbox', 'reading', 'finished', 'archived'));

create or replace function upsert_bookmarks_lww(rows jsonb)
returns void language plpgsql security invoker as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into bookmarks (
      id, user_id, url, title, description, preview_image_url,
      favicon_url, domain, preview_status, folder_id, tag_ids,
      created_at, updated_at, deleted_at,
      preview_failure_kind, preview_attempt, read_state
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
      coalesce(r->>'read_state', 'inbox')
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
      read_state = excluded.read_state
    where bookmarks.updated_at < excluded.updated_at;
  end loop;
end $$;
