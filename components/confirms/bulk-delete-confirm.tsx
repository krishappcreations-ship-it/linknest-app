"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/store";
import { closeDialog } from "@/store/slices/ui-slice";
import { useBookmarks } from "@/hooks/use-bookmarks";

/**
 * Bulk delete confirm — fires when selection.size ≥ 3 and user presses
 * Backspace/Delete, or from a bulk-action menu (later). Confirm is the
 * user's chance to back out — no undo path for bulk delete.
 */
export function BulkDeleteConfirm() {
  const dialog = useStore((s) => s.ui.dialog);
  const { removeMany } = useBookmarks();

  if (dialog.kind !== "bulk-delete-confirm") return null;

  const close = () => useStore.setState((s) => ({ ui: closeDialog(s.ui) }));

  const n = dialog.ids.length;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-[400px]">
        <div className="bg-tag-rose/10 text-tag-rose mb-3 flex size-9 items-center justify-center rounded-md">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="size-4"
          >
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </div>
        <DialogTitle className="mb-1 text-base font-semibold tracking-tight">
          Delete {n} bookmark{n === 1 ? "" : "s"}?
        </DialogTitle>
        <p className="text-foreground-muted mb-4 text-sm leading-relaxed">
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="border-border-strong text-foreground-muted hover:bg-surface-hover hover:text-foreground inline-flex h-8 items-center rounded-md border bg-transparent px-3.5 text-sm transition-[transform,background-color,color] duration-100 active:translate-y-px"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await removeMany(dialog.ids);
              close();
            }}
            className="border-tag-rose/35 bg-tag-rose/10 text-tag-rose hover:bg-tag-rose/20 inline-flex h-8 items-center rounded-md border px-3.5 text-sm font-medium transition-[transform,background-color] duration-100 active:translate-y-px"
          >
            Delete {n}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
