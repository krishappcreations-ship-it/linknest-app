"use client";

import {
  PlusIcon,
  MagnifyingGlassIcon,
  DotsHorizontalIcon,
  TrashIcon,
  Pencil1Icon,
  BookmarkIcon,
} from "@radix-ui/react-icons";
import { Card } from "@/components/ui/card";
import { Surface } from "@/components/ui/surface";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookmarkCard } from "@/components/cards/bookmark-card";
import { BookmarkSkeleton } from "@/components/cards/bookmark-skeleton";
import { BookmarkEmpty } from "@/components/cards/bookmark-empty";
import { ToastItem } from "@/components/toasts/toast-item";
import { asBookmarkId, asTagId, type Bookmark } from "@/types";
import { TagChip } from "@/components/tags/tag-chip";
import type { Toast } from "@/store/slices/ui-slice";

/**
 * /dev/preview — primitive showcase used to verify the design system
 * before any feature work.
 * Not part of the production build — hide via middleware in Phase 8.
 */

export default function PreviewPage() {
  return (
    <TooltipProvider>
      <main className="mx-auto max-w-[1400px] px-6 py-12 lg:px-8">
        <header className="mb-12">
          <p className="text-foreground-subtle font-mono text-xs tracking-wider uppercase">
            LinkNest · Design System
          </p>
          <h1 className="text-foreground mt-2 text-2xl font-semibold">
            Primitive showcase
          </h1>
          <p className="text-foreground-muted mt-2 max-w-prose text-sm">
            Phase 2 deliverable. Every primitive listed here ships with motion
            tokens from <code className="font-mono">app/styles/motion.ts</code>{" "}
            and styling tokens from{" "}
            <code className="font-mono">app/globals.css</code>. Run the motion +
            component reference before merging.
          </p>
        </header>

        <Section title="Surfaces">
          <div className="grid grid-cols-2 gap-4">
            <Surface className="p-6">
              <SectionLabel>Surface</SectionLabel>
              <p className="text-foreground-muted mt-2 text-sm">
                Flat container. No elevation, no hover.
              </p>
            </Surface>
            <Card>
              <SectionLabel>Card</SectionLabel>
              <p className="text-foreground-muted mt-2 text-sm">
                Hover lifts 0.5%. Press scales to 0.97. Spring gentle.
              </p>
            </Card>
          </div>
        </Section>

        <Section title="Icon buttons">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton size="sm" aria-label="Add bookmark">
                  <PlusIcon />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent>Add bookmark</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton size="md" aria-label="Search">
                  <MagnifyingGlassIcon />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent>
                Search <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton size="md" aria-label="More actions">
                  <DotsHorizontalIcon />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>
          </div>
        </Section>

        <Section title="Keyboard hints">
          <div className="flex items-center gap-2">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <span className="text-foreground-muted text-sm">
              opens the command palette
            </span>
          </div>
        </Section>

        <Section title="Popover (Tag picker preview)">
          <Popover>
            <PopoverTrigger asChild>
              <IconButton aria-label="Pick a color">
                <BookmarkIcon className="text-accent-cyan" />
              </IconButton>
            </PopoverTrigger>
            <PopoverContent>
              <p className="text-foreground-muted mb-2 px-1 text-xs">
                Tag color
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  "bg-tag-cyan",
                  "bg-tag-blue",
                  "bg-tag-orange",
                  "bg-tag-emerald",
                  "bg-tag-violet",
                  "bg-tag-rose",
                  "bg-tag-amber",
                  "bg-tag-zinc",
                ].map((c) => (
                  <button
                    key={c}
                    aria-label={c}
                    className={`hover:ring-foreground/30 h-7 w-7 rounded-md ring-1 ring-transparent transition-shadow ${c}`}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </Section>

        <Section title="Dropdown menu">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="Bookmark actions">
                <DotsHorizontalIcon />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Pencil1Icon className="text-foreground-muted h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BookmarkIcon className="text-foreground-muted h-3.5 w-3.5" />
                Move to folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-accent-orange focus:text-accent-orange">
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section title="Dialog">
          <Dialog>
            <DialogTrigger asChild>
              <IconButton aria-label="Open Add Bookmark">
                <PlusIcon />
              </IconButton>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle className="text-base font-semibold">
                Add bookmark
              </DialogTitle>
              <DialogDescription className="text-foreground-muted mt-2 text-sm">
                Preview component. Real form lives in feature 01.
              </DialogDescription>
            </DialogContent>
          </Dialog>
        </Section>

        <Section title="Feature 01 — bookmark grid empty state">
          <div className="border-border bg-background overflow-hidden rounded-lg border">
            <BookmarkEmpty />
          </div>
        </Section>

        <Section title="Feature 01 — bookmark card variants">
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-4">
            <BookmarkCard
              bookmark={MOCK_BOOKMARK_READY}
              isSelected={false}
              isFocused={false}
              onToggle={() => {}}
            />
            <BookmarkCard
              bookmark={MOCK_BOOKMARK_SELECTED}
              isSelected
              isFocused={false}
              onToggle={() => {}}
            />
            <BookmarkCard
              bookmark={MOCK_BOOKMARK_FOCUSED}
              isSelected={false}
              isFocused
              onToggle={() => {}}
            />
            <BookmarkSkeleton />
          </div>
        </Section>

        <Section title="Feature 01 — toast region states (rendered statically)">
          <div className="flex flex-col items-end gap-2">
            <ToastItem toast={MOCK_TOAST_UNDO} />
            <ToastItem toast={MOCK_TOAST_VIEW} />
            <ToastItem toast={MOCK_TOAST_ERROR} />
          </div>
        </Section>

        {/* Feature 02 — preview pipeline states */}
        <section className="mb-12 space-y-3">
          <h2 className="text-foreground-muted mb-4 font-mono text-xs tracking-wider uppercase">
            Feature 02 — preview pipeline states
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <BookmarkCard
              bookmark={{
                id: asBookmarkId("bk_dev_pending"),
                url: "https://example.com/loading",
                title: "Loading preview",
                description: null,
                previewImageUrl: null,
                faviconUrl: null,
                domain: "example.com",
                previewStatus: "pending",
                previewFailureKind: null,
                previewAttempt: 0,
                readState: "inbox",
                linkStatus: "unknown",
                linkCheckedAt: null,
                linkRedirectUrl: null,
                captureStatus: "pending",
                captureFailureKind: null,
                captureAttempt: 0,
                readProgress: 0,
                folderId: null,
                tagIds: [],
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null,
              }}
              isSelected={false}
              isFocused={false}
              onToggle={() => {}}
            />
            {/* ready w/ full og:image */}
            <BookmarkCard
              bookmark={{
                id: asBookmarkId("bk_dev_ready_full"),
                url: "https://example.com/ready-full",
                title: "Ready with full og:image",
                description: "An article with rich preview metadata.",
                previewImageUrl: "https://picsum.photos/seed/og/640/360",
                faviconUrl:
                  "https://www.google.com/s2/favicons?domain=example.com&sz=64",
                domain: "example.com",
                previewStatus: "ready",
                previewFailureKind: null,
                previewAttempt: 0,
                readState: "inbox",
                linkStatus: "unknown",
                linkCheckedAt: null,
                linkRedirectUrl: null,
                captureStatus: "pending",
                captureFailureKind: null,
                captureAttempt: 0,
                readProgress: 0,
                folderId: null,
                tagIds: [],
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null,
              }}
              isSelected={false}
              isFocused={false}
              onToggle={() => {}}
            />
            {/* ready w/ favicon only */}
            <BookmarkCard
              bookmark={{
                id: asBookmarkId("bk_dev_ready_fav"),
                url: "https://docs.example.com/page",
                title: "Docs page (no og:image)",
                description: null,
                previewImageUrl: null,
                faviconUrl:
                  "https://www.google.com/s2/favicons?domain=docs.example.com&sz=64",
                domain: "docs.example.com",
                previewStatus: "ready",
                previewFailureKind: null,
                previewAttempt: 0,
                readState: "inbox",
                linkStatus: "unknown",
                linkCheckedAt: null,
                linkRedirectUrl: null,
                captureStatus: "pending",
                captureFailureKind: null,
                captureAttempt: 0,
                readProgress: 0,
                folderId: null,
                tagIds: [],
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null,
              }}
              isSelected={false}
              isFocused={false}
              onToggle={() => {}}
            />
            {/* ready w/ initials fallback */}
            <BookmarkCard
              bookmark={{
                id: asBookmarkId("bk_dev_ready_initials"),
                url: "https://bare.example.com",
                title: "Bare page",
                description: null,
                previewImageUrl: null,
                faviconUrl: null,
                domain: "bare.example.com",
                previewStatus: "ready",
                previewFailureKind: null,
                previewAttempt: 0,
                readState: "inbox",
                linkStatus: "unknown",
                linkCheckedAt: null,
                linkRedirectUrl: null,
                captureStatus: "pending",
                captureFailureKind: null,
                captureAttempt: 0,
                readProgress: 0,
                folderId: null,
                tagIds: [],
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null,
              }}
              isSelected={false}
              isFocused={false}
              onToggle={() => {}}
            />
            {/* failed transient */}
            <BookmarkCard
              bookmark={{
                id: asBookmarkId("bk_dev_failed_t"),
                url: "https://timeout.example.com",
                title: "timeout.example.com",
                description: null,
                previewImageUrl: null,
                faviconUrl: null,
                domain: "timeout.example.com",
                previewStatus: "failed",
                previewFailureKind: "transient",
                previewAttempt: 1,
                readState: "inbox",
                linkStatus: "unknown",
                linkCheckedAt: null,
                linkRedirectUrl: null,
                captureStatus: "pending",
                captureFailureKind: null,
                captureAttempt: 0,
                readProgress: 0,
                folderId: null,
                tagIds: [],
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null,
              }}
              isSelected={false}
              isFocused={false}
              onToggle={() => {}}
            />
            {/* failed permanent */}
            <BookmarkCard
              bookmark={{
                id: asBookmarkId("bk_dev_failed_p"),
                url: "http://localhost:5432",
                title: "localhost:5432",
                description: null,
                previewImageUrl: null,
                faviconUrl: null,
                domain: "localhost",
                previewStatus: "failed",
                previewFailureKind: "permanent",
                previewAttempt: 0,
                readState: "inbox",
                linkStatus: "unknown",
                linkCheckedAt: null,
                linkRedirectUrl: null,
                captureStatus: "pending",
                captureFailureKind: null,
                captureAttempt: 0,
                readProgress: 0,
                folderId: null,
                tagIds: [],
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null,
              }}
              isSelected={false}
              isFocused={false}
              onToggle={() => {}}
            />
          </div>
        </section>

        <Section title="Color tokens (visual sanity check)">
          <div className="grid grid-cols-4 gap-3">
            <Swatch name="background" />
            <Swatch name="surface" />
            <Swatch name="surface-elevated" />
            <Swatch name="surface-hover" />
            <Swatch name="accent-cyan" />
            <Swatch name="accent-blue" />
            <Swatch name="accent-orange" />
            <Swatch name="foreground" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              "tag-cyan",
              "tag-blue",
              "tag-orange",
              "tag-emerald",
              "tag-violet",
              "tag-rose",
              "tag-amber",
              "tag-zinc",
            ].map((t) => (
              <Swatch key={t} name={t} />
            ))}
          </div>
        </Section>

        {/* Feature 03 — folder system states */}
        <section className="mb-12 space-y-3">
          <h2 className="text-foreground-subtle font-mono text-xs tracking-wider uppercase">
            Feature 03 — folder states
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="border-border bg-surface rounded-lg border p-3">
              <div className="text-foreground-subtle pb-2 text-[11px] font-semibold uppercase">
                Sidebar tree (mock)
              </div>
              {[
                {
                  name: "Tools",
                  depth: 0,
                  pinned: true,
                  hasChildren: true,
                  collapsed: false,
                },
                {
                  name: "AI",
                  depth: 1,
                  pinned: false,
                  hasChildren: true,
                  collapsed: false,
                },
                {
                  name: "GPT",
                  depth: 2,
                  pinned: false,
                  hasChildren: false,
                  collapsed: false,
                },
                {
                  name: "Personal",
                  depth: 0,
                  pinned: false,
                  hasChildren: true,
                  collapsed: true,
                },
              ].map((r) => (
                <div
                  key={r.name}
                  className="text-foreground-muted flex items-center gap-1.5 rounded-md py-1 pr-2 text-sm"
                  style={{ paddingLeft: `${8 + r.depth * 14}px` }}
                >
                  {r.hasChildren && (
                    <svg
                      aria-hidden
                      viewBox="0 0 12 12"
                      className={`size-2.5 ${r.collapsed ? "" : "rotate-90"}`}
                      fill="currentColor"
                    >
                      <path d="M4 2l4 4-4 4z" />
                    </svg>
                  )}
                  {r.pinned && (
                    <svg
                      aria-hidden
                      viewBox="0 0 12 12"
                      className="text-accent-blue size-3"
                      fill="currentColor"
                    >
                      <path d="M6 1l1.5 3.5L11 5.5 8.5 8 9 11l-3-1.5L3 11l.5-3L1 5.5l3.5-1L6 1z" />
                    </svg>
                  )}
                  <span className="flex-1">{r.name}</span>
                </div>
              ))}
            </div>

            <div className="border-border bg-surface rounded-lg border p-3">
              <div className="text-foreground-subtle pb-2 text-[11px] font-semibold uppercase">
                Inline editor states
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <input
                  type="text"
                  defaultValue=""
                  placeholder="New folder name"
                  className="border-accent-blue bg-background text-foreground rounded-sm border px-1.5 py-0.5 outline-none"
                />
                <input
                  type="text"
                  defaultValue="Tools (rename mode)"
                  className="border-accent-blue bg-background text-foreground rounded-sm border px-1.5 py-0.5 outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Feature 04 — tag system states */}
        <section className="mb-12 space-y-3">
          <h2 className="text-foreground-subtle font-mono text-xs tracking-wider uppercase">
            Feature 04 — tag states
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="border-border bg-surface rounded-lg border p-3">
              <div className="text-foreground-subtle pb-2 text-[11px] font-semibold uppercase">
                Chip sizes
              </div>
              <div className="flex flex-col gap-2">
                {(["sm", "md", "lg"] as const).map((size) => (
                  <div
                    key={size}
                    className="flex flex-wrap items-center gap-1.5"
                  >
                    <TagChip
                      tag={{
                        id: asTagId("tag_demo"),
                        name: "AI",
                        color: "blue",
                        createdAt: 1,
                        updatedAt: 1,
                        deletedAt: null,
                      }}
                      size={size}
                    />
                    <TagChip
                      tag={{
                        id: asTagId("tag_demo2"),
                        name: "Tools",
                        color: "emerald",
                        createdAt: 1,
                        updatedAt: 1,
                        deletedAt: null,
                      }}
                      size={size}
                    />
                    <TagChip
                      tag={{
                        id: asTagId("tag_demo3"),
                        name: "Personal",
                        color: "rose",
                        createdAt: 1,
                        updatedAt: 1,
                        deletedAt: null,
                      }}
                      size={size}
                      onRemove={size === "md" ? () => {} : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-border bg-surface rounded-lg border p-3">
              <div className="text-foreground-subtle pb-2 text-[11px] font-semibold uppercase">
                Sidebar rows (mock)
              </div>
              {[
                { name: "AI", color: "blue", count: 12 },
                { name: "Tools", color: "emerald", count: 4 },
                { name: "Reading list", color: "amber", count: 28 },
                { name: "Watch later", color: "violet", count: 0 },
              ].map((r) => (
                <div
                  key={r.name}
                  className="text-foreground-muted flex items-center gap-2 rounded-md px-3 py-1 text-sm"
                >
                  <span
                    aria-hidden
                    className={`size-2 shrink-0 rounded-full bg-tag-${r.color}`}
                  />
                  <span className="flex-1">{r.name}</span>
                  <span className="text-foreground-subtle text-xs tabular-nums">
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 05 — Drag states
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Idle card
              </p>
              <div className="border-border bg-surface rounded-lg border p-3 text-sm">
                Anthropic — anthropic.com
              </div>
            </div>

            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Dragging (original in place)
              </p>
              <div
                className="border-border bg-surface rounded-lg border p-3 text-sm opacity-50"
                style={{ scale: "0.97" }}
              >
                Anthropic — anthropic.com
              </div>
            </div>

            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Drag overlay clone
              </p>
              <div
                className="border-border bg-surface rounded-lg border p-3 text-sm shadow-2xl"
                style={{ scale: "0.97" }}
              >
                Anthropic — anthropic.com
              </div>
            </div>

            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Folder swell (drop target)
              </p>
              <div className="relative rounded-md border border-transparent p-2 text-sm">
                <div
                  className="bg-accent-blue/10 ring-accent-blue/40 absolute inset-0 rounded-md ring-2"
                  style={{ scale: "1.02" }}
                />
                <span className="relative">Work</span>
              </div>
            </div>

            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Folder drop disabled (depth cap)
              </p>
              <div className="text-foreground-muted rounded-md border border-transparent p-2 text-sm opacity-50">
                Work › Projects › Q3 (max depth)
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 06 — Command palette
          </h2>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Zero state (palette just opened)
              </p>
              <div className="border-border bg-surface mx-auto max-w-[640px] overflow-hidden rounded-xl border shadow-2xl shadow-black/50">
                <div className="border-border flex h-12 items-center gap-2 border-b px-3">
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="text-foreground-subtle size-4"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <span className="text-foreground-subtle flex-1 text-sm">
                    Search bookmarks or run a command…
                  </span>
                  <kbd className="border-border bg-surface-elevated text-foreground-subtle rounded border px-1.5 py-px font-mono text-[10px]">
                    ESC
                  </kbd>
                </div>
                <div className="space-y-1 p-1.5">
                  <div className="text-foreground-subtle px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                    Actions
                  </div>
                  {["Add bookmark", "New folder", "Clear filters"].map((a) => (
                    <div
                      key={a}
                      className="text-foreground-muted flex h-9 items-center gap-2.5 rounded-md px-3 text-sm"
                    >
                      {a}
                    </div>
                  ))}
                  <div className="text-foreground-subtle px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                    Navigation
                  </div>
                  {["Go to Work", "Filter by AI", "Filter by Safety"].map(
                    (n) => (
                      <div
                        key={n}
                        className="text-foreground-muted flex h-9 items-center gap-2.5 rounded-md px-3 text-sm"
                      >
                        {n}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Typed query — "anth" (keyboard-selected first row)
              </p>
              <div className="border-border bg-surface mx-auto max-w-[640px] overflow-hidden rounded-xl border shadow-2xl shadow-black/50">
                <div className="border-border flex h-12 items-center gap-2 border-b px-3">
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="text-foreground-subtle size-4"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <span className="text-foreground flex-1 text-sm">anth</span>
                  <kbd className="border-border bg-surface-elevated text-foreground-subtle rounded border px-1.5 py-px font-mono text-[10px]">
                    ESC
                  </kbd>
                </div>
                <div className="space-y-1 p-1.5">
                  <div className="text-foreground-subtle px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                    Bookmarks
                  </div>
                  <div className="bg-surface-hover text-foreground flex h-9 items-center gap-2.5 rounded-md px-3 text-sm">
                    Home \ Anthropic — anthropic.com
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 07 — Layout modes
          </h2>

          <div className="space-y-6">
            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Layout switcher (segmented control)
              </p>
              <div className="border-border bg-surface inline-flex gap-0.5 rounded-md border p-0.5">
                <button className="bg-foreground/10 text-foreground flex h-7 items-center rounded px-2 text-xs">
                  ▦
                </button>
                <button className="text-foreground-subtle flex h-7 items-center rounded px-2 text-xs">
                  ≡
                </button>
                <button className="text-foreground-subtle flex h-7 items-center rounded px-2 text-xs">
                  ▢
                </button>
              </div>
            </div>

            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                List layout — row
              </p>
              <div className="border-border bg-surface flex h-12 items-center gap-3 rounded-md border px-3">
                <span className="bg-surface-elevated size-4 rounded" />
                <span className="text-foreground flex-1 text-sm font-medium">
                  Home \ Anthropic
                </span>
                <span className="text-foreground-subtle text-xs">
                  anthropic.com · 2d
                </span>
              </div>
            </div>

            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Gallery layout — card
              </p>
              <div className="border-border bg-surface w-72 overflow-hidden rounded-lg border">
                <div className="from-surface-hover to-surface-elevated aspect-[4/3] bg-gradient-to-br" />
                <div className="p-4">
                  <p className="text-foreground-subtle text-xs">
                    anthropic.com · 2d
                  </p>
                  <h3 className="text-foreground text-base font-semibold">
                    Home \ Anthropic
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 22 — Read-later workflow
          </h2>

          <div className="space-y-6">
            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Sidebar Reading section (states + counts)
              </p>
              <div className="border-border bg-surface w-56 space-y-0.5 rounded-md border p-2">
                {[
                  ["Inbox", 3, true],
                  ["Reading", 1, false],
                  ["Finished", 5, false],
                  ["Archived", 2, false],
                ].map(([label, count, active]) => (
                  <div
                    key={label as string}
                    data-active={(active as boolean) || undefined}
                    className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground text-foreground-muted flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
                  >
                    <span className="flex-1">{label as string}</span>
                    <span className="text-foreground-subtle text-xs tabular-nums">
                      {count as number}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Card menu — read-state transitions (for an inbox bookmark)
              </p>
              <div className="border-border bg-surface inline-flex flex-col rounded-md border py-1 text-sm">
                {["Move to Reading", "Mark finished", "Archive"].map((l) => (
                  <span
                    key={l}
                    className="text-foreground hover:bg-surface-hover px-3 py-1.5"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 23 — article capture
          </h2>
          <div className="border-border bg-surface w-64 space-y-0.5 rounded-md border p-2">
            {[
              ["pending", "Capturing…"],
              ["ready", "Readable snapshot saved"],
              ["failed", "Not an article"],
              ["failed", "Capture failed (will retry)"],
            ].map(([status, label], i) => (
              <div
                key={i}
                className="text-foreground-muted flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    status === "ready"
                      ? "bg-tone-success"
                      : status === "pending"
                        ? "bg-foreground-subtle"
                        : "bg-tone-error"
                  }`}
                />
                <span className="flex-1">{label as string}</span>
                <span className="text-foreground-subtle font-mono text-[10px]">
                  {status as string}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 24 — reader mode
          </h2>
          <div className="space-y-4">
            <div className="border-border bg-surface inline-flex flex-col gap-3 rounded-md border p-3">
              <p className="text-foreground-subtle text-xs uppercase">
                Typography controls
              </p>
              {[
                ["Size", ["S", "M", "L"], "M"],
                ["Font", ["Serif", "Sans"], "Serif"],
                ["Width", ["Narrow", "Normal", "Wide"], "Normal"],
              ].map(([label, opts, active]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-foreground-muted text-xs">
                    {label as string}
                  </span>
                  <div className="border-border bg-surface inline-flex gap-0.5 rounded-md border p-0.5">
                    {(opts as string[]).map((o) => (
                      <span
                        key={o}
                        data-active={o === active || undefined}
                        className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground text-foreground-subtle flex h-6 items-center rounded px-2 text-xs"
                      >
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-border bg-surface max-w-[42rem] rounded-md border p-6">
              <h1 className="text-foreground text-2xl font-bold tracking-tight">
                Sample article headline
              </h1>
              <p className="text-foreground-subtle mt-1 text-xs">
                Jane Doe · example.com · 7 min read
              </p>
              <p className="text-foreground-muted mt-4 leading-relaxed">
                Reader prose renders here in a centered measure column with
                serif typography, theme-aware tokens, and restored scroll
                position. Controls above persist via preferences.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 25 — AI summary
          </h2>
          <div className="border-border bg-surface max-w-2xl rounded-lg border p-4">
            <p className="text-foreground-subtle mb-2 text-[11px] font-medium tracking-wider uppercase">
              Summary
            </p>
            <p className="text-foreground text-sm leading-relaxed">
              This article argues that durable note-taking compounds over years,
              and that retrieval — not capture — is the real bottleneck.
            </p>
            <ul className="text-foreground-muted mt-3 space-y-1.5 text-sm">
              {[
                "Capture is cheap; retrieval is the constraint.",
                "Atomic notes with links beat folders at scale.",
                "Summaries restore context months later.",
              ].map((p) => (
                <li key={p} className="flex gap-2">
                  <span aria-hidden className="text-foreground-subtle">
                    •
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 27 — smart collections
          </h2>
          <div className="flex flex-wrap gap-6">
            <div className="border-border bg-surface w-56 space-y-0.5 rounded-md border p-2">
              <p className="text-foreground-subtle px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                Smart Collections
              </p>
              {[
                ["Untagged", 4, false],
                ["Long inbox reads", 2, true],
                ["Saved this week", 7, false],
              ].map(([label, n, active]) => (
                <div
                  key={label as string}
                  data-active={(active as boolean) || undefined}
                  className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground text-foreground-muted flex items-center gap-2 rounded-md px-3 py-1.5 text-sm"
                >
                  <span className="flex-1">{label as string}</span>
                  <span className="text-foreground-subtle text-xs tabular-nums">
                    {n as number}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-border bg-surface w-80 space-y-2 rounded-md border p-3">
              <p className="text-foreground-subtle text-xs uppercase">
                Builder — predicate rows
              </p>
              <input
                readOnly
                value="Long inbox reads"
                className="border-border bg-surface text-foreground w-full rounded-md border px-3 py-2 text-sm"
              />
              {["Read state · inbox", "Reading time ≥ · 10"].map((r) => (
                <div
                  key={r}
                  className="border-border bg-surface-elevated text-foreground-muted rounded-md border px-2 py-1 text-xs"
                >
                  {r}
                </div>
              ))}
              <span className="text-foreground-muted text-sm">+ Add rule</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 28 — semantic search
          </h2>
          <p className="text-foreground-muted text-sm">
            Hybrid retrieval: keyword hits in “Bookmarks”, meaning-based hits in
            “Related” (cosine over local embeddings, keyword ids excluded).
          </p>
          <div className="border-border bg-surface w-[420px] overflow-hidden rounded-xl border shadow-2xl shadow-black/40">
            <div className="border-border flex h-11 items-center gap-2 border-b px-3">
              <span className="text-foreground-subtle text-sm">⌕</span>
              <span className="text-foreground text-sm">
                offline-first sync
              </span>
            </div>
            <div className="space-y-1.5 p-1.5">
              <p className="text-foreground-subtle px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                Bookmarks
              </p>
              {["Building offline-first apps", "Sync conflict resolution"].map(
                (label) => (
                  <div
                    key={label}
                    className="text-foreground-muted flex h-9 items-center gap-2.5 rounded-md px-3 text-sm"
                  >
                    <span className="bg-surface-hover inline-block size-4 rounded-sm" />
                    <span className="truncate">{label}</span>
                  </div>
                )
              )}
              <p className="text-foreground-subtle px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider uppercase">
                Related
              </p>
              {[
                "CRDTs explained",
                "Local-first software (Ink & Switch)",
                "IndexedDB durability notes",
              ].map((label) => (
                <div
                  key={label}
                  className="text-foreground-muted flex h-9 items-center gap-2.5 rounded-md px-3 text-sm"
                >
                  <span className="bg-surface-hover inline-block size-4 rounded-sm" />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 29 — duplicate &amp; similar
          </h2>
          <p className="text-foreground-muted text-sm">
            Canonical-URL dedup catches utm/fbclid/fragment variants at save
            time; the “N similar” pill opens an embedding-similarity grid view.
          </p>
          <div className="flex flex-wrap gap-6">
            <div className="border-border bg-surface w-72 rounded-md border p-3 text-sm">
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Duplicate toast
              </p>
              <div className="border-border bg-surface-elevated flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="text-foreground-muted flex-1">
                  Already saved
                </span>
                <span className="text-accent-blue text-xs font-medium">
                  View
                </span>
              </div>
            </div>
            <div className="w-72 space-y-3">
              <div className="border-border bg-surface-elevated flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="text-foreground-muted">
                  Showing 3 similar to{" "}
                  <span className="text-foreground font-medium">
                    “Local-first software”
                  </span>
                </span>
                <span className="text-foreground-subtle ml-auto">Clear</span>
              </div>
              <div className="border-border bg-surface rounded-md border p-3">
                <div className="text-foreground-subtle flex items-center gap-1.5 text-[11px]">
                  <span className="bg-surface-hover inline-block size-4 rounded-sm" />
                  inkandswitch.com · 2d ago
                  <span className="border-border text-foreground-subtle ml-auto rounded-full border px-2 py-0.5">
                    3 similar
                  </span>
                </div>
                <p className="text-foreground mt-2 text-sm font-medium">
                  CRDTs explained
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 30 — notes &amp; highlights
          </h2>
          <p className="text-foreground-muted text-sm">
            A synced per-bookmark note plus local-only text highlights anchored
            in the captured article (4 colors, optional per-highlight
            annotation, resolved via text-quote + context).
          </p>
          <div className="flex flex-wrap gap-6">
            <div className="w-80 space-y-3">
              <p className="text-foreground-subtle text-xs uppercase">
                Highlighted text
              </p>
              <p className="text-foreground text-sm leading-relaxed">
                The best way to predict the future is to{" "}
                <mark className="rounded-[2px] bg-[rgba(250,204,21,0.32)] text-inherit">
                  invent it
                </mark>
                . Local-first software keeps your{" "}
                <mark className="rounded-[2px] bg-[rgba(96,165,250,0.32)] text-inherit [border-bottom:2px_dotted_currentColor]">
                  data on the device
                </mark>{" "}
                you own.
              </p>
            </div>
            <div className="w-64 space-y-3">
              <p className="text-foreground-subtle text-xs uppercase">
                Color toolbar
              </p>
              <div className="border-border bg-surface-elevated inline-flex items-center gap-1.5 rounded-full border px-2 py-1.5 shadow-lg">
                <span className="size-5 rounded-full bg-[rgba(250,204,21,0.7)] ring-1 ring-black/10" />
                <span className="size-5 rounded-full bg-[rgba(74,222,128,0.7)] ring-1 ring-black/10" />
                <span className="size-5 rounded-full bg-[rgba(96,165,250,0.7)] ring-1 ring-black/10" />
                <span className="size-5 rounded-full bg-[rgba(244,114,182,0.7)] ring-1 ring-black/10" />
              </div>
              <p className="text-foreground-subtle text-xs uppercase">
                Bookmark note
              </p>
              <div className="border-border bg-surface text-foreground rounded-md border px-3 py-2 text-sm">
                Re-read section 3 before the meeting.
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 31 — snapshot capture
          </h2>
          <p className="text-foreground-muted text-sm">
            Image-less bookmarks get a generated, on-device PNG snapshot (title
            + description + a domain-derived gradient — no remote images,
            CORS-safe). Shown on the card below og:image in precedence.
          </p>
          <div className="flex flex-wrap gap-4">
            {[
              {
                title: "Local-first software",
                excerpt: "Keep your data on the device you own.",
                domain: "inkandswitch.com",
                grad: "linear-gradient(135deg, hsl(210 60% 32%), hsl(250 60% 20%))",
              },
              {
                title: "The Tao of Programming",
                excerpt: "A timeless guide to the craft.",
                domain: "mit.edu",
                grad: "linear-gradient(135deg, hsl(140 60% 32%), hsl(180 60% 20%))",
              },
            ].map((c) => (
              <div
                key={c.domain}
                className="flex aspect-video w-72 flex-col justify-between overflow-hidden rounded-lg p-5 text-white"
                style={{ background: c.grad }}
              >
                <div className="space-y-1.5">
                  <p className="text-xl leading-tight font-semibold tracking-tight">
                    {c.title}
                  </p>
                  <p className="text-sm opacity-85">{c.excerpt}</p>
                </div>
                <p className="text-xs opacity-70">{c.domain}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 32 — import / export
          </h2>
          <p className="text-foreground-muted text-sm">
            Import a Netscape bookmarks HTML (browser / Raindrop / Pocket) or a
            LinkNest JSON — duplicates skipped by canonical URL, folders clamped
            to 3 levels. Export to JSON or HTML. Fully local.
          </p>
          <div className="border-border bg-surface w-full max-w-md space-y-4 rounded-xl border p-4">
            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Import
              </p>
              <div className="border-border text-foreground-muted flex flex-col items-center gap-1 rounded-md border border-dashed px-4 py-6 text-sm">
                <span>Drop a .html or .json file, or click to choose</span>
                <span className="text-foreground-subtle text-xs">
                  Browser / Raindrop / Pocket export, or a LinkNest JSON
                </span>
              </div>
              <div className="bg-surface-elevated mt-2 h-1 overflow-hidden rounded-full">
                <div className="bg-accent-blue h-full w-2/3" />
              </div>
              <p className="text-foreground-muted mt-2 text-xs">
                Added 142 · skipped 8 · +6 folders · +14 tags
              </p>
            </div>
            <div>
              <p className="text-foreground-subtle mb-2 text-xs uppercase">
                Export
              </p>
              <div className="flex gap-2">
                <span className="border-border text-foreground flex-1 rounded-md border px-3 py-1.5 text-center text-sm">
                  Export JSON
                </span>
                <span className="border-border text-foreground flex-1 rounded-md border px-3 py-1.5 text-center text-sm">
                  Export HTML
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 33 — PWA / offline
          </h2>
          <p className="text-foreground-muted text-sm">
            Installable (web manifest + icons) with an offline app shell — a
            hand-rolled service worker (network-first navigation, SWR statics,
            <code className="font-mono"> /offline </code> fallback). Data is
            already offline via Dexie.
          </p>
          <div className="flex flex-wrap gap-6">
            <div className="border-border bg-surface flex w-72 flex-col items-center justify-center gap-3 rounded-xl border px-6 py-10 text-center">
              <span
                aria-hidden
                className="from-accent-blue to-accent-cyan size-10 rounded-xl bg-gradient-to-br"
              />
              <p className="text-foreground text-sm font-medium">
                You&apos;re offline
              </p>
              <p className="text-foreground-muted text-xs">
                Your saved bookmarks are still here — reconnect to sync.
              </p>
            </div>
            <div className="w-72 space-y-2">
              <p className="text-foreground-subtle text-xs uppercase">
                Update toast
              </p>
              <div className="border-border bg-surface-elevated rounded-md border px-3 py-2 text-sm">
                <p className="text-foreground font-medium">
                  New version available
                </p>
                <p className="text-foreground-muted text-xs">
                  Refresh the page to update.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-lg font-semibold">
            Feature 34 — link health
          </h2>
          <p className="text-foreground-muted text-sm">
            A manual &ldquo;Check link health&rdquo; pass GET-checks each
            bookmark (SSRF-guarded, never false-dead) and stamps a synced
            status. Broken cards get a badge; moved cards offer one-click
            &ldquo;Update&rdquo;. Filter to broken links from the sidebar.
          </p>
          <div className="flex flex-wrap gap-6">
            <div className="border-border bg-surface w-72 space-y-2 rounded-lg border p-3 text-sm">
              <div className="text-foreground-subtle flex items-center gap-1.5 text-[11px]">
                <span className="bg-surface-hover inline-block size-4 rounded-sm" />
                dead.example.com · 3w ago
                <span className="border-tone-error/40 text-tone-error rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                  Broken
                </span>
              </div>
              <p className="text-foreground font-medium">Old API docs</p>
            </div>
            <div className="border-border bg-surface w-72 space-y-2 rounded-lg border p-3 text-sm">
              <div className="text-foreground-subtle flex items-center gap-1.5 text-[11px]">
                <span className="bg-surface-hover inline-block size-4 rounded-sm" />
                moved.example.com · 1mo ago
                <span className="flex items-center gap-1">
                  <span className="border-accent-orange/40 text-accent-orange rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                    Moved
                  </span>
                  <span className="text-accent-blue">Update</span>
                </span>
              </div>
              <p className="text-foreground font-medium">Relocated guide</p>
            </div>
            <div className="w-64 space-y-2">
              <p className="text-foreground-subtle text-xs uppercase">
                Summary toast
              </p>
              <div className="border-border bg-surface-elevated rounded-md border px-3 py-2 text-sm">
                <p className="text-foreground font-medium">
                  Link check complete
                </p>
                <p className="text-foreground-muted text-xs">
                  38 ok · 2 broken · 1 moved
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </TooltipProvider>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="text-foreground-muted mb-4 font-mono text-xs tracking-wider uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-foreground text-sm font-medium">{children}</span>
  );
}

/* Tailwind v4 JIT requires literal class strings — keep this map exhaustive. */
const SWATCH_BG: Record<string, string> = {
  background: "bg-background",
  surface: "bg-surface",
  "surface-elevated": "bg-surface-elevated",
  "surface-hover": "bg-surface-hover",
  "accent-cyan": "bg-accent-cyan",
  "accent-blue": "bg-accent-blue",
  "accent-orange": "bg-accent-orange",
  foreground: "bg-foreground",
  "tag-cyan": "bg-tag-cyan",
  "tag-blue": "bg-tag-blue",
  "tag-orange": "bg-tag-orange",
  "tag-emerald": "bg-tag-emerald",
  "tag-violet": "bg-tag-violet",
  "tag-rose": "bg-tag-rose",
  "tag-amber": "bg-tag-amber",
  "tag-zinc": "bg-tag-zinc",
};

function Swatch({ name }: { name: string }) {
  return (
    <div className="border-border bg-surface flex items-center gap-3 rounded-md border p-2">
      <div
        className={`h-8 w-8 rounded-md ring-1 ring-black/20 ${SWATCH_BG[name] ?? "bg-zinc-500"}`}
        aria-hidden
      />
      <code className="text-foreground-muted font-mono text-xs">{name}</code>
    </div>
  );
}

/* ---------- Feature 01 mock fixtures (visual sanity only) ---------- */

const NOW = 1716336000000;

const MOCK_BOOKMARK_READY: Bookmark = {
  id: asBookmarkId("bk_preview_ready"),
  url: "https://linear.app/blog/scaling-real-time-sync",
  title: "How Linear scales its sync engine for real-time collaboration",
  description:
    "A technical retrospective on the architecture behind Linear's offline-first sync system.",
  previewImageUrl: null,
  faviconUrl: "https://www.google.com/s2/favicons?domain=linear.app&sz=32",
  domain: "linear.app",
  previewStatus: "ready",
  folderId: null,
  tagIds: [],
  createdAt: NOW - 1000 * 60 * 60 * 48,
  updatedAt: NOW - 1000 * 60 * 60 * 48,
  deletedAt: null,
  previewFailureKind: null,
  previewAttempt: 0,
  readState: "inbox",
  linkStatus: "unknown",
  linkCheckedAt: null,
  linkRedirectUrl: null,
  captureStatus: "pending",
  captureFailureKind: null,
  captureAttempt: 0,
  readProgress: 0,
};

const MOCK_BOOKMARK_SELECTED: Bookmark = {
  ...MOCK_BOOKMARK_READY,
  id: asBookmarkId("bk_preview_selected"),
  url: "https://figma.com/blog/config-2026-recap",
  title: "Config 2026 recap — what we shipped",
  description: "Keynote, Dev Mode, and Code Connect updates from Config 2026.",
  faviconUrl: "https://www.google.com/s2/favicons?domain=figma.com&sz=32",
  domain: "figma.com",
  createdAt: NOW - 1000 * 60 * 60 * 6,
  updatedAt: NOW - 1000 * 60 * 60 * 6,
};

const MOCK_BOOKMARK_FOCUSED: Bookmark = {
  ...MOCK_BOOKMARK_READY,
  id: asBookmarkId("bk_preview_focused"),
  url: "https://emilkowal.ski/the-hidden-details",
  title: "The hidden details that make UIs feel great",
  description: "Easing curves, durations, and the unspoken contract of motion.",
  faviconUrl: "https://www.google.com/s2/favicons?domain=emilkowal.ski&sz=32",
  domain: "emilkowal.ski",
  createdAt: NOW - 1000 * 60 * 15,
  updatedAt: NOW - 1000 * 60 * 15,
};

const MOCK_TOAST_UNDO: Toast = {
  id: "preview_toast_undo",
  tone: "info",
  title: "Deleted “How Linear scales its sync engine”",
  description: "Will be removed in 5 seconds",
  action: {
    label: "Undo",
    intent: "undo",
    payload: asBookmarkId("bk_preview_ready"),
  },
  expiresAt: Number.MAX_SAFE_INTEGER,
};

const MOCK_TOAST_VIEW: Toast = {
  id: "preview_toast_view",
  tone: "info",
  title: "Already saved",
  description: "“The hidden details that make UIs feel great”",
  action: {
    label: "View",
    intent: "view",
    payload: asBookmarkId("bk_preview_focused"),
  },
  expiresAt: Number.MAX_SAFE_INTEGER,
};

const MOCK_TOAST_ERROR: Toast = {
  id: "preview_toast_error",
  tone: "error",
  title: "Could not save bookmark",
  description: "Storage quota exceeded",
  expiresAt: Number.MAX_SAFE_INTEGER,
};
