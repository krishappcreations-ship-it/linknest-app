/**
 * Import engine (feature 32). Dependency-injected so it unit-tests with fakes —
 * the UI wires the real apply* writes. Chunks + yields to a macrotask so a large
 * file never blocks the UI. Skips canonical-URL duplicates; collects per-entry
 * errors instead of aborting.
 */

import type { ImportEntry, ImportSummary } from "./types";

export interface ImportAddInput {
  url: string;
  title: string;
  folderId: string | null;
  tagIds: string[];
}

export interface ImportDeps {
  findExistingByUrl: (url: string) => boolean;
  ensureFolderPath: (path: string[]) => Promise<string | null>;
  ensureTag: (name: string) => Promise<string | null>;
  addBookmark: (input: ImportAddInput) => Promise<void>;
}

const CHUNK = 50;
const yieldToIdle = () => new Promise<void>((r) => setTimeout(r, 0));

export async function runImport(
  entries: ImportEntry[],
  deps: ImportDeps,
  onProgress?: (done: number, total: number) => void
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    added: 0,
    skipped: 0,
    foldersCreated: 0,
    tagsCreated: 0,
    errors: [],
  };
  const seenFolders = new Set<string>();
  const seenTags = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    try {
      if (deps.findExistingByUrl(e.url)) {
        summary.skipped++;
      } else {
        const folderId = await deps.ensureFolderPath(e.folderPath);
        if (e.folderPath.length) {
          const key = e.folderPath.join(" ");
          if (!seenFolders.has(key)) {
            seenFolders.add(key);
            summary.foldersCreated++;
          }
        }
        const tagIds: string[] = [];
        for (const name of e.tags) {
          const id = await deps.ensureTag(name);
          if (id) {
            tagIds.push(id);
            if (!seenTags.has(name)) {
              seenTags.add(name);
              summary.tagsCreated++;
            }
          }
        }
        await deps.addBookmark({
          url: e.url,
          title: e.title,
          folderId,
          tagIds,
        });
        summary.added++;
      }
    } catch (err) {
      summary.errors.push(
        `${e.url}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    if ((i + 1) % CHUNK === 0) await yieldToIdle();
    onProgress?.(i + 1, entries.length);
  }
  return summary;
}
