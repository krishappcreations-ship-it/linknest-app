"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "@/app/styles/motion";
import { useStore } from "@/store";
import { closeMobileDrawer } from "@/store/slices/ui-slice";

interface Props {
  children: ReactNode;
}

function close() {
  useStore.setState((s) => ({ ui: closeMobileDrawer(s.ui) }));
}

export function MobileDrawer({ children }: Props) {
  const open = useStore((s) => s.ui.mobileDrawerOpen);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    // Lock background scroll so the page behind the drawer can't scroll/jump.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="md:hidden">
          <motion.div
            data-testid="drawer-backdrop"
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.base }}
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Library"
            className="border-border bg-surface fixed inset-y-0 left-0 z-50 w-[280px] overflow-y-auto border-r"
            initial={reduce ? { opacity: 0 } : { x: "-100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "-100%" }}
            transition={
              reduce
                ? { duration: duration.base }
                : { duration: duration.slow, ease: ease.drawer }
            }
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
