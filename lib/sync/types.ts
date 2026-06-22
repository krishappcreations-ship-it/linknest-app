import type { Bookmark, Folder, Tag, Preferences } from "@/types";

export interface BootstrapPayload {
  bookmarks: Bookmark[];
  folders: Folder[];
  tags: Tag[];
  preferences: Preferences | null;
}

export interface SyncAdapter {
  uploadAll(userId: string, payload: BootstrapPayload): Promise<void>;
  fetchAll(userId: string): Promise<BootstrapPayload>;
  putBookmark(userId: string, b: Bookmark): Promise<void>;
  putFolder(userId: string, f: Folder): Promise<void>;
  putTag(userId: string, t: Tag): Promise<void>;
  putPreferences(userId: string, p: Preferences): Promise<void>;
}
