"use client";

import { motion, useReducedMotion } from "framer-motion";
import { duration, ease, stagger } from "@/app/styles/motion";
// Hero entrance uses `slow` (300ms) per item, not `emphasis` (500ms): with the
// stagger the CTAs need to land fast on first paint (perceived speed).
import { AuthCtas } from "./auth-ctas";
import { LogoMark } from "@/components/brand/logo-mark";

/**
 * Left hero column — brand, headline, subhead, CTAs — with a one-shot entrance
 * stagger. Isolated client leaf (the right-side AppPreview stays a server
 * component). Motion collapses to a static render under prefers-reduced-motion.
 * transform + opacity only.
 */
export function HeroContent() {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : stagger.hero },
    },
  };
  const item = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: duration.slow, ease: ease.out },
        },
      };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col items-start"
    >
      <motion.div
        variants={item}
        className="text-foreground-muted mb-6 inline-flex items-center gap-2 text-sm font-medium"
      >
        <LogoMark className="size-7" gradientId="ln-logo-hero" />
        <span className="text-foreground tracking-tight">LinkNest</span>
      </motion.div>

      <motion.h1
        variants={item}
        className="text-foreground max-w-[18ch] text-4xl leading-none font-semibold tracking-tighter text-balance md:text-6xl"
      >
        Save beautifully.{" "}
        <span className="text-accent-cyan">Find instantly.</span>
      </motion.h1>

      <motion.p
        variants={item}
        className="text-foreground-muted mt-6 max-w-[52ch] text-base leading-relaxed"
      >
        LinkNest turns every saved link into a visual card — folders, tags, and
        instant search. Switch layouts, read distraction-free, and keep
        everything in sync. Works offline.
      </motion.p>

      <motion.div variants={item} className="mt-8">
        <AuthCtas />
      </motion.div>
    </motion.div>
  );
}
