"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStore } from "@/store";
import { useTags } from "@/hooks/use-tags";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";

export function TagDeleteConfirm() {
  const dialog = useStore((s) => s.ui.dialog);
  const { byId, remove } = useTags();
  const open = dialog.kind === "tag-delete-confirm";
  const targetId = open ? dialog.id : null;
  const tag = targetId ? byId(targetId) : null;

  const bookmarksState = useStore((s) => s.bookmarks);
  const count = (() => {
    if (!targetId) return 0;
    return selectVisibleBookmarks(bookmarksState).filter((b) =>
      b.tagIds.includes(targetId)
    ).length;
  })();

  function close() {
    useStore.setState((s) => ({
      ui: { ...s.ui, dialog: { kind: "closed" } },
    }));
  }

  if (!tag) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-foreground text-base font-semibold tracking-tight">
          Delete &ldquo;{tag.name}&rdquo;?
        </DialogTitle>
        <DialogDescription className="text-foreground-muted mt-2 text-sm">
          {count === 0
            ? "It is not used on any bookmarks."
            : `It will be removed from ${count} bookmark${count === 1 ? "" : "s"}.`}
        </DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="border-border-strong text-foreground-muted hover:bg-surface-hover hover:text-foreground inline-flex h-8 items-center rounded-md border bg-transparent px-3.5 text-sm transition-[colors,transform] duration-150 ease-out active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void remove(tag.id, { confirmed: true })}
            className="bg-tag-rose text-background hover:bg-tag-rose/90 inline-flex h-8 items-center rounded-md px-3.5 text-sm font-medium transition-[colors,transform] duration-150 ease-out active:scale-[0.97]"
          >
            Delete
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
