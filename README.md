# LinkNest

A bookmark manager web app — Next.js 16 + React 19 + Zustand + Dexie + framer-motion.

See `PROJECT_SPEC.md` for product requirements and `CONTEXT.md` for the domain glossary.

## Quickstart

```bash
npm install
npm run dev          # http://localhost:3000
npm test -- --run    # vitest suite
npm run build        # production build
```

## Cloud sync (optional)

LinkNest works fully offline. Sign in with Google to sync across devices.

### Setup

1. Create a Supabase project at `supabase.com/dashboard` (free tier).
2. Enable Google OAuth: dashboard → Authentication → Providers → Google. Paste client ID + secret from Google Cloud Console.
3. Configure Google OAuth (Google Cloud Console → Credentials → OAuth 2.0 client → Web application):
   - Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
   - Authorized JS origin: `http://localhost:3000` + your production domain
4. Run the schema migration: dashboard → SQL Editor → paste contents of `supabase/migrations/0001_initial.sql` → Run.
5. Copy your project URL + anon key into `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-jwt>
   ```

6. Restart `npm run dev`.

The "Sign in with Google" button appears at the bottom of the sidebar.

Use separate Supabase projects for dev (`linknest-dev`) and production (`linknest-prod`). See `supabase/README.md` for migration details + verification steps.

### Phase 1 sync semantics

- Anon-default. App works fully without sign-in.
- Write-through fire-and-forget after sign-in. UI never blocks on network.
- Last-write-wins by `updatedAt`, enforced server-side via Postgres RPC.
- No offline write queue (writes while offline are lost — Phase 2).
- Folder + tag deletes don't propagate cross-device (Phase 2).

See `docs/adr/009-cloud-sync-architecture.md` for the full architecture.

## Docs

- `PROJECT_SPEC.md` — product requirements
- `CONTEXT.md` — domain glossary
- `docs/adr/` — architecture decisions
