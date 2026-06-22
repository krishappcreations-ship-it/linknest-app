# LinkNest Design System

> Phase 2 deliverable. Single reference for every token and primitive.
> Source files: `app/styles/motion.ts`, `app/globals.css`, `components/ui/*`.

Cross-references: ADR-002 (Animation), ADR-005 (Design Principles).
Preview route: `/dev/preview` (not part of production build — middleware-gated in Phase 8).

---

## 1. Motion tokens (`app/styles/motion.ts`)

### Durations (seconds, Framer Motion native)

| Token               | Value | Use                               |
| ------------------- | ----- | --------------------------------- |
| `duration.instant`  | 0.10  | Focus ring, button press feedback |
| `duration.fast`     | 0.125 | Hover, tooltip in                 |
| `duration.base`     | 0.15  | Default UI transitions            |
| `duration.medium`   | 0.20  | Card hover, dropdown open         |
| `duration.slow`     | 0.30  | Modal, drawer, section reveal     |
| `duration.emphasis` | 0.50  | Hero, route transitions           |

### Easings (cubic-bezier)

| Token         | Curve                 | Use                    |
| ------------- | --------------------- | ---------------------- |
| `ease.out`    | `[0.23, 1, 0.32, 1]`  | Default (95% of UI)    |
| `ease.inOut`  | `[0.77, 0, 0.175, 1]` | Reversible (accordion) |
| `ease.drawer` | `[0.32, 0.72, 0, 1]`  | Sheet / side drawer    |

### Springs

| Token           | Config                              | Use                       |
| --------------- | ----------------------------------- | ------------------------- |
| `spring.gentle` | stiffness 220, damping 26           | Default UI spring         |
| `spring.snappy` | stiffness 600, damping 40           | Buttons, toggles          |
| `spring.drag`   | stiffness 500, damping 35, mass 0.6 | dnd-kit drag overlay      |
| `spring.bounce` | duration 0.5, bounce 0.2            | Celebratory micro-moments |

### Transforms (scale values)

| Token                   | Value | Use                     |
| ----------------------- | ----- | ----------------------- |
| `transform.liftHover`   | 1.005 | Card hover lift         |
| `transform.pressActive` | 0.97  | Button / card press     |
| `transform.enterFrom`   | 0.95  | Initial enter animation |

### Stagger

| Token          | Value | Use                               |
| -------------- | ----- | --------------------------------- |
| `stagger.list` | 0.04  | Bookmark grid mount, sidebar list |
| `stagger.hero` | 0.08  | Hero section sequence             |

### Reduced-motion helper

```ts
import { useReducedMotion } from "framer-motion";
import { spring, pickTransition } from "@/app/styles/motion";

const reduce = useReducedMotion() ?? false;
<motion.div transition={pickTransition(spring.gentle, reduce)} />
```

When `reduce === true`, `pickTransition` returns `{ duration: 0 }`. Global `prefers-reduced-motion` media query in `globals.css` collapses CSS-driven transitions too.

---

## 2. Color tokens (`app/globals.css`)

OKLCH used for perceptual uniformity. All values exposed as both CSS variables and Tailwind utilities via `@theme inline`.

### Surfaces

| Token              | Tailwind              | OKLCH (dark)   | OKLCH (light)  |
| ------------------ | --------------------- | -------------- | -------------- |
| `background`       | `bg-background`       | 0.13 0.012 264 | 0.98 0.003 264 |
| `surface`          | `bg-surface`          | 0.17 0.013 264 | 0.95 0.004 264 |
| `surface-elevated` | `bg-surface-elevated` | 0.21 0.013 264 | 0.92 0.005 264 |
| `surface-hover`    | `bg-surface-hover`    | 0.27 0.013 264 | 0.88 0.006 264 |

### Text

| Token               | Tailwind                 | Use                |
| ------------------- | ------------------------ | ------------------ |
| `foreground`        | `text-foreground`        | Primary body       |
| `foreground-muted`  | `text-foreground-muted`  | Secondary, labels  |
| `foreground-subtle` | `text-foreground-subtle` | Meta, low-emphasis |

### Borders

| Token           | Tailwind               |
| --------------- | ---------------------- |
| `border`        | `border-border`        |
| `border-strong` | `border-border-strong` |

### Accents

| Token           | Tailwind                              | Use                             |
| --------------- | ------------------------------------- | ------------------------------- |
| `accent-cyan`   | `text-accent-cyan` / `bg-accent-cyan` | Primary accent                  |
| `accent-blue`   | `text-accent-blue`                    | Interactive states, focus rings |
| `accent-orange` | `text-accent-orange`                  | Destructive / warning           |

### Tag palette (curated 8 — per ADR-005)

| Token         | Tailwind         | Suggested use  |
| ------------- | ---------------- | -------------- |
| `tag-cyan`    | `bg-tag-cyan`    | Reading / docs |
| `tag-blue`    | `bg-tag-blue`    | Tools          |
| `tag-orange`  | `bg-tag-orange`  | Inspiration    |
| `tag-emerald` | `bg-tag-emerald` | Code / dev     |
| `tag-violet`  | `bg-tag-violet`  | Design         |
| `tag-rose`    | `bg-tag-rose`    | Personal       |
| `tag-amber`   | `bg-tag-amber`   | Watch later    |
| `tag-zinc`    | `bg-tag-zinc`    | Archive        |

Users pick from these 8. No hex input UI. No freeform colors.

---

## 3. Typography

Geist (sans) + Geist Mono — wired in `app/layout.tsx` via `next/font/google`.

| Tailwind class | rem   | Use                                             |
| -------------- | ----- | ----------------------------------------------- |
| `text-xs`      | 0.75  | kbd, micro labels                               |
| `text-sm`      | 0.875 | secondary text                                  |
| `text-base`    | 1.0   | body                                            |
| `text-md`      | 1.125 | card titles (use `text-[1.125rem]` until added) |
| `text-lg`      | 1.125 | (Tailwind default lg = 1.125; keep)             |
| `text-xl`      | 1.25  | section headings                                |
| `text-2xl`     | 1.5   | page sub-titles                                 |
| `text-3xl`     | 1.875 | page titles                                     |

Weights: 400, 500, 600. No 700+ for UI.

---

## 4. Spacing & Layout

- 4px grid via Tailwind defaults.
- Containers: `mx-auto max-w-[1400px] px-6 lg:px-8`.
- Height: `min-h-[100dvh]`. Never `h-screen` (iOS Safari jump).

---

## 5. Radii

| Tailwind     | px  | Use                                 |
| ------------ | --- | ----------------------------------- |
| `rounded-md` | 6   | Inline elements, kbd, small buttons |
| `rounded-lg` | 8   | Cards, popovers, dropdowns          |
| `rounded-xl` | 12  | Dialogs, sheets                     |

Forbidden: `rounded-2xl` and larger on UI surfaces. Buttons may use `rounded-full` for icon-only circular variants (post-MVP).

---

## 6. Borders, shadows, focus

- Borders: `border-border` (subtle), `border-border-strong` (active state).
- Elevation: prefer `ring-1 ring-border` to drop shadows.
- Hover shadow on cards: `shadow-lg shadow-black/20` only.
- Focus: `focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-background`.

---

## 7. Primitives (`components/ui/*`)

| File                | Component       | Notes                                     |
| ------------------- | --------------- | ----------------------------------------- |
| `surface.tsx`       | `Surface`       | Flat container                            |
| `card.tsx`          | `Card`          | Hover lift, press scale, interactive prop |
| `icon-button.tsx`   | `IconButton`    | sm 32px / md 40px, aria-label required    |
| `kbd.tsx`           | `Kbd`           | Inline keyboard hint                      |
| `tooltip.tsx`       | `Tooltip*`      | Radix; group skipDelay 1500ms             |
| `popover.tsx`       | `Popover*`      | Radix; tag/color pickers                  |
| `dropdown-menu.tsx` | `DropdownMenu*` | Radix; card actions                       |
| `dialog.tsx`        | `Dialog*`       | Radix; modal forms                        |

Animations on Radix primitives use `tw-animate-css` utilities (`data-[state=open]:animate-in`, `fade-in-0`, `zoom-in-95`).

**Token reconciliation rule:** `duration-*` Tailwind utilities are permitted **only** when driving `tw-animate-css` keyframe animations on Radix `data-state` transitions, and **only** at token-aligned steps (100, 125, 150, 200, 300, 500ms). All Framer Motion / JS-driven motion must read from `motion.ts`.

---

## 8. Anti-slop checklist (active on every UI PR)

- [ ] No purple/pink gradients
- [ ] No `rounded-2xl` or larger on UI surfaces
- [ ] No glassmorphism overlay panels
- [ ] No emoji in code or visible strings
- [ ] No `h-screen` (use `min-h-[100dvh]`)
- [ ] No inline transition durations / easings outside `motion.ts`
- [ ] No `transition: all`
- [ ] No `scale(0)` (use `transform.enterFrom` 0.95 + opacity)
- [ ] No `ease-in` as default (use `ease.out`)
- [ ] No GSAP imports anywhere
- [ ] No raw Tailwind colors outside the locked palette (`zinc-500` etc.)
- [ ] No template-literal Tailwind classes like `bg-${name}` (JIT won't see them)
- [ ] Every animation site wraps with `useReducedMotion()`

---

## 9. Where this is verified

- **`/dev/preview`** — every primitive rendered on one page. Use it as the visual reference for all primitives.
