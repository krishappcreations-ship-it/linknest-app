# ADR-005 — Design Principles

**Status:** Accepted
**Date:** 2026-05-21
**Phase:** 1 (Context Grounding)

## Context

LinkNest aims for Linear / Arc Browser / Raindrop.io polish with explicit anti-slop rules. Without codified principles, UI drifts toward generic Tailwind dashboard aesthetics over time. This ADR locks the visual constitution so every UI PR can be evaluated against fixed criteria.

Design configuration:

- `DESIGN_VARIANCE: 8` — artsy, not symmetric
- `MOTION_INTENSITY: 6` — meaningful motion, not cinematic
- `VISUAL_DENSITY: 4` — breathable, not packed

## Decision

### 1. Color system (locked, Phase 2)

**Base palette:**

- `zinc-950` (deepest), `zinc-900`, `zinc-800`, `zinc-700` — surfaces and depth
- `stone-100`, `stone-200` — light mode equivalents
- `zinc-400`, `zinc-500` — secondary text

**Accent palette:**

- `cyan-400` (muted) — primary accent
- `blue-500` (electric) — interactive states (focus rings, links)
- `orange-400` (soft) — destructive / warning hover

**Tag color palette (curated 8):**

1. `cyan-400` — Reading / docs
2. `blue-500` — Tools
3. `orange-400` — Inspiration
4. `emerald-400` — Code / dev
5. `violet-400` — Design
6. `rose-400` — Personal
7. `amber-400` — Watch later
8. `zinc-400` — Archive

Users pick from these 8 only. No hex input UI. Rationale: predictable palette, on-brand, prevents AI-slop pastel explosion.

**Forbidden:**

- Purple/pink startup gradients
- Crypto/NFT neon
- Glassmorphism overlays (subtle backdrop blur for modals only; no glossy panels)

### 2. Typography (locked)

**Primary:** Geist (sans), via `next/font` self-hosted.
**Mono:** Geist Mono — for URLs, code, kbd shortcuts.

**Scale (rem):**

- 0.75 — xs (kbd, micro labels)
- 0.875 — sm (secondary text)
- 1.0 — base (body)
- 1.125 — md (card titles)
- 1.5 — lg (section headings)
- 2.25 — xl (page titles)

**Line heights:**

- 1.4 for UI text
- 1.6 for body content (reading mode in Phase 2)

**Weights:** 400, 500, 600. No 700+ for UI; reserved for hero copy only.

### 3. Spacing (4px grid)

Tailwind defaults (4px increments). Forbidden: arbitrary `[7px]`, `[13px]` values unless layout math demands it (rare, must be reviewed).

**Layout containers:** `max-w-[1400px] mx-auto px-6 lg:px-8`.

### 4. Layout safety (enforced)

- `min-h-[100dvh]` not `h-screen` — iOS Safari layout jumping prevention.
- `'use client'` at the top of every client component, never in shared util files.
- State only in client components; server components stay pure.
- Tailwind v4 locked. v3 syntax forbidden when v4 differs (CSS-first config in `app/globals.css`).

### 5. Component primitives (Phase 2 deliverable)

Base set:

- `Card` — base elevated surface with subtle ring + shadow
- `Surface` — flat container, no elevation
- `IconButton` — square 32px or 40px, accessible
- `Tooltip` — instant on hover, 0 delay after first display in 1500ms
- `Popover`, `DropdownMenu`, `Dialog` — Radix primitives styled with tokens
- `Kbd` — keyboard shortcut hint

shadcn/ui installation: Phase 2. Configured for zinc base, manual install of only components used (no kitchen sink).

### 6. Motion (ADR-002 cross-reference)

- `transform` + `opacity` only in transitions
- Animation tokens from `app/styles/motion.ts` — never inline values
- `useReducedMotion()` everywhere motion lives
- GSAP forbidden in same tree as Framer Motion (mostly: no GSAP at all in MVP)

### 7. Iconography

- Phosphor or Radix icons only. No emoji in UI strings.
- 16px or 20px stroke icons, inline-flex aligned.

### 8. Borders, radii, shadows

**Radii:** `rounded-md` (6px), `rounded-lg` (8px), `rounded-xl` (12px). Forbidden: `rounded-3xl` (24px+) per spec anti-slop rule "no giant rounded corners."

**Borders:** `border-zinc-800/60` for subtle separations. Forbidden: visible 1px solid black or pure white borders.

**Shadows:** ring-based for elevation (`ring-1 ring-zinc-800/40`), never large blurred shadows. Subtle drop shadow only on hover for cards (`shadow-lg shadow-black/20`).

### 9. Hover and focus

**Cards on hover:**

- Subtle scale: `scale(1.005)` — barely perceptible
- Ring becomes `ring-zinc-700` (1 step brighter)
- Optional accent line at top reveals via `clip-path`

**Focus rings:**

- 2px `ring-blue-500/60` with `ring-offset-2 ring-offset-zinc-950`
- Always visible on `:focus-visible`, never on `:focus` (mouse vs keyboard distinction)

### 10. Anti-slop checklist (enforced in review)

- [ ] No purple/pink gradients
- [ ] No `rounded-3xl` or larger on UI surfaces
- [ ] No glassmorphism overlay panels
- [ ] No emoji in code or strings
- [ ] No `h-screen` (use `min-h-[100dvh]`)
- [ ] No inline transition durations / easings (use motion tokens)
- [ ] No `transition: all`
- [ ] No `scale(0)` (use `scale(0.95)` + opacity)
- [ ] No `ease-in` as default (use `ease-out`)
- [ ] No GSAP imports
- [ ] No raw Tailwind colors outside the locked palette

## Consequences

**Positive:**

- Visual consistency across weeks/months of iteration — no drift toward "generic SaaS dashboard."
- Every UI PR has a fixed rubric to be evaluated against (this ADR).
- Tag color palette = 8 swatches = small, predictable, beautiful palette across folders/tags.
- Anti-slop checklist gives the review checklist deterministic criteria.

**Negative:**

- Constrains experimentation. New colors require ADR revision.
- "Curated palette only" closes user customization door — Phase 2 feature could relax.

**Rejected alternatives:**

- Default shadcn theme — too generic, fights the Linear/Arc aesthetic.
- Freeform tag colors — guarantees palette pollution.
- Larger rounded radii (default shadcn) — spec explicitly forbids "giant rounded corners."

## Cross-references

- ADR-002 — Animation System (motion tokens)
- ADR-003 — Folder Architecture (folder color picker pulls from tag palette)
- CONTEXT.md → Glossary
- Plan Phase 2 — the design tokens + component primitives deliver the design system.
- Plan Phase 6 — design + motion reviews reference this ADR for pass/fail.
