-- 0008 — Prompt items (kind='prompt'): saved text prompts grouped by category.
-- Additive synced columns + LWW RPC carry + widen the kind check. Idempotent.

alter table bookmarks add column if not exists prompt_body text;
alter table bookmarks add column if not exists prompt_category text;

alter table bookmarks drop constraint if exists bookmarks_kind_chk;
alter table bookmarks
  add constraint bookmarks_kind_chk
  check (kind in ('link', 'image', 'pdf', 'prompt'));

create or replace function upsert_bookmarks_lww(rows jsonb)
returns void language plpgsql security invoker as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into bookmarks (
      id, user_id, url, title, description, preview_image_url,
      favicon_url, domain, preview_status, folder_id, tag_ids,
      created_at, updated_at, deleted_at,
      preview_failure_kind, preview_attempt, read_state, note,
      link_status, link_checked_at, link_redirect_url,
      kind, asset_path, prompt_body, prompt_category
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
      r->>'note',
      r->>'link_status',
      nullif(r->>'link_checked_at','')::bigint,
      r->>'link_redirect_url',
      coalesce(r->>'kind', 'link'),
      r->>'asset_path',
      r->>'prompt_body',
      r->>'prompt_category'
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
      note = excluded.note,
      link_status = excluded.link_status,
      link_checked_at = excluded.link_checked_at,
      link_redirect_url = excluded.link_redirect_url,
      kind = excluded.kind,
      asset_path = excluded.asset_path,
      prompt_body = excluded.prompt_body,
      prompt_category = excluded.prompt_category
    where bookmarks.updated_at < excluded.updated_at;
  end loop;
end $$;
