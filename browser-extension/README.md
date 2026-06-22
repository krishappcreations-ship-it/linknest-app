# LinkNest Browser Extension

One-click "Save current tab to LinkNest" — a standalone MV3 extension
(Chrome/Edge). Saves through the same `upsert_bookmarks_lww` Supabase RPC the web
app uses, so saved bookmarks sync to the app immediately.

## Setup

1. `cd browser-extension && npm install`
2. `cp .env.example .env` and fill in:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — the public anon key (safe to ship; RLS protects data)
   - `VITE_LINKNEST_URL` — the web app URL (default `http://localhost:3000`)
3. `npm run build` → outputs `dist/`

## Load it (development — free, no store account)

1. Chrome → `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. **Load unpacked** → select `browser-extension/dist`
4. Pin the LinkNest icon, open any tab, click it, **sign in**, then
   **Save to LinkNest**. The bookmark appears in the app (shared RPC + realtime
   sync).

## Sign in with Google (same account as the web app)

The popup offers **Continue with Google** (and email/password as a fallback).
Google uses `chrome.identity.launchWebAuthFlow` against the project's existing
Google provider, so it signs into the **same account** — your existing bookmarks
are right there.

One-time Supabase config so Google can redirect back into the extension:

1. Load the unpacked extension and note its **ID** on `chrome://extensions`.
2. The redirect URL is `https://<EXTENSION_ID>.chromiumapp.org/`.
3. Supabase dashboard → **Authentication → URL Configuration → Redirect URLs** →
   add that URL (the trailing slash matters).

Without step 3, Google sign-in fails with a redirect-mismatch error. The
email/password path needs no extra config (but the account must have a password
set — Google-only accounts don't).

## Scripts

- `npm run typecheck` · `npm test` · `npm run build`

## Publishing (optional, deferred)

The Chrome Web Store requires a one-time **$5 USD** developer registration; Edge
Add-ons and Firefox AMO are free. Publishing is **not** part of this milestone —
the extension is fully usable via "Load unpacked".
