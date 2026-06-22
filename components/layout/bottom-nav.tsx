"use client";

import { useStore } from "@/store";
import {
  openCommandPalette,
  openMobileDrawer,
  setFolderFilter,
} from "@/store/slices/ui-slice";
import { AddMenu } from "./add-menu";

export function BottomNav() {
  const isAllActive = useStore((s) => s.ui.selectedFolderFilter.kind === "all");
  const isDrawerOpen = useStore((s) => s.ui.mobileDrawerOpen);

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-30 flex md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <button
        type="button"
        aria-label="All bookmarks"
        data-active={isAllActive || undefined}
        onClick={() =>
          useStore.setState((s) => ({
            ui: setFolderFilter(s.ui, { kind: "all" }),
          }))
        }
        className="data-[active=true]:text-accent-blue text-foreground-subtle flex h-14 flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150 active:scale-[0.97]"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="size-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"
          />
        </svg>
        <span className="text-[10px] font-medium">All</span>
      </button>

      <button
        type="button"
        aria-label="Search"
        onClick={() =>
          useStore.setState((s) => ({ ui: openCommandPalette(s.ui) }))
        }
        className="text-foreground-subtle flex h-14 flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150 active:scale-[0.97]"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="size-5"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-[10px] font-medium">Search</span>
      </button>

      <AddMenu variant="fab" />

      <button
        type="button"
        aria-label="Folders"
        data-active={isDrawerOpen || undefined}
        onClick={() =>
          useStore.setState((s) => ({ ui: openMobileDrawer(s.ui) }))
        }
        className="data-[active=true]:text-accent-blue text-foreground-subtle flex h-14 flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150 active:scale-[0.97]"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="size-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
          />
        </svg>
        <span className="text-[10px] font-medium">Folders</span>
      </button>
    </nav>
  );
}
