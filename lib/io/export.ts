/**
 * Export engine (feature 32). buildExport is pure (state → portable object);
 * downloadFile is the thin browser side. Local-derived data (snapshot/embedding/
 * highlight/article) and tombstoned rows are excluded.
 */

import type { LinkNestExport, ExportBookmark } from "./types";

interface FolderLike {
  id: string;
  name: string;
  parentId: string | null;
  deletedAt: number | null;
}
interface TagLike {
  id: string;
  name: string;
  deletedAt: number | null;
}
interface BookmarkLike {
  url: string;
  title: string;
  description: string | null;
  note?: string | null;
  folderId: string | null;
  tagIds: string[];
  createdAt: number;
  deletedAt: number | null;
}
interface ExportState {
  bookmarks: { order: string[]; byId: Record<string, BookmarkLike> };
  folders: { byId: Record<string, FolderLike> };
  tags: { byId: Record<string, TagLike> };
}

function folderPath(
  folders: Record<string, FolderLike>,
  id: string | null
): string[] {
  const path: string[] = [];
  let cur = id;
  let guard = 0;
  while (cur && folders[cur] && guard++ < 16) {
    path.unshift(folders[cur]!.name);
    cur = folders[cur]!.parentId;
  }
  return path;
}

export function buildExport(state: ExportState): LinkNestExport {
  const bookmarks: ExportBookmark[] = [];
  for (const id of state.bookmarks.order) {
    const b = state.bookmarks.byId[id];
    if (!b || b.deletedAt !== null) continue;
    bookmarks.push({
      url: b.url,
      title: b.title,
      description: b.description,
      note: b.note ?? null,
      folderPath: folderPath(state.folders.byId, b.folderId),
      tags: b.tagIds
        .map((t) => state.tags.byId[t]?.name)
        .filter((n): n is string => Boolean(n)),
      createdAt: b.createdAt,
    });
  }
  return { version: 1, exportedAt: Date.now(), bookmarks };
}

export function downloadFile(
  filename: string,
  mime: string,
  content: string
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
