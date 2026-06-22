"use client";

import { useId } from "react";
import { FolderPseudoRow } from "@/components/folders/folder-pseudo-row";
import { ReadingFilterRow } from "@/components/reading/reading-filter-row";
import { BrokenLinksRow } from "@/components/reading/broken-links-row";
import { FolderTree } from "@/components/folders/folder-tree";
import { NewFolderButton } from "@/components/folders/new-folder-button";
import { TagSidebarSection } from "@/components/tags/tag-sidebar-section";
import { SmartCollectionsSection } from "@/components/collections/smart-collections-section";
import { AuthButton } from "@/components/sidebar/auth-button";
import { SyncStatusDot } from "@/components/sidebar/sync-status-dot";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoMark } from "@/components/brand/logo-mark";
import { RefreshPreviewsButton } from "@/components/sidebar/refresh-previews-button";
import { PromptsFilterRow } from "@/components/layout/prompts-filter-row";
import { PromptCategoriesSection } from "@/components/prompts/prompt-categories-section";
import { useStore } from "@/store";
import { openImportExportDialog } from "@/store/slices/ui-slice";

export function Sidebar() {
  const promptsActive = useStore((s) => s.ui.selectedKindFilter === "prompt");
  // Unique per instance: AppShell renders Sidebar twice (desktop aside +
  // mobile drawer). A shared gradient id would duplicate the SVG <linearGradient>
  // and the drawer logo (resolving to the def inside the display:none aside)
  // renders blank on Chromium/Brave. useId gives each instance its own id.
  const gradientId = `ln-logo-${useId().replace(/:/g, "")}`;
  return (
    <nav
      aria-label="Library"
      className="flex h-full min-h-[100dvh] flex-col gap-1 p-3"
    >
      <div className="flex items-center justify-between px-3 pt-2 pb-5">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark className="size-6" gradientId={gradientId} />
          LinkNest
        </div>
        <ThemeToggle />
      </div>

      <FolderPseudoRow kind="all" label="All bookmarks" />
      <FolderPseudoRow kind="unfiled" label="Unfiled" />

      <div className="text-foreground-subtle px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wider uppercase">
        Reading
      </div>

      <ReadingFilterRow state="inbox" label="Inbox" />
      <ReadingFilterRow state="reading" label="Reading" />
      <ReadingFilterRow state="finished" label="Finished" />
      <ReadingFilterRow state="archived" label="Archived" />
      <BrokenLinksRow />

      <div className="text-foreground-subtle px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wider uppercase">
        Prompts
      </div>
      <PromptsFilterRow />
      {promptsActive && <PromptCategoriesSection />}

      <div className="text-foreground-subtle px-3 pt-5 pb-2 text-[11px] font-semibold tracking-wider uppercase">
        Folders
      </div>

      <FolderTree />

      <NewFolderButton />

      <TagSidebarSection />

      <SmartCollectionsSection />

      <div className="border-border mt-auto border-t pt-2">
        <button
          type="button"
          onClick={() =>
            useStore.setState((s) => ({ ui: openImportExportDialog(s.ui) }))
          }
          className="text-foreground-muted hover:bg-surface-hover hover:text-foreground flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="size-4"
            aria-hidden
          >
            <path
              d="M8 2v7M5 6l3 3 3-3M3 12.5h10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Import / Export
        </button>
        <RefreshPreviewsButton />
        <SyncStatusDot />
        <AuthButton />
      </div>
    </nav>
  );
}
