"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TagCombobox } from "@/components/tags/tag-combobox";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useStore } from "@/store";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import type { BookmarkId, TagId } from "@/types";

/**
 * Add / edit a prompt. Category is free text with autocomplete from existing
 * prompt categories (datalist). Body is the prompt text. Reuses TagCombobox.
 */
export function PromptDialog({
  editId,
  onClose,
}: {
  editId?: BookmarkId;
  onClose: () => void;
}) {
  const { addPrompt, updatePrompt, byId } = useBookmarks();
  const existing = editId ? byId(editId) : null;

  const bookmarksState = useStore((s) => s.bookmarks);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          selectVisibleBookmarks(bookmarksState)
            .filter((b) => b.kind === "prompt" && b.promptCategory)
            .map((b) => b.promptCategory as string)
        )
      ).sort(),
    [bookmarksState]
  );

  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.promptCategory ?? "");
  const [body, setBody] = useState(existing?.promptBody ?? "");
  const [tagIds, setTagIds] = useState<TagId[]>(existing?.tagIds ?? []);
  const [pending, setPending] = useState(false);
  const listId = useMemo(
    () => `prompt-cats-${Math.random().toString(36).slice(2)}`,
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    try {
      if (editId) {
        await updatePrompt(editId, { title, body, category, tagIds });
      } else {
        await addPrompt({ title, body, category, tagIds });
      }
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[520px]">
        <DialogTitle className="mb-4 text-base font-semibold tracking-tight">
          {editId ? "Edit prompt" : "Add prompt"}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-foreground-muted text-xs font-medium">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Cinematic hero shot"
              autoFocus
              className="border-border-strong bg-background text-foreground focus:border-accent-blue w-full rounded-md border px-2.5 py-2 text-sm transition-colors outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-foreground-muted text-xs font-medium">
              Category
            </span>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list={listId}
              maxLength={80}
              placeholder="e.g. Image generation"
              className="border-border-strong bg-background text-foreground focus:border-accent-blue w-full rounded-md border px-2.5 py-2 text-sm transition-colors outline-none"
            />
            <datalist id={listId}>
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-foreground-muted text-xs font-medium">
              Prompt
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              required
              placeholder="Paste the prompt text…"
              className="border-border-strong bg-background text-foreground focus:border-accent-blue w-full resize-y rounded-md border px-2.5 py-2 text-sm transition-colors outline-none"
            />
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
              disabled={pending || !body.trim()}
              className="bg-foreground text-background hover:bg-foreground-muted inline-flex h-8 items-center rounded-md px-3.5 text-sm font-medium transition-[transform,background-color] duration-100 active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0"
            >
              {pending ? "Saving…" : editId ? "Save changes" : "Save prompt"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
