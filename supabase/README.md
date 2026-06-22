# Supabase — LinkNest Phase 1 Cloud Sync

## Setup (one-time)

See the “Cloud sync” section of the project README for Supabase project + Google OAuth setup.

## Migrations

### Option A — SQL Editor (no CLI)

1. Supabase dashboard → SQL Editor → New query
2. Paste the contents of `migrations/0001_initial.sql`
3. Run. Expect "Success. No rows returned."

### Option B — Supabase CLI

```bash
npm i -g supabase
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

## Verification

After running the migration, in the Supabase dashboard:

- **Table Editor** shows 4 tables: `bookmarks`, `folders`, `tags`, `preferences`
- Each table row has a lock icon next to the name (= RLS enabled)
- **Authentication → Policies** shows 4 `*_owner` policies (one per table)
- **Database → Functions** shows `upsert_bookmarks_lww`, `upsert_folders_lww`, `upsert_tags_lww`

## Dev vs prod projects

Use two separate Supabase projects:

- `linknest-dev` — this branch + local development
- `linknest-prod` — only after merge + production deploy

Never test against `linknest-prod`. The dev project receives all manual smoke testing data and can be wiped without affecting users.

## Migration 0002 — folder/tag tombstones (feature 11)

After `0001_initial.sql` is applied, run `0002_tombstones.sql` to add `deleted_at` columns and replace the LWW RPCs for folders + tags.

Idempotent: `add column if not exists` + `create or replace function`. Safe to re-run.

## Re-running the migration

The file uses `create table` (not `create table if not exists`) for tables and `create or replace function` for RPCs. To re-run cleanly:

1. Drop the tables first (`drop table bookmarks, folders, tags, preferences cascade;`)
2. Re-run `0001_initial.sql`

RLS policies + RPC functions re-create idempotently. Indexes use `if not exists`.
