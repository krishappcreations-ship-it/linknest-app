-- LinkNest feature 11 — F08 Phase 2b folder/tag tombstones.
-- Adds deleted_at bigint column to folders + tags.
-- Replaces upsert_folders_lww + upsert_tags_lww RPCs to handle the new column.
-- Idempotent: `add column if not exists` + `create or replace function`.

-- ============================================================================
-- Table alterations
-- ============================================================================

alter table folders add column if not exists deleted_at bigint;
alter table tags add column if not exists deleted_at bigint;

-- ============================================================================
-- RPC replacements
-- ============================================================================

create or replace function upsert_folders_lww(rows jsonb)
returns void language plpgsql security invoker as $$
declare r jsonb;
begin
  for r in select * from jsonb_array_elements(rows) loop
    insert into folders (
      id, user_id, name, parent_id, order_index, pinned, color,
      created_at, updated_at, deleted_at
    ) values (
      r->>'id', (r->>'user_id')::uuid, r->>'name', r->>'parent_id',
      (r->>'order_index')::double precision, (r->>'pinned')::boolean,
      r->>'color',
      (r->>'created_at')::bigint, (r->>'updated_at')::bigint,
      nullif(r->>'deleted_at','')::bigint
    )
    on conflict (id) do update set
      name = excluded.name, parent_id = excluded.parent_id,
      order_index = excluded.order_index, pinned = excluded.pinned,
      color = excluded.color,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
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
      created_at, updated_at, deleted_at
    ) values (
      r->>'id', (r->>'user_id')::uuid, r->>'name', r->>'color',
      (r->>'created_at')::bigint, (r->>'updated_at')::bigint,
      nullif(r->>'deleted_at','')::bigint
    )
    on conflict (id) do update set
      name = excluded.name, color = excluded.color,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
    where tags.updated_at < excluded.updated_at;
  end loop;
end $$;
