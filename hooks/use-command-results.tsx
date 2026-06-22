"use client";

import { useMemo, type ReactNode } from "react";
import { useStore } from "@/store";
import {
  selectVisibleBookmarks,
  type BookmarksState,
} from "@/store/slices/bookmarks-slice";
import type { FoldersState } from "@/store/slices/folders-slice";
import type { TagsState } from "@/store/slices/tags-slice";
import {
  openAddDialog,
  beginCreateFolder,
  closeCommandPalette,
  openSyncQueueDialog,
  openImportExportDialog,
} from "@/store/slices/ui-slice";
import { triggerLinkCheck } from "@/hooks/use-link-check";
import type { Bookmark, FolderId, TagId } from "@/types";

const TAG_COLOR_DOT: Record<string, string> = {
  cyan: "bg-tag-cyan",
  blue: "bg-tag-blue",
  orange: "bg-tag-orange",
  emerald: "bg-tag-emerald",
  violet: "bg-tag-violet",
  rose: "bg-tag-rose",
  amber: "bg-tag-amber",
  zinc: "bg-tag-zinc",
};

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="size-4"
      aria-hidden
    >
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="size-4"
      aria-hidden
    >
      <path d="M1.5 4.5a1 1 0 0 1 1-1h3l1.5 1.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-7.5z" />
    </svg>
  );
}

function LinkCheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="size-4"
      aria-hidden
    >
      <path
        d="M6.5 9.5l-1.8 1.8a2.5 2.5 0 0 1-3.5-3.5l2.3-2.3M9.5 6.5l1.8-1.8a2.5 2.5 0 0 1 3.5 3.5l-2.3 2.3M6 10l4-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImportExportIcon() {
  return (
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
  );
}

function ClearFiltersIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="size-4"
      aria-hidden
    >
      <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
      <path d="M14 2 2 14" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="size-4"
      aria-hidden
    >
      <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" strokeLinecap="round" />
      <path
        d="M10 11l3-3-3-3M13 8H6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SyncQueueIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="size-4"
      aria-hidden
    >
      <path
        d="M2 5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 8h6M5 11h4" strokeLinecap="round" />
    </svg>
  );
}

function TagDot({ color }: { color: string }) {
  const cls = TAG_COLOR_DOT[color] ?? "bg-tag-zinc";
  return (
    <span aria-hidden className={`inline-block size-2.5 rounded-full ${cls}`} />
  );
}

function BookmarkFavicon({
  url,
  domain,
}: {
  url: string | null;
  domain: string;
}) {
  if (!url) {
    return (
      <span
        aria-hidden
        className="bg-surface-hover text-foreground-muted inline-flex size-4 items-center justify-center rounded-sm text-[10px] font-semibold"
      >
        {domain.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      width={16}
      height={16}
      className="inline-block size-4 rounded-sm"
    />
  );
}

export interface PaletteResultRow {
  id: string;
  kind: "bookmark" | "action" | "navigation";
  label: string;
  searchableValue: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface CommandResults {
  actions: PaletteResultRow[];
  navigation: PaletteResultRow[];
  bookmarks: PaletteResultRow[];
}

function close() {
  useStore.setState((s) => ({ ui: closeCommandPalette(s.ui) }));
}

function buildActions(): PaletteResultRow[] {
  const rows: PaletteResultRow[] = [
    {
      id: "action:add-bookmark",
      kind: "action",
      label: "Add bookmark",
      searchableValue: "add bookmark",
      icon: <PlusIcon />,
      onSelect: () => {
        useStore.setState((s) => ({ ui: openAddDialog(s.ui) }));
        close();
      },
    },
    {
      id: "action:new-folder",
      kind: "action",
      label: "New folder",
      searchableValue: "new folder",
      icon: <FolderIcon />,
      onSelect: () => {
        useStore.setState((s) => ({ ui: beginCreateFolder(s.ui, null) }));
        close();
      },
    },
    {
      id: "action:clear-filters",
      kind: "action",
      label: "Clear filters",
      searchableValue: "clear filters",
      icon: <ClearFiltersIcon />,
      onSelect: () => {
        useStore.setState((s) => ({
          ui: {
            ...s.ui,
            selectedFolderFilter: { kind: "all" },
            selectedTagId: null,
            similarToBookmarkId: null,
            linkStatusFilter: null,
          },
        }));
        close();
      },
    },
    {
      id: "action:check-links",
      kind: "action",
      label: "Check link health",
      searchableValue: "check link health broken dead redirected",
      icon: <LinkCheckIcon />,
      onSelect: () => {
        triggerLinkCheck();
        close();
      },
    },
    {
      id: "action:import",
      kind: "action",
      label: "Import bookmarks",
      searchableValue: "import bookmarks file html json",
      icon: <ImportExportIcon />,
      onSelect: () => {
        useStore.setState((s) => ({ ui: openImportExportDialog(s.ui) }));
        close();
      },
    },
    {
      id: "action:export",
      kind: "action",
      label: "Export bookmarks",
      searchableValue: "export bookmarks download backup",
      icon: <ImportExportIcon />,
      onSelect: () => {
        useStore.setState((s) => ({ ui: openImportExportDialog(s.ui) }));
        close();
      },
    },
  ];

  if (useStore.getState().auth.status === "signed-in") {
    rows.push({
      id: "action:sync-queue",
      kind: "action",
      label: "Sync queue",
      searchableValue: "sync queue pending",
      icon: <SyncQueueIcon />,
      onSelect: () => {
        useStore.setState((s) => ({ ui: openSyncQueueDialog(s.ui) }));
        close();
      },
    });
    rows.push({
      id: "action:sign-out",
      kind: "action",
      label: "Sign out",
      searchableValue: "sign out",
      icon: <SignOutIcon />,
      onSelect: () => {
        void import("@/lib/sync/auth-client").then(({ signOut }) => signOut());
        close();
      },
    });
  }

  return rows;
}

function pushFolder(
  rows: PaletteResultRow[],
  folders: FoldersState,
  id: FolderId
) {
  const f = folders.byId[id];
  if (!f) return;
  rows.push({
    id: `nav:folder:${id}`,
    kind: "navigation",
    label: `Go to ${f.name}`,
    searchableValue: `go to ${f.name.toLowerCase()}`,
    icon: <FolderIcon />,
    onSelect: () => {
      useStore.setState((s) => ({
        ui: {
          ...s.ui,
          selectedFolderFilter: { kind: "subtree", id },
          similarToBookmarkId: null,
        },
      }));
      close();
    },
  });
  const children = folders.childrenByParent[id] ?? [];
  for (const childId of children) {
    pushFolder(rows, folders, childId);
  }
}

function buildNavigation(
  folders: FoldersState,
  tags: TagsState
): PaletteResultRow[] {
  const rows: PaletteResultRow[] = [];
  for (const id of folders.rootIds) {
    pushFolder(rows, folders, id);
  }
  for (const tagId of tags.order) {
    const t = tags.byId[tagId];
    if (!t) continue;
    rows.push({
      id: `nav:tag:${tagId}`,
      kind: "navigation",
      label: `Filter by ${t.name}`,
      searchableValue: `filter by ${t.name.toLowerCase()}`,
      icon: <TagDot color={t.color} />,
      onSelect: () => {
        useStore.setState((s) => ({
          ui: {
            ...s.ui,
            selectedTagId: tagId as TagId,
            similarToBookmarkId: null,
          },
        }));
        close();
      },
    });
  }
  return rows;
}

function composeSearchable(
  b: Bookmark,
  tags: TagsState,
  articleText: Record<string, string>
): string {
  const tagNames = b.tagIds
    .map((id) => tags.byId[id]?.name ?? "")
    .filter(Boolean);
  return [
    b.title,
    b.domain,
    b.url,
    b.description ?? "",
    tagNames.join(" "),
    articleText[b.id] ?? "",
    b.promptBody ?? "",
    b.promptCategory ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function buildBookmarkRows(
  bookmarks: BookmarksState,
  tags: TagsState,
  articleText: Record<string, string>
): PaletteResultRow[] {
  const list = selectVisibleBookmarks(bookmarks);
  return list.map((b) => ({
    id: `bookmark:${b.id}`,
    kind: "bookmark",
    label: b.title,
    searchableValue: composeSearchable(b, tags, articleText),
    icon: <BookmarkFavicon url={b.faviconUrl} domain={b.domain} />,
    onSelect: () => {
      window.open(b.url, "_blank", "noopener,noreferrer");
      close();
    },
  }));
}

export function useCommandResults(): CommandResults {
  const bookmarks = useStore((s) => s.bookmarks);
  const folders = useStore((s) => s.folders);
  const tags = useStore((s) => s.tags);
  const auth = useStore((s) => s.auth);
  const articleText = useStore((s) => s.articleText);
  return useMemo(
    () => ({
      actions: buildActions(),
      navigation: buildNavigation(folders, tags),
      bookmarks: buildBookmarkRows(bookmarks, tags, articleText),
    }),
    [bookmarks, folders, tags, auth, articleText]
  );
}
