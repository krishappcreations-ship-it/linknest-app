/**
 * Live Zustand root store — feature 01.
 *
 * Composes the bookmarks + ui slices and holds a reference to the production
 * Dexie adapter. Components consume the store ONLY through the hooks layer
 * (hooks/use-bookmarks.ts etc.).
 *
 * Persistence model: this store does NOT use Zustand persist middleware.
 * Each apply* action in store/slices/bookmarks-slice.ts handles persistence
 * inline via adapter.put/.remove. Rationale: see ADR-001 amendment
 * (commit will land in Issue 07 / T20).
 *
 * SSR safety: createDb() requires window.indexedDB. On the server, we
 * substitute a no-op adapter so Next.js prerender does not crash. The real
 * adapter is constructed lazily on the first client mount.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createDb, type LinkNestDb } from "@/lib/db/schema";
import {
  dexieBookmarksAdapter,
  type BookmarksAdapter,
} from "@/lib/db/bookmarks-adapter";
import {
  dexieArticlesAdapter,
  memoryArticlesAdapter,
  type ArticlesAdapter,
} from "@/lib/db/articles-adapter";
import {
  dexiePreviewCacheAdapter,
  memoryPreviewCacheAdapter,
  type PreviewCacheAdapter,
} from "@/lib/db/preview-cache-adapter";
import {
  dexieFoldersAdapter,
  memoryFoldersAdapter,
  type FoldersAdapter,
} from "@/lib/db/folders-adapter";
import {
  dexieSmartCollectionsAdapter,
  memorySmartCollectionsAdapter,
  type SmartCollectionsAdapter,
} from "@/lib/db/smart-collections-adapter";
import {
  dexieEmbeddingsAdapter,
  memoryEmbeddingsAdapter,
  type EmbeddingsAdapter,
} from "@/lib/db/embeddings-adapter";
import {
  dexieHighlightsAdapter,
  memoryHighlightsAdapter,
  type HighlightsAdapter,
} from "@/lib/db/highlights-adapter";
import {
  dexieSnapshotsAdapter,
  memorySnapshotsAdapter,
  type SnapshotsAdapter,
} from "@/lib/db/snapshots-adapter";
import {
  initialHighlightsState,
  addHighlight,
  type HighlightsState,
} from "@/store/slices/highlights-slice";
import {
  mountEmbedWorker,
  embedWorker,
  embedWorkerMounted,
} from "@/store/embed-worker";
import { embed } from "@/lib/search/embedder";
import {
  initialSmartCollectionsState,
  type SmartCollectionsState,
} from "@/store/slices/smart-collections-slice";
import {
  dexieTagsAdapter,
  memoryTagsAdapter,
  type TagsAdapter,
} from "@/lib/db/tags-adapter";
import {
  dexiePreferencesAdapter,
  memoryPreferencesAdapter,
  type PreferencesAdapter,
} from "@/lib/db/preferences-adapter";
import {
  dexieSyncQueueAdapter,
  memorySyncQueueAdapter,
  type SyncQueueAdapter,
} from "@/lib/sync/sync-queue";
import {
  initialBookmarksState,
  type BookmarksState,
} from "./slices/bookmarks-slice";
import {
  initialFoldersState,
  addFolder,
  type FoldersState,
} from "./slices/folders-slice";
import { initialTagsState, addTag, type TagsState } from "./slices/tags-slice";
import {
  initialPreferencesState,
  type PreferencesState,
} from "./slices/preferences-slice";
import { initialUiState, type UiState } from "./slices/ui-slice";
import {
  initialAuthState,
  setSession as authSetSession,
  setStatus as authSetStatus,
  type AuthState,
} from "./slices/auth-slice";
import {
  mountPreviewWorker,
  previewWorker,
  previewWorkerMounted,
} from "@/store/preview-worker";
import {
  mountCaptureWorker,
  captureWorker,
  captureWorkerMounted,
} from "@/store/capture-worker";
import { postPreview } from "@/lib/preview/fetch-preview-client";
import { postCapture } from "@/lib/capture/fetch-article-client";
import { truncateForIndex } from "@/lib/search/truncate-for-index";
import type { Bookmark, BookmarkId } from "@/types";

export interface SyncStatusState {
  queueSize: number;
  realtimeConnected: boolean;
}

const initialSyncStatusState: SyncStatusState = {
  queueSize: 0,
  realtimeConnected: false,
};

export type SyncDotState = "hidden" | "synced" | "pending" | "disconnected";

export interface RootState {
  bookmarks: BookmarksState;
  folders: FoldersState;
  tags: TagsState;
  ui: UiState;
  bookmarksAdapter: BookmarksAdapter;
  previewCacheAdapter: PreviewCacheAdapter;
  articlesAdapter: ArticlesAdapter;
  foldersAdapter: FoldersAdapter;
  tagsAdapter: TagsAdapter;
  preferences: PreferencesState;
  preferencesAdapter: PreferencesAdapter;
  syncQueueAdapter: SyncQueueAdapter;
  syncStatus: SyncStatusState;
  auth: AuthState;
  /** Full-text corpus (feature 26): bookmarkId → truncated lowercased body. */
  articleText: Record<string, string>;
  /** F27: bookmarkId → article reading minutes (for smart-collection rules). */
  articleReadingMinutes: Record<string, number>;
  smartCollections: SmartCollectionsState;
  smartCollectionsAdapter: SmartCollectionsAdapter;
  /** F28: bookmarkId → embedding vector (in-memory; for semantic search). */
  embeddingById: Record<string, number[]>;
  embeddingsAdapter: EmbeddingsAdapter;
  /** F30: local-only highlights, keyed by highlight id. */
  highlights: HighlightsState;
  highlightsAdapter: HighlightsAdapter;
  /** F31: bookmarkId → generated snapshot dataUrl (in-memory; image-less cards). */
  snapshotByBookmarkId: Record<string, string>;
  snapshotsAdapter: SnapshotsAdapter;
  hydrated: boolean;
}

let dbRef: LinkNestDb | null = null;

const noopAdapter: BookmarksAdapter = {
  async list() {
    return [];
  },
  async put() {},
  async remove() {},
  async get() {
    return null;
  },
};

function ensureAdapter(): BookmarksAdapter {
  if (typeof window === "undefined") return noopAdapter;
  if (!dbRef) dbRef = createDb();
  return dexieBookmarksAdapter(dbRef);
}

function ensurePreviewCacheAdapter(): PreviewCacheAdapter {
  if (typeof window === "undefined") return memoryPreviewCacheAdapter();
  if (!dbRef) dbRef = createDb();
  return dexiePreviewCacheAdapter(dbRef);
}

function ensureSmartCollectionsAdapter(): SmartCollectionsAdapter {
  if (typeof window === "undefined") return memorySmartCollectionsAdapter();
  if (!dbRef) dbRef = createDb();
  return dexieSmartCollectionsAdapter(dbRef);
}

function ensureArticlesAdapter(): ArticlesAdapter {
  if (typeof window === "undefined") return memoryArticlesAdapter();
  if (!dbRef) dbRef = createDb();
  return dexieArticlesAdapter(dbRef);
}

function ensureHighlightsAdapter(): HighlightsAdapter {
  if (typeof window === "undefined") return memoryHighlightsAdapter();
  if (!dbRef) dbRef = createDb();
  return dexieHighlightsAdapter(dbRef);
}

function ensureSnapshotsAdapter(): SnapshotsAdapter {
  if (typeof window === "undefined") return memorySnapshotsAdapter();
  if (!dbRef) dbRef = createDb();
  return dexieSnapshotsAdapter(dbRef);
}

function ensureEmbeddingsAdapter(): EmbeddingsAdapter {
  if (typeof window === "undefined") return memoryEmbeddingsAdapter();
  if (!dbRef) dbRef = createDb();
  return dexieEmbeddingsAdapter(dbRef);
}

function ensureFoldersAdapter(): FoldersAdapter {
  if (typeof window === "undefined") return memoryFoldersAdapter();
  if (!dbRef) dbRef = createDb();
  return dexieFoldersAdapter(dbRef);
}

function ensureTagsAdapter(): TagsAdapter {
  if (typeof window === "undefined") return memoryTagsAdapter();
  if (!dbRef) dbRef = createDb();
  return dexieTagsAdapter(dbRef);
}

function ensurePreferencesAdapter(): PreferencesAdapter {
  if (typeof window === "undefined") return memoryPreferencesAdapter();
  if (!dbRef) dbRef = createDb();
  return dexiePreferencesAdapter(dbRef);
}

function ensureSyncQueueAdapter(): SyncQueueAdapter {
  if (typeof window === "undefined") return memorySyncQueueAdapter();
  if (!dbRef) dbRef = createDb();
  return dexieSyncQueueAdapter(dbRef);
}

export function setAuthSession(
  payload: {
    userId: string;
    email: string | null;
    avatarUrl: string | null;
  } | null
) {
  useStore.setState((s) => ({ auth: authSetSession(s.auth, payload) }));
}

export function setAuthStatus(status: AuthState["status"]) {
  useStore.setState((s) => ({ auth: authSetStatus(s.auth, status) }));
}

export function setSyncQueueSize(size: number): void {
  useStore.setState((s) => {
    if (s.syncStatus.queueSize === size) return s;
    return { syncStatus: { ...s.syncStatus, queueSize: size } };
  });
}

export function setRealtimeConnected(connected: boolean): void {
  useStore.setState((s) => {
    if (s.syncStatus.realtimeConnected === connected) return s;
    return { syncStatus: { ...s.syncStatus, realtimeConnected: connected } };
  });
}

export function selectSyncDotState(state: RootState): SyncDotState {
  if (state.auth.userId === null) return "hidden";
  if (state.syncStatus.queueSize > 0) return "pending";
  if (!state.syncStatus.realtimeConnected) return "disconnected";
  return "synced";
}

export const useStore = create<RootState>()(
  devtools(
    () => ({
      bookmarks: initialBookmarksState,
      folders: initialFoldersState,
      tags: initialTagsState,
      ui: initialUiState,
      bookmarksAdapter: ensureAdapter(),
      previewCacheAdapter: ensurePreviewCacheAdapter(),
      articlesAdapter: ensureArticlesAdapter(),
      foldersAdapter: ensureFoldersAdapter(),
      tagsAdapter: ensureTagsAdapter(),
      preferences: initialPreferencesState,
      preferencesAdapter: ensurePreferencesAdapter(),
      syncQueueAdapter: ensureSyncQueueAdapter(),
      syncStatus: initialSyncStatusState,
      auth: initialAuthState,
      articleText: {},
      articleReadingMinutes: {},
      smartCollections: initialSmartCollectionsState,
      smartCollectionsAdapter: ensureSmartCollectionsAdapter(),
      embeddingById: {},
      embeddingsAdapter: ensureEmbeddingsAdapter(),
      highlights: initialHighlightsState,
      highlightsAdapter: ensureHighlightsAdapter(),
      snapshotByBookmarkId: {},
      snapshotsAdapter: ensureSnapshotsAdapter(),
      hydrated: false,
    }),
    { name: "linknest" }
  )
);

/**
 * Hydrate the bookmarks slice from Dexie. Idempotent — only runs once per
 * page life. Call from the dashboard layout's first client mount.
 */
export async function hydrateFromDexie(): Promise<void> {
  if (useStore.getState().hydrated) return;
  const adapter = useStore.getState().bookmarksAdapter;
  const rows = await adapter.list();
  const byId: Record<string, Bookmark> = {};
  const order: BookmarkId[] = [];
  for (const r of rows) {
    byId[r.id] = r;
    order.push(r.id);
  }

  // Hydrate folders in parallel.
  const foldersAdapter = useStore.getState().foldersAdapter;
  const folderRows = await foldersAdapter.list();
  let foldersState: FoldersState = initialFoldersState;
  // Sort by createdAt ASC so parents land before children.
  const sortedFolders = [...folderRows].sort(
    (a, b) => a.createdAt - b.createdAt
  );
  for (const f of sortedFolders) {
    if (f.deletedAt !== null) continue;
    foldersState = addFolder(foldersState, f).next;
  }

  // Hydrate tags.
  const tagsAdapter = useStore.getState().tagsAdapter;
  const tagRows = await tagsAdapter.list();
  let tagsState: TagsState = initialTagsState;
  const sortedTags = [...tagRows].sort((a, b) => a.createdAt - b.createdAt);
  for (const tag of sortedTags) {
    if (tag.deletedAt !== null) continue;
    tagsState = addTag(tagsState, tag).next;
  }

  // Hydrate preferences.
  const preferencesAdapter = useStore.getState().preferencesAdapter;
  const prefs = await preferencesAdapter.get();

  // Hydrate the full-text corpus (feature 26) + reading-minutes (feature 27).
  const articlesAdapter = useStore.getState().articlesAdapter;
  const articleRows = await articlesAdapter.list();
  const articleText: Record<string, string> = {};
  const articleReadingMinutes: Record<string, number> = {};
  for (const a of articleRows) {
    articleText[a.bookmarkId] = truncateForIndex(a.textContent);
    articleReadingMinutes[a.bookmarkId] = a.readingMinutes;
  }

  // Hydrate smart collections (feature 27).
  const smartCollectionsAdapter = useStore.getState().smartCollectionsAdapter;
  const collectionRows = await smartCollectionsAdapter.list();
  const scById: Record<string, (typeof collectionRows)[number]> = {};
  const scOrder: SmartCollectionsState["order"] = [];
  for (const c of collectionRows) {
    scById[c.id] = c;
    scOrder.push(c.id);
  }

  // Hydrate embeddings (feature 28) into the in-memory vector map.
  const embeddingsAdapter = useStore.getState().embeddingsAdapter;
  const embeddingRows = await embeddingsAdapter.list();
  const embeddingById: Record<string, number[]> = {};
  for (const e of embeddingRows) {
    embeddingById[e.bookmarkId] = e.vector;
  }

  // Hydrate highlights (feature 30) into the local-only byId map.
  const highlightsAdapter = useStore.getState().highlightsAdapter;
  const highlightRows = await highlightsAdapter.list();
  let highlightsState = initialHighlightsState;
  for (const hl of highlightRows)
    highlightsState = addHighlight(highlightsState, hl);

  // Hydrate snapshots (feature 31) into the in-memory dataUrl map.
  const snapshotsAdapter = useStore.getState().snapshotsAdapter;
  const snapshotRows = await snapshotsAdapter.list();
  const snapshotByBookmarkId: Record<string, string> = {};
  for (const snap of snapshotRows)
    snapshotByBookmarkId[snap.bookmarkId] = snap.dataUrl;

  useStore.setState({
    bookmarks: { byId, order },
    folders: foldersState,
    tags: tagsState,
    preferences: { prefs },
    articleText,
    articleReadingMinutes,
    smartCollections: { byId: scById, order: scOrder },
    embeddingById,
    highlights: highlightsState,
    snapshotByBookmarkId,
    hydrated: true,
  });

  // Mount the production worker only if no worker has been mounted yet.
  // Tests pre-mount a stub via mountPreviewWorker(); we must not clobber it.
  if (typeof window !== "undefined" && !previewWorkerMounted()) {
    mountPreviewWorker({ fetchPreview: postPreview });
  }
  previewWorker().kick();

  // Capture worker — F23. Same mount discipline as the preview worker.
  if (typeof window !== "undefined" && !captureWorkerMounted()) {
    mountCaptureWorker({ fetchArticle: postCapture });
  }
  captureWorker().kick();

  // Embed worker — F28. Same mount discipline. Real Transformers.js embedder.
  if (typeof window !== "undefined" && !embedWorkerMounted()) {
    mountEmbedWorker({ embed });
  }
  embedWorker().kick();

  // Mount cloud sync runtime if env vars present. Fire-and-forget.
  // Dynamic import avoids pulling supabase into SSR bundle.
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    void import("@/lib/sync/sync-runtime").then(({ mountSyncRuntime }) =>
      mountSyncRuntime()
    );
  }
}
