# ADR-002 — Animation System

**Status:** Accepted
**Date:** 2026-05-21
**Phase:** 1 (Context Grounding)

## Context

LinkNest's animation quality is a quality axis (per PROJECT_SPEC.md). Requirements:

- Linear/Arc Browser-class feel — spring physics, tactile interactions
- Cards lift on hover, drag handles compress, folder transitions smooth, search modal soft fade/scale, optimistic updates animate naturally
- Mobile must feel native and thumb-friendly
- Accessibility: respect `prefers-reduced-motion`
- Performance: Lighthouse 95+ — `transform` + `opacity` only, never `width/height/top/left`

Motion rules:

- No GSAP and Framer Motion in the same component tree
- Animation tokens, not inline durations or easings
- React 19 / RSC safety — animation hooks isolated to `'use client'` components

## Decision

**Library:** `framer-motion` v12 only. GSAP forbidden.

**Token file:** `app/styles/motion.ts` is the single source of truth. Lints will block any `transition:`, `duration-*`, or numeric Framer Motion duration value outside this file (post-Phase 2).

**Token shape** (actual values authored in `app/styles/motion.ts` during Phase 2):

```ts
duration:  instant 0.1 | fast 0.125 | base 0.15 | medium 0.2 | slow 0.3 | emphasis 0.5
ease.out:    [0.23, 1, 0.32, 1]       // canonical default
ease.inOut:  [0.77, 0, 0.175, 1]      // reversible
ease.drawer: [0.32, 0.72, 0, 1]       // sheet / drawer
spring.gentle: { stiffness: 220, damping: 26 }
spring.snappy: { stiffness: 600, damping: 40 }
spring.drag:   { stiffness: 500, damping: 35, mass: 0.6 }
spring.bounce: { duration: 0.5, bounce: 0.2 }
stagger.list: 0.04
stagger.hero: 0.08
transform.liftHover: 1.005
transform.pressActive: 0.97
transform.enterFrom: 0.95
```

Plus `pickTransition(motion, reduce)` helper that returns `{ duration: 0 }`
when `useReducedMotion()` is true.

**Reduced motion:** Every animation site wraps Framer Motion props with the `useReducedMotion()` hook. When `prefers-reduced-motion: reduce`, durations collapse to `0` and springs become linear instant.

**Allowed CSS animation properties:** `transform`, `opacity`, `filter` (blur), `clip-path` (for reveals).
**Forbidden:** `width`, `height`, `top`, `left`, `margin`, `padding` in transitions. Layout-affecting properties go through Framer Motion's `layout` prop or `LayoutGroup`, never raw CSS transitions.

**Stack rule:** GSAP forbidden anywhere except isolated `<canvas>` contexts (none planned for MVP). Mixing libraries in the same component tree is a hard reject during code review.

## Consequences

**Positive:**

- Every animation feels uniform — predictable feedback across the app.
- One file changes, app-wide motion adjusts — design system polish in one place.
- Reduced motion handled centrally via single hook pattern.
- Pre-commit lint rule prevents drift (Phase 2 deliverable).

**Negative:**

- Restricts custom-curve experimentation; new curves must go through token addition + ADR amendment.
- Framer Motion has its own perf overhead; mitigated by `React.memo` on cards and using `motion(Card)` factory pattern at top-level only.

**Rejected alternatives:**

- GSAP — heavier runtime, harder to integrate with React 19 / Server Components.
- Plain CSS transitions — can't do springs, can't share state with React (drag, gestures).
- React Spring — smaller community than Framer Motion for current ecosystem; this project standardizes on Framer Motion.
- Inline durations everywhere — guarantees drift over weeks. Rejected explicitly.

## Cross-references

- ADR-005 — Design Principles (anti-slop design principles)
- CONTEXT.md → Entities (Drag operation)
- Plan Phase 2 — the motion-token layer generates `app/styles/motion.ts`.
- Plan Phase 6 — motion review on every animated slice.
