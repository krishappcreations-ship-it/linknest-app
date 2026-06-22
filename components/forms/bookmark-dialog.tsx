"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/store";
import { closeDialog } from "@/store/slices/ui-slice";
import { BookmarkForm } from "./bookmark-form";
import { PromptDialog } from "./prompt-dialog";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useFolders } from "@/hooks/use-folders";

/**
 * One dialog component, two modes. Reads ui.dialog:
 *   - kind === "add"  → renders BookmarkForm with empty / initialUrl values
 *   - kind === "edit" → looks up bookmark by id, pre-fills form
 *
 * Add mode closes on success OR duplicate (hook emits toast + focus).
 * Edit mode closes on success only.
 */
export function BookmarkDialog() {
  const dialog = useStore((s) => s.ui.dialog);
  const { add, update, byId } = useBookmarks();
  const { selectedFilter } = useFolders();
  const initialFolderId =
    selectedFilter.kind === "subtree" ? selectedFilter.id : null;

  const close = () => useStore.setState((s) => ({ ui: closeDialog(s.ui) }));

  if (dialog.kind === "add") {
    return (
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-[480px]">
          <DialogTitle className="mb-4 text-base font-semibold tracking-tight">
            Add bookmark
          </DialogTitle>
          <BookmarkForm
            initial={{
              url: dialog.initialUrl ?? "",
              folderId: initialFolderId,
            }}
            submitLabel="Save bookmark"
            onCancel={close}
            onSubmit={async (input) => {
              const r = await add(input);
              if (r.ok || r.reason === "duplicate") close();
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (dialog.kind === "edit") {
    const bookmark = byId(dialog.bookmarkId);
    if (!bookmark) {
      close();
      return null;
    }
    if (bookmark.kind === "prompt") {
      return <PromptDialog editId={bookmark.id} onClose={close} />;
    }
    return (
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-[480px]">
          <DialogTitle className="mb-4 text-base font-semibold tracking-tight">
            Edit bookmark
          </DialogTitle>
          <BookmarkForm
            initial={{
              url: bookmark.url,
              title: bookmark.title,
              description: bookmark.description ?? "",
              folderId: bookmark.folderId,
              tagIds: bookmark.tagIds,
              note: bookmark.note ?? "",
            }}
            submitLabel="Save changes"
            onCancel={close}
            onSubmit={async (input) => {
              await update(bookmark.id, input);
              close();
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
