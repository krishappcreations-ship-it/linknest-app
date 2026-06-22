-- LinkNest feature 08 Phase 1 — initial schema.
-- See docs/adr/009-cloud-sync-architecture.md for the architecture.
-- Columns mirror types/index.ts exactly. Indexes use `if not exists` so the
-- file is safe to re-run on a partially-applied state. Tables + functions are
-- full create — for a clean re-run, drop tables first (see README).

-- ============================================================================
-- Tables
-- ============================================================================
-- Bookmark fields per BookmarkSchema in types/index.ts:
--   id, url, title, description, previewImageUrl, faviconUrl, domain,
--   previewStatus, folderId, tagIds, createdAt, updatedAt, deletedAt,
--   previewFailureKind, previewAttempt
-- + user_id for RLS.

create table bookmarks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  title text not null,
  description text,
  preview_image_url text,
  favicon_url text,
  domain text not null,
  preview_status text not null,
  folder_id text,
  tag_ids text[] not null default '{}',
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  preview_failure_kind text,
  preview_attempt integer not null default 0
);

create index if not exists bookmarks_user_id_idx on bookmarks(user_id);
create index if not exists bookmarks_updated_at_idx on bookmarks(user_id, updated_at desc);

-- Folder fields per FolderSchema:
--   id, name, parentId, order, pinned, color, createdAt, updatedAt
-- NOTE: no deletedAt on folders. Phase 1 limitation — folder hard-deletes
-- on Device A do NOT propagate cross-device. Documented in spec §3.

create table folders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id text,
  order_index double precision not null,
  pinned boolean not null default false,
  color text,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists folders_user_id_idx on folders(user_id);

-- Tag fields per TagSchema:
--   id, name, color, createdAt, updatedAt
-- NOTE: no deletedAt on tags. Same limitation as folders.

create table tags (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  created_at bigint not null,
  updated_at bigint not null
);

create index if not exists tags_user_id_idx on tags(user_id);

-- Preferences (single row per user):
--   layout, theme, pinnedFolderIds

create table preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout text not null default 'masonry',
  theme text not null default 'dark',
  pinned_folder_ids text[] not null default '{}',
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- ============================================================================
-- RLS
-- ============================================================================

alter table bookmarks enable row level security;
alter table folders enable row level security;
alter table tags enable row level security;
alter table preferences enable row level security;

create policy "bookmarks_owner" on bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "folders_owner" on folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tags_owner" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "preferences_owner" on preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- LWW RPC functions
-- ============================================================================
-- Each function accepts a JSONB array of row objects + performs conditional
-- upsert: insert new rows, update existing rows only when incoming
-- updated_at is strictly newer. Required for correctness because the
-- @supabase/supabase-js .upsert() API cannot express conditional WHERE
-- clauses. See spec §8.2.

create or replace function upsert_bookmarks_lww(rows jsonb)
returns void language plpgsql security invoker as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into bookmarks (
      id, user_id, url, title, description, preview_image_url,
      favicon_url, domain, preview_status, folder_id, tag_ids,
      created_at, updated_at, deleted_at,
      preview_failure_kind, preview_attempt
    ) values (
      r->>'id', (r->>'user_id')::uuid, r->>'url', r->>'title',
      r->>'description', r->>'preview_image_url',
      r->>'favicon_url', r->>'domain', r->>'preview_status',
      r->>'folder_id',
      array(select jsonb_array_elements_text(r->'tag_ids')),
      (r->>'created_at')::bigint, (r->>'updated_at')::bigint,
      nullif(r->>'deleted_at','')::bigint,
      r->>'preview_failure_kind',
      coalesce((r->>'preview_attempt')::integer, 0)
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
      preview_attempt = excluded.preview_attempt
    where bookmarks.updated_at < excluded.updated_at;
  end loop;
end $$;

create or replace function upsert_folders_lww(rows jsonb)
returns void language plpgsql security invoker as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into folders (
      id, user_id, name, parent_id, order_index, pinned, color,
      created_at, updated_at
    ) values (
      r->>'id', (r->>'user_id')::uuid, r->>'name', r->>'parent_id',
      (r->>'order_index')::double precision, (r->>'pinned')::boolean,
      r->>'color',
      (r->>'created_at')::bigint, (r->>'updated_at')::bigint
    )
    on conflict (id) do update set
      name = excluded.name, parent_id = excluded.parent_id,
      order_index = excluded.order_index, pinned = excluded.pinned,
      color = excluded.color,
      updated_at = excluded.updated_at
    where folders.updated_at < excluded.updated_at;
  end loop;
end $$;

create or replace function upsert_tags_lww(rows jsonb)
returns void language plpgsql security invoker as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into tags (
      id, user_id, name, color,
      created_at, updated_at
    ) values (
      r->>'id', (r->>'user_id')::uuid, r->>'name', r->>'color',
      (r->>'created_at')::bigint, (r->>'updated_at')::bigint
    )
    on conflict (id) do update set
      name = excluded.name, color = excluded.color,
      updated_at = excluded.updated_at
    where tags.updated_at < excluded.updated_at;
  end loop;
end $$;
