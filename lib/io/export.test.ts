import { describe, it, expect } from "vitest";
import { buildExport } from "@/lib/io/export";

const folders = {
  byId: {
    f1: { id: "f1", name: "Dev", parentId: null, deletedAt: null },
    f2: { id: "f2", name: "JS", parentId: "f1", deletedAt: null },
  },
};
const tags = { byId: { t1: { id: "t1", name: "ui", deletedAt: null } } };
const bookmarks = {
  order: ["b1", "b2"],
  byId: {
    b1: {
      id: "b1",
      url: "https://e.com",
      title: "E",
      description: "d",
      note: "n",
      folderId: "f2",
      tagIds: ["t1"],
      createdAt: 7,
      deletedAt: null,
    },
    b2: {
      id: "b2",
      url: "https://gone.com",
      title: "Gone",
      description: null,
      note: null,
      folderId: null,
      tagIds: [],
      createdAt: 8,
      deletedAt: 999, // tombstoned → excluded
    },
  },
};

describe("buildExport", () => {
  it("maps ids to folderPath + tag names, excludes tombstones", () => {
    const out = buildExport({ bookmarks, folders, tags } as never);
    expect(out.version).toBe(1);
    expect(out.bookmarks.length).toBe(1);
    expect(out.bookmarks[0]!.folderPath).toEqual(["Dev", "JS"]);
    expect(out.bookmarks[0]!.tags).toEqual(["ui"]);
    expect(out.bookmarks[0]!.note).toBe("n");
  });
});
