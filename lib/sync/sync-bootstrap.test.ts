import { describe, expect, it, vi } from "vitest";
import {
  bootstrapOnSignIn,
  syncOnStartup,
  mergeLwwIntoLocal,
  type BootstrapDeps,
} from "./sync-bootstrap";
import { createMemorySyncStore, memorySyncAdapter } from "./memory-sync";
import { memoryBookmarksAdapter } from "@/lib/db/bookmarks-adapter";
import { memoryFoldersAdapter } from "@/lib/db/folders-adapter";
import { memoryTagsAdapter } from "@/lib/db/tags-adapter";
import { memoryPreferencesAdapter } from "@/lib/db/preferences-adapter";
import type { Bookmark, BookmarkId } from "@/types";

function mkBookmark(id: string, updatedAt: number, title = id): Bookmark {
  return {
    id: id as BookmarkId,
    url: `https://x/${id}`,
    title,
    description: null,
    previewImageUrl: null,
    faviconUrl: null,
    domain: "x",
    previewStatus: "pending",
    folderId: null,
    tagIds: [],
    createdAt: 0,
    updatedAt,
    deletedAt: null,
    previewFailureKind: null,
    previewAttempt: 0,
    readState: "inbox",
    captureStatus: "pending",
    captureFailureKind: null,
    captureAttempt: 0,
    readProgress: 0,
  };
}

interface DepsWithCounts extends BootstrapDeps {
  onCalls: { b: number; f: number; t: number; p: number };
}

function makeDeps(): DepsWithCounts {
  const onCalls = { b: 0, f: 0, t: 0, p: 0 };
  const store = createMemorySyncStore();
  return {
    sync: memorySyncAdapter(store),
    bookmarks: memoryBookmarksAdapter(),
    folders: memoryFoldersAdapter(),
    tags: memoryTagsAdapter(),
    preferences: memoryPreferencesAdapter(),
    setStatus: vi.fn(),
    onSyncBookmark: () => {
      onCalls.b++;
    },
    onSyncFolder: () => {
      onCalls.f++;
    },
    onSyncTag: () => {
      onCalls.t++;
    },
    onSyncPreferences: () => {
      onCalls.p++;
    },
    onCalls,
  };
}

describe("bootstrapOnSignIn", () => {
  it("uploads local then fetches cloud + merges back", async () => {
    const deps = makeDeps();
    await deps.bookmarks.put(mkBookmark("b1", 100, "local-title"));
    await bootstrapOnSignIn("u1", deps);
    const local = await deps.bookmarks.list();
    expect(local).toHaveLength(1);
    expect(local[0].title).toBe("local-title");
    expect(deps.onCalls.b).toBe(1);
  });
});

describe("syncOnStartup", () => {
  it("fetches cloud + merges LWW into local", async () => {
    const deps = makeDeps();
    await deps.sync.uploadAll("u1", {
      bookmarks: [mkBookmark("b1", 200, "cloud")],
      folders: [],
      tags: [],
      preferences: null,
    });
    await deps.bookmarks.put(mkBookmark("b1", 100, "local-stale"));
    await syncOnStartup("u1", deps);
    const local = await deps.bookmarks.list();
    expect(local[0].title).toBe("cloud");
  });
});

describe("mergeLwwIntoLocal", () => {
  it("skips when local is newer", async () => {
    const deps = makeDeps();
    await deps.bookmarks.put(mkBookmark("b1", 200, "local-newer"));
    await mergeLwwIntoLocal(
      {
        bookmarks: [mkBookmark("b1", 100, "cloud-stale")],
        folders: [],
        tags: [],
        preferences: null,
      },
      deps
    );
    const local = await deps.bookmarks.list();
    expect(local[0].title).toBe("local-newer");
    expect(deps.onCalls.b).toBe(0);
  });

  it("writes when cloud is newer", async () => {
    const deps = makeDeps();
    await deps.bookmarks.put(mkBookmark("b1", 100, "local-stale"));
    await mergeLwwIntoLocal(
      {
        bookmarks: [mkBookmark("b1", 200, "cloud-newer")],
        folders: [],
        tags: [],
        preferences: null,
      },
      deps
    );
    const local = await deps.bookmarks.list();
    expect(local[0].title).toBe("cloud-newer");
    expect(deps.onCalls.b).toBe(1);
  });

  it("writes when local missing", async () => {
    const deps = makeDeps();
    await mergeLwwIntoLocal(
      {
        bookmarks: [mkBookmark("b1", 1, "cloud-only")],
        folders: [],
        tags: [],
        preferences: null,
      },
      deps
    );
    const local = await deps.bookmarks.list();
    expect(local).toHaveLength(1);
    expect(deps.onCalls.b).toBe(1);
  });
});
