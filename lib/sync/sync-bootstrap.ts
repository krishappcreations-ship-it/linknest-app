import type { SyncAdapter, BootstrapPayload } from "./types";
import type { Bookmark, Folder, Tag, Preferences } from "@/types";
import type { BookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import type { FoldersAdapter } from "@/lib/db/folders-adapter";
import type { TagsAdapter } from "@/lib/db/tags-adapter";
import type { PreferencesAdapter } from "@/lib/db/preferences-adapter";

export interface BootstrapDeps {
  sync: SyncAdapter;
  bookmarks: BookmarksAdapter;
  folders: FoldersAdapter;
  tags: TagsAdapter;
  preferences: PreferencesAdapter;
  setStatus: (s: "anon" | "signing-in" | "signed-in" | "syncing") => void;
  /** Apply a single bookmark row sync-driven (no inverse). */
  onSyncBookmark: (b: Bookmark) => void;
  onSyncFolder: (f: Folder) => void;
  onSyncTag: (t: Tag) => void;
  onSyncPreferences: (p: Preferences) => void;
}

export async function readAllLocal(
  deps: BootstrapDeps
): Promise<BootstrapPayload> {
  const [bookmarks, folders, tags, preferences] = await Promise.all([
    deps.bookmarks.list(),
    deps.folders.list(),
    deps.tags.list(),
    deps.preferences.get(),
  ]);
  return { bookmarks, folders, tags, preferences };
}

export async function mergeLwwIntoLocal(
  cloud: BootstrapPayload,
  deps: BootstrapDeps
): Promise<void> {
  const [localB, localF, localT] = await Promise.all([
    deps.bookmarks.list(),
    deps.folders.list(),
    deps.tags.list(),
  ]);
  const byIdB = new Map(localB.map((b) => [b.id, b]));
  const byIdF = new Map(localF.map((f) => [f.id, f]));
  const byIdT = new Map(localT.map((t) => [t.id, t]));

  for (const b of cloud.bookmarks) {
    const local = byIdB.get(b.id);
    if (!local || b.updatedAt >= local.updatedAt) {
      await deps.bookmarks.put(b);
      deps.onSyncBookmark(b);
    }
  }
  for (const f of cloud.folders) {
    const local = byIdF.get(f.id);
    if (!local || f.updatedAt >= local.updatedAt) {
      await deps.folders.put(f);
      deps.onSyncFolder(f);
    }
  }
  for (const t of cloud.tags) {
    const local = byIdT.get(t.id);
    if (!local || t.updatedAt >= local.updatedAt) {
      await deps.tags.put(t);
      deps.onSyncTag(t);
    }
  }
  if (cloud.preferences) {
    await deps.preferences.set(cloud.preferences);
    deps.onSyncPreferences(cloud.preferences);
  }
}

export async function bootstrapOnSignIn(
  userId: string,
  deps: BootstrapDeps
): Promise<void> {
  deps.setStatus("syncing");
  const local = await readAllLocal(deps);
  await deps.sync.uploadAll(userId, local);
  const cloud = await deps.sync.fetchAll(userId);
  await mergeLwwIntoLocal(cloud, deps);
  deps.setStatus("signed-in");
}

export async function syncOnStartup(
  userId: string,
  deps: BootstrapDeps
): Promise<void> {
  deps.setStatus("syncing");
  const cloud = await deps.sync.fetchAll(userId);
  await mergeLwwIntoLocal(cloud, deps);
  deps.setStatus("signed-in");
}
