/**
 * LinkNest motion tokens — single source of truth.
 *
 * Rules (enforced by review + lint):
 *   - Never inline a duration, easing, or spring config outside this file.
 *   - Only animate `transform` + `opacity` (filter / clip-path also allowed).
 *   - Wrap every animation site with `useReducedMotion()` — see usage examples below.
 *   - No GSAP in the same component tree as Framer Motion.
 *
 * See ADR-002 (Animation System) and ADR-005 (Design Principles).
 */

/* ---------- Durations (seconds for Framer Motion) ---------- */

export const duration = {
  /** Micro: focus ring, button press feedback */
  instant: 0.1,
  /** Hover, tooltip in */
  fast: 0.125,
  /** Default UI transition: toggles, color shifts */
  base: 0.15,
  /** Card hover, dropdown open */
  medium: 0.2,
  /** Modal, drawer, page section reveal */
  slow: 0.3,
  /** Heavy reveals — hero, route transitions */
  emphasis: 0.5,
} as const;

export type Duration = keyof typeof duration;

/* ---------- Easings ---------- */

export const ease = {
  /**
   * Default UI easing. Strong overshoot front, slow settle — feels immediate
   * yet polished. Use for 95% of UI transitions.
   */
  out: [0.23, 1, 0.32, 1] as [number, number, number, number],

  /** Reversible transitions (e.g. accordion expand/collapse) */
  inOut: [0.77, 0, 0.175, 1] as [number, number, number, number],

  /** Drawer / sheet from edge — slow start, fast finish, smooth land */
  drawer: [0.32, 0.72, 0, 1] as [number, number, number, number],
} as const;

/* ---------- Springs (Framer Motion spring transitions) ---------- */

export const spring = {
  /**
   * Default UI spring. Gentle settle, no obvious bounce.
   * Use for: card hover, dropdown open, generic state transitions.
   */
  gentle: {
    type: "spring" as const,
    stiffness: 220,
    damping: 26,
  },

  /**
   * Snappy spring. Tight, decisive. Use for: button feedback,
   * toggle commits, "snap into place" interactions.
   */
  snappy: {
    type: "spring" as const,
    stiffness: 600,
    damping: 40,
  },

  /**
   * Drag spring. Follows pointer with some weight + dampens on release.
   * Use for: dnd-kit drag overlay, swipe gestures.
   */
  drag: {
    type: "spring" as const,
    stiffness: 500,
    damping: 35,
    mass: 0.6,
  },

  /**
   * Subtle bounce. Use for: emoji-free celebratory micro-moments
   * (e.g. successful bookmark save). Restrained — bounce 0.2 max.
   */
  bounce: {
    type: "spring" as const,
    duration: 0.5,
    bounce: 0.2,
  },
} as const;

export type SpringName = keyof typeof spring;

/* ---------- Stagger (for list mounts, group reveals) ---------- */

export const stagger = {
  /** 40ms between items — bookmark grid mount, sidebar list */
  list: 0.04,
  /** 80ms — hero section sequence */
  hero: 0.08,
} as const;

/* ---------- Transform values (forbidden-list reminder) ---------- */

/**
 * The allowed transform variations. Documented here for review tooling.
 * Use these as the SOURCE for hover/active/exit states in components.
 */
export const transform = {
  /** Hover lift — barely perceptible. Per ADR-005. */
  liftHover: 1.005,
  /** Active press — clearly tactile but never aggressive. */
  pressActive: 0.97,
  /** Initial state for enter animations. Never `scale(0)`. */
  enterFrom: 0.95,
} as const;

/* ---------- Reduced motion helpers ----------
 *
 * Usage:
 *   import { useReducedMotion } from "framer-motion";
 *   import { reducedMotionVariants, motionPropsFor } from "@/app/styles/motion";
 *
 *   function Card() {
 *     const reduce = useReducedMotion();
 *     return (
 *       <motion.div {...motionPropsFor("card-hover", reduce)}>
 *         …
 *       </motion.div>
 *     );
 *   }
 *
 * When `reduce === true`:
 *   - Durations collapse to 0
 *   - Springs become instant (no `transition` prop)
 *   - Only opacity changes survive (transform changes drop to identity)
 */

/* ---------- Keyframes (NEW — feature 01) ---------- */

/**
 * Long-running CSS-style keyframes used by motion.div animate prop.
 * Only animate `backgroundPosition`/`opacity`/`transform`-friendly props.
 */
export const keyframes = {
  shimmer: { backgroundPosition: ["200% 0", "-200% 0"] as [string, string] },
  iconFloat: { y: [0, -2, 0] as [number, number, number] },
} as const;

export const reducedMotionTransition = { duration: 0 } as const;

export function pickTransition<T>(
  motion: T,
  reduce: boolean
): T | typeof reducedMotionTransition {
  return reduce ? reducedMotionTransition : motion;
}
