-- 0003_realtime.sql
-- Feature 13 (F08 Phase 2d): enable Realtime CDC on 3 sync tables.
-- Idempotent via DO blocks: safe to re-run on existing databases.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookmarks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tags;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- REPLICA IDENTITY DEFAULT is sufficient:
--   - INSERT/UPDATE events carry full new row in payload.new
--   - No hard DELETE (tombstones via deleted_at column, see migration 0002)
--
-- Preferences intentionally excluded (single-row, low-churn, no Settings UI).
-- RLS from 0001_initial.sql is evaluated server-side before Realtime sends
-- events to subscribers → cross-tenant leak impossible even without client filter.
