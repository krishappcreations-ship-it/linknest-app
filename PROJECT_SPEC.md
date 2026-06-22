# LinkNest — Product Specification

## Core Product

### Name

LinkNest

### Tagline

> "Save beautifully. Find instantly."

### One-line Pitch

A visually polished bookmark management web app that transforms saved links into interactive visual cards with folders, tags, drag-drop organization, instant search, and premium motion design.

---

## Product Vision

LinkNest is not just a bookmark manager. It is built to demonstrate:

- scalable frontend architecture
- clean React state management with no spaghetti
- premium interaction systems
- a robust drag/drop system
- production-grade motion design
- a scalable component architecture
- consistent visual design
- startup-quality UX

This app should feel:

- Linear-like smoothness
- Raindrop.io simplicity
- Arc Browser elegance
- Vercel-quality polish
- tactile, responsive, calm, premium

> The app should immediately feel: **"This looks like a real productivity startup."**

---

## Reference Inspiration

### Primary References

- Raindrop.io
- Arc Browser
- Cosmos.so
- Pinterest boards
- Linear
- Notion

### Extracted Ideas

- visual-first bookmarking
- breathable layouts
- minimal friction organization
- premium drag/drop
- tactile interactions
- fast search
- elegant motion systems
- modern productivity UX

### LinkNest Should Improve With

- smoother motion system
- better frontend architecture
- cleaner component boundaries
- more premium interaction design
- stronger mobile UX
- more scalable React state systems
- cleaner visual hierarchy
- stronger anti-generic aesthetics

---

## Final Product Scope

### MVP Core Features

#### 1. Save Bookmarks

Users can save:

- websites
- articles
- YouTube videos
- GitHub repos
- docs
- tweets/posts
- tools

Input methods:

- paste URL
- quick add modal
- drag/drop links
- browser-extension-ready architecture

#### 2. Automatic Visual Preview Cards

Each saved link automatically generates:

- preview image
- title
- description
- favicon
- domain metadata

Cards should feel: tactile, alive, interactive, elegant, responsive.

#### 3. Folder Organization

Users can:

- create folders
- create nested collections
- drag bookmarks between folders
- reorder collections
- pin favorite folders

#### 4. Tagging System

Users can:

- create tags
- assign multiple tags
- filter by tags
- create color-coded categories

#### 5. Drag & Drop Interaction System

**Core interaction feature.**

Users can:

- reorder bookmarks
- move cards across folders
- rearrange layouts
- multi-select drag

Motion system should feel: spring-based, physical, responsive, premium.

#### 6. Instant Search

Global search across: bookmark titles, URLs, tags, descriptions, domains.

Keyboard shortcut: `CMD/CTRL + K`

#### 7. Multiple Layout Modes

Views:

- masonry grid
- compact list
- gallery mode

Must support:

- instant switching
- responsive adaptation
- smooth transitions

#### 8. Local Persistence

Bookmarks persist via:

- IndexedDB **OR** Supabase backend

Requirements:

- optimistic updates
- instant reloads
- offline-ready architecture
- smooth synchronization

---

### Premium Features (Phase 2+)

| Feature            | Description                         |
| ------------------ | ----------------------------------- |
| Shared Collections | Collaborative bookmark spaces       |
| AI Categorization  | Automatic smart organization        |
| Browser Extension  | One-click saving                    |
| Reading Mode       | Distraction-free article view       |
| Smart Collections  | Dynamic filtering rules             |
| Device Sync        | Multi-device synchronization        |
| Notes & Highlights | Attach annotations to bookmarks     |
| Screenshot Capture | Save visual snapshots automatically |

---

## Technical Stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- Framer Motion
- Zustand
- React Query
- dnd-kit

### Backend

Recommended: **Supabase** or **Appwrite**

- API: Next.js Route Handlers
- Database: Supabase Postgres

### Storage

- bookmark metadata
- preview thumbnails
- user folders
- tag systems
- collection state

### Deployment

- Vercel
- edge optimized
- CDN optimized
- server components first

---

## Design Direction

### Visual Identity

**Mood:** calm, focused, productive, tactile, premium, minimal

**Style References:** Linear, Arc Browser, Raindrop.io, Notion, Vercel

### UI Rules

#### STRICT ANTI-SLOP RULES

**NEVER:**

- generic Tailwind dashboards
- crypto gradients
- glassmorphism overload
- giant rounded corners
- dashboard-template aesthetics
- purple/pink startup gradients
- cluttered sidebars
- boring card grids

**ALWAYS:**

- asymmetry
- breathing room
- restrained motion
- subtle depth
- elegant spacing hierarchy
- tactile hover states
- smooth transitions
- premium card composition
- `transform` + `opacity` animations only

### Typography

| Role      | Font             |
| --------- | ---------------- |
| Primary   | Geist or Satoshi |
| Secondary | Geist Mono       |

### Color System

**Base:**

- `zinc-950`
- `zinc-900`
- `zinc-800`
- `stone-100`

**Accent:**

- muted cyan
- electric blue
- soft orange

**NO:** NFT aesthetics, neon gradients, glossy startup templates

### Motion System

**Animation Principles:**

- spring motion
- subtle scaling
- tactile interactions
- friction-based drag
- `opacity` + `transform` only
- restrained durations

**Motion Examples:**

- cards subtly lift on hover
- dragged cards compress slightly
- folder transitions animate smoothly
- search modal softly fades/scales
- optimistic updates animate naturally
- hover states feel tactile

---

## Information Architecture

### Main Layout

**Left Sidebar:** folders, tags, collections, settings

**Main Area:** bookmark grid, layout modes, filtering state, drag/drop canvas

**Top Bar:** global search, add bookmark, layout switcher, profile/settings

### Bookmark Card UX

Each card should contain:

- preview image
- favicon
- title
- domain
- tags
- quick actions

Hover interactions:

- subtle scale
- shadow depth shift
- quick actions reveal
- drag handle visibility

### Mobile UX

Mobile should feel: native, thumb-friendly, fluid, lightweight.

Features:

- bottom navigation
- swipe interactions
- responsive card stacking
- touch-friendly drag/drop

---

## Performance Requirements

### Lighthouse Targets

| Metric         | Target |
| -------------- | ------ |
| Performance    | 95+    |
| Accessibility  | 100    |
| SEO            | 95+    |
| Best Practices | 100    |

### Performance Constraints

**JS Budget:**

- minimal client JS
- server components first
- lazy-load heavy interactions
- isolated client components

**Rendering:**

- optimized image previews
- memoized card rendering
- virtualization ready
- GPU-safe animations

### Accessibility Requirements

- keyboard navigation
- semantic HTML
- screen reader labels
- reduced motion support
- accessible drag/drop
- proper focus states

### Security Requirements

- URL validation
- metadata sanitization
- secure API routes
- rate limiting
- safe preview rendering

---

## Suggested Folder Structure

```
/app
  /(dashboard)
  /(collections)
  /search
  /settings
  /api

/components
  /cards
  /folders
  /tags
  /search
  /layout
  /dragdrop
  /motion

/lib
  /db
  /validation
  /preview
  /utils

/hooks
/store
/styles
/types
```

---

## Expected Final Product Quality

LinkNest should feel like:

- a real YC startup
- production-ready frontend software
- premium productivity software
- modern SaaS-quality engineering

The finished product demonstrates:

- frontend architecture quality
- interaction quality
- component scalability
- React engineering quality
- animation systems
- motion consistency
- visual hierarchy
- production readiness
