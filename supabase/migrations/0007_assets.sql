-- 0007 — Asset items (image / pdf). Additive synced columns on bookmarks +
-- LWW RPC carry, plus a private Supabase Storage bucket with owner-only RLS.
-- Idempotent.

alter table bookmarks add column if not exists kind text not null default 'link';
alter table bookmarks add column if not exists asset_path text;

alter table bookmarks drop constraint if exists bookmarks_kind_chk;
alter table bookmarks
  add constraint bookmarks_kind_chk check (kind in ('link', 'image', 'pdf'));

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
      kind, asset_path
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
      r->>'asset_path'
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
      asset_path = excluded.asset_path
    where bookmarks.updated_at < excluded.updated_at;
  end loop;
end $$;

-- Private bucket for uploaded files. Path convention: <user_id>/<bookmark_id>.<ext>
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

-- Owner-only access: the first path segment must equal the caller's uid.
drop policy if exists "assets_select_own" on storage.objects;
drop policy if exists "assets_insert_own" on storage.objects;
drop policy if exists "assets_update_own" on storage.objects;
drop policy if exists "assets_delete_own" on storage.objects;

create policy "assets_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
