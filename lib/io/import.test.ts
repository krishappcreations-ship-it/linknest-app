import { describe, it, expect } from "vitest";
import { runImport, type ImportDeps } from "@/lib/io/import";
import type { ImportEntry } from "@/lib/io/types";

function fakeDeps(existing = new Set<string>()): {
  deps: ImportDeps;
  added: string[];
  folders: string[][];
  tags: string[];
} {
  const added: string[] = [];
  const folders: string[][] = [];
  const tags: string[] = [];
  const deps: ImportDeps = {
    findExistingByUrl: (url) => existing.has(url),
    ensureFolderPath: async (path) => {
      if (path.length) folders.push(path);
      return path.length ? `folder:${path.join("/")}` : null;
    },
    ensureTag: async (name) => {
      tags.push(name);
      return `tag:${name}`;
    },
    addBookmark: async (input) => {
      added.push(input.url);
    },
  };
  return { deps, added, folders, tags };
}

const entries: ImportEntry[] = [
  { url: "https://a.com", title: "A", folderPath: ["Dev"], tags: ["js"] },
  { url: "https://b.com", title: "B", folderPath: [], tags: [] },
];

describe("runImport", () => {
  it("adds new, skips duplicates, reports a summary", async () => {
    const { deps, added } = fakeDeps(new Set(["https://b.com"]));
    const summary = await runImport(entries, deps);
    expect(added).toEqual(["https://a.com"]);
    expect(summary.added).toBe(1);
    expect(summary.skipped).toBe(1);
  });

  it("ensures folders and tags for added entries", async () => {
    const { deps, folders, tags } = fakeDeps();
    await runImport(entries, deps);
    expect(folders).toEqual([["Dev"]]);
    expect(tags).toEqual(["js"]);
  });

  it("collects per-entry errors without aborting", async () => {
    const { deps } = fakeDeps();
    deps.addBookmark = async (i) => {
      if (i.url === "https://a.com") throw new Error("boom");
    };
    const summary = await runImport(entries, deps);
    expect(summary.added).toBe(1); // b.com still added
    expect(summary.errors.length).toBe(1);
  });

  it("reports progress", async () => {
    const { deps } = fakeDeps();
    const seen: Array<[number, number]> = [];
    await runImport(entries, deps, (done, total) => seen.push([done, total]));
    expect(seen.at(-1)).toEqual([2, 2]);
  });
});
