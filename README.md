# LinkNest

A fast, visual bookmark manager for the web — save links, images, PDFs, and prompts; organize them with folders, tags, and instant search; read articles distraction-free. Local-first, works fully offline, with optional cloud sync across devices.

**Live:** https://linknest-inky.vercel.app

> _Tip: add a screenshot or GIF here (e.g. `docs/screenshot.png`) — it makes the repo._

---

## Features

- **Visual bookmarks** — every link becomes a card with an auto-fetched preview image, title, description, and favicon. Generated text previews for sites without an OG image.
- **More than links** — save **images** and **PDFs** (rendered first-page thumbnails) and **text prompts** organized by category, alongside your bookmarks.
- **Organize** — nested **folders**, an 8-color **tag** system, and a per-folder **Links / Images / PDFs** content filter.
- **Three layouts** — masonry, list, and gallery, with smooth animated transitions.
- **Instant search** — ⌘K command palette over titles, domains, tags, and captured article text.
- **Drag & drop** — reorder cards, reorder/nest folders, and drop bookmarks into folders, with spring-based motion and full keyboard support.
- **Reading workflow** — Inbox / Reading / Finished / Archived states, plus **Reader Mode**: capture a clean, offline-readable copy of any article (with notes & highlights).
- **Smart collections** — saved rule-based views that auto-populate.
- **Find related** — semantic search and duplicate/similar detection (on-device embeddings).
- **Import / Export** — Netscape bookmarks HTML (browser exports) and a portable JSON format.
- **PWA** — installable, offline-capable; responsive desktop + mobile UI.
- **Light & dark** themes.
- **Browser extension** — one-click "Save to LinkNest" from any tab (`browser-extension/`).

Optional (require config — see below):

- **Cloud sync** across devices via Supabase + Google sign-in.
- **AI assists** — suggested tags and article TL;DR summaries.

---

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · Dexie (IndexedDB) · Framer Motion · Radix UI · Supabase (optional) · Vitest.

---

## Getting started

Works out of the box — no accounts, no keys. Everything is stored locally in your browser (IndexedDB).

```bash
git clone https://github.com/krishappcreations-ship-it/linknest-app.git
cd linknest-app
npm install
npm run dev          # http://localhost:3000
```

That's it — start saving bookmarks. Your data stays on your device and survives reloads.

```bash
npm run build        # production build
npm test             # run the test suite
npm run typecheck    # type-check only
```

---

## Optional: cloud sync

LinkNest is fully usable offline. To sync across devices, connect your own Supabase project:

1. Create a free Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. **Auth → Providers → Google:** paste a Google OAuth client ID + secret (from Google Cloud Console).
3. In Google Cloud Console → Credentials → OAuth client:
   - Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
   - Authorized JS origins: `http://localhost:3000` + your production domain
4. **SQL Editor:** run every file in `supabase/migrations/` in order.
5. Add your keys to `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-jwt>
   ```

6. Restart the dev server. "Sign in with Google" appears at the bottom of the sidebar.

Both keys are public by design — the anon key is JWT-signed and Row-Level Security protects each user's data. See `supabase/README.md` for details.

### Optional: AI assists

For suggested tags and article summaries, add an Anthropic API key (server-side only, never exposed to the client):

```bash
ANTHROPIC_API_KEY=<your-key>
```

Without it, the rest of the app works normally — these two features are simply hidden.

---

## How it works

Local-first: all reads/writes hit IndexedDB instantly, so the UI never waits on the network. When signed in, writes also sync to Supabase (last-write-wins by `updatedAt`, enforced server-side) and pull on load + over realtime. Captured articles, previews, and embeddings are computed and cached locally.

## Documentation

- [`PROJECT_SPEC.md`](PROJECT_SPEC.md) — product requirements
- [`CONTEXT.md`](CONTEXT.md) — domain glossary
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — roadmap

## License

© 2026 Krish. All rights reserved. (Open an issue if you'd like to reuse it.)
