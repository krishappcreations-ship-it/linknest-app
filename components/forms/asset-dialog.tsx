"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FolderPicker } from "./folder-picker";
import { TagCombobox } from "@/components/tags/tag-combobox";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useFolders } from "@/hooks/use-folders";
import type { FolderId, TagId } from "@/types";

/**
 * Metadata dialog shown after a file is picked for "Add PDF" / "Add image".
 * Reuses FolderPicker + TagCombobox so assets land in the same folders/tags as
 * bookmarks. Submit uploads the file + commits the asset via addAsset.
 */
export function AssetDialog({
  file,
  onClose,
}: {
  file: File;
  onClose: () => void;
}) {
  const { addAsset } = useBookmarks();
  const { selectedFilter } = useFolders();
  const [title, setTitle] = useState(file.name);
  const [folderId, setFolderId] = useState<FolderId | null>(
    selectedFilter.kind === "subtree" ? selectedFilter.id : null
  );
  const [tagIds, setTagIds] = useState<TagId[]>([]);
  const [pending, setPending] = useState(false);

  const isImage = file.type.startsWith("image/");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isImage) return;
    const u = URL.createObjectURL(file);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file, isImage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const r = await addAsset({
        file,
        title: title.trim() || file.name,
        folderId,
        tagIds,
      });
      if (r.ok) onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogTitle className="mb-4 text-base font-semibold tracking-tight">
          Add {isImage ? "image" : "PDF"}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="border-border bg-surface-elevated flex items-center gap-3 overflow-hidden rounded-md border p-3">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="size-12 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="bg-surface-hover grid size-12 shrink-0 place-items-center rounded">
                <PdfGlyph />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">
                {file.name}
              </p>
              <p className="text-foreground-subtle text-xs">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-foreground-muted text-xs font-medium">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
              className="border-border-strong bg-background text-foreground focus:border-accent-blue w-full rounded-md border px-2.5 py-2 text-sm transition-colors outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-foreground-muted text-xs font-medium">
              Save in
            </span>
            <FolderPicker value={folderId} onChange={setFolderId} />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-foreground-muted text-xs font-medium">
              Tags
            </span>
            <TagCombobox value={tagIds} onChange={setTagIds} />
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border-border-strong text-foreground-muted hover:bg-surface-hover hover:text-foreground inline-flex h-8 items-center rounded-md border bg-transparent px-3.5 text-sm transition-[transform,background-color,color] duration-100 active:translate-y-px"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-foreground text-background hover:bg-foreground-muted inline-flex h-8 items-center rounded-md px-3.5 text-sm font-medium transition-[transform,background-color] duration-100 active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0"
            >
              {pending ? "Uploading…" : "Save"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PdfGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className="text-accent-orange size-5"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
