"use client";

import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/store";
import { closeDialog, pushToast } from "@/store/slices/ui-slice";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useTags } from "@/hooks/use-tags";
import { useFolders } from "@/hooks/use-folders";
import { findBookmarkByUrl } from "@/store/slices/bookmarks-slice";
import { selectFolderByNameInParent } from "@/store/slices/folders-slice";
import { parseNetscape, serializeNetscape } from "@/lib/io/netscape";
import {
  parseLinkNestJson,
  serializeLinkNestJson,
} from "@/lib/io/linknest-json";
import { runImport, type ImportDeps } from "@/lib/io/import";
import { buildExport, downloadFile } from "@/lib/io/export";
import type { ImportEntry, ImportSummary } from "@/lib/io/types";
import type { FolderId, TagId } from "@/types";

type Phase = "idle" | "importing" | "done";

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function toEntries(text: string, isJson: boolean): ImportEntry[] {
  if (isJson) {
    return parseLinkNestJson(text).bookmarks.map((b) => ({
      url: b.url,
      title: b.title,
      folderPath: b.folderPath,
      tags: b.tags,
    }));
  }
  return parseNetscape(text);
}

export function ImportExportDialog() {
  const open = useStore((s) => s.ui.dialog.kind === "import-export");
  const { add } = useBookmarks();
  const { createOrGet } = useTags();
  const { createFolder } = useFolders();

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    useStore.setState((s) => ({ ui: closeDialog(s.ui) }));
    setPhase("idle");
    setSummary(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
  };

  const deps: ImportDeps = {
    findExistingByUrl: (url) =>
      findBookmarkByUrl(useStore.getState().bookmarks, url) !== null,
    ensureFolderPath: async (path) => {
      let parentId: FolderId | null = null;
      for (const name of path) {
        const existing = selectFolderByNameInParent(
          useStore.getState().folders,
          parentId,
          name
        );
        if (existing) {
          parentId = existing.id;
          continue;
        }
        const created = await createFolder({ name, parentId });
        if (!created) break; // depth-error/clamp → stop descending
        parentId = created.id;
      }
      return parentId;
    },
    ensureTag: async (name) => (await createOrGet(name))?.id ?? null,
    addBookmark: async (input) => {
      await add({
        url: input.url,
        title: input.title,
        folderId: input.folderId as FolderId | null,
        tagIds: input.tagIds as TagId[],
      });
    },
  };

  async function handleFile(file: File): Promise<void> {
    setError(null);
    setSummary(null);
    try {
      const text = await file.text();
      const isJson =
        file.name.toLowerCase().endsWith(".json") ||
        text.trimStart().startsWith("{");
      const entries = toEntries(text, isJson);
      setPhase("importing");
      setProgress({ done: 0, total: entries.length });
      const result = await runImport(entries, deps, (done, total) =>
        setProgress({ done, total })
      );
      setSummary(result);
      setPhase("done");
      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "success",
          title: "Import complete",
          description: `Added ${result.added} · skipped ${result.skipped} · +${result.foldersCreated} folders · +${result.tagsCreated} tags`,
          ttlMs: 5000,
        }),
      }));
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  function exportJson(): void {
    const data = buildExport(useStore.getState());
    downloadFile(
      `linknest-${todayStamp()}.json`,
      "application/json",
      serializeLinkNestJson(data)
    );
  }

  function exportHtml(): void {
    const data = buildExport(useStore.getState());
    downloadFile(
      `linknest-${todayStamp()}.html`,
      "text/html",
      serializeNetscape(data)
    );
  }

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="w-full max-w-md">
        <DialogTitle className="text-base font-semibold">
          Import / Export
        </DialogTitle>

        <section className="mt-4 space-y-2">
          <p className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
            Import
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
            disabled={phase === "importing"}
            className="border-border text-foreground-muted hover:border-border-strong hover:text-foreground flex w-full flex-col items-center gap-1 rounded-md border border-dashed px-4 py-6 text-sm transition-colors disabled:opacity-60"
          >
            <span>Drop a .html or .json file, or click to choose</span>
            <span className="text-foreground-subtle text-xs">
              Browser / Raindrop / Pocket export, or a LinkNest JSON
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".html,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />

          {phase === "importing" && (
            <div className="space-y-1">
              <div className="bg-surface h-1 overflow-hidden rounded-full">
                <div
                  className="bg-accent-blue h-full origin-left transition-[width] duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-foreground-subtle text-xs">
                Importing {progress.done} / {progress.total}…
              </p>
            </div>
          )}

          {summary && (
            <p className="text-foreground-muted text-xs">
              Added {summary.added} · skipped {summary.skipped} · +
              {summary.foldersCreated} folders · +{summary.tagsCreated} tags
              {summary.errors.length > 0 &&
                ` · ${summary.errors.length} errors`}
            </p>
          )}
          {error && <p className="text-tone-error text-xs">{error}</p>}
        </section>

        <section className="mt-5 space-y-2">
          <p className="text-foreground-muted text-xs font-medium tracking-wide uppercase">
            Export
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportJson}
              className="border-border text-foreground hover:bg-surface-hover flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors active:scale-[0.98]"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={exportHtml}
              className="border-border text-foreground hover:bg-surface-hover flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors active:scale-[0.98]"
            >
              Export HTML
            </button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
