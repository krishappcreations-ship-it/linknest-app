"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useStore } from "@/store";
import { useFolders } from "@/hooks/use-folders";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import { selectFolderSubtreeIds } from "@/store/slices/folders-slice";

export function FolderDeleteConfirm() {
  const dialog = useStore((s) => s.ui.dialog);
  const { byId, remove } = useFolders();
  const open = dialog.kind === "folder-delete-confirm";
  const targetId = open ? dialog.id : null;
  const folder = targetId ? byId(targetId) : null;

  const foldersState = useStore((s) => s.folders);
  const bookmarksState = useStore((s) => s.bookmarks);
  const counts = (() => {
    if (!targetId) return { subfolders: 0, bookmarks: 0 };
    const subtree = selectFolderSubtreeIds(foldersState, targetId);
    const subfolders = subtree.size - 1;
    const owned = selectVisibleBookmarks(bookmarksState).filter(
      (b) => b.folderId !== null && subtree.has(b.folderId)
    );
    return { subfolders, bookmarks: owned.length };
  })();

  function close() {
    useStore.setState((s) => ({ ui: { ...s.ui, dialog: { kind: "closed" } } }));
  }

  if (!folder) return null;

  const subfolderLine =
    counts.subfolders === 0
      ? null
      : ` and its ${counts.subfolders} subfolder${
          counts.subfolders === 1 ? "" : "s"
        }`;
  const bookmarkLine =
    counts.bookmarks === 0
      ? "It contains no bookmarks."
      : `${counts.bookmarks} bookmark${
          counts.bookmarks === 1 ? "" : "s"
        } will move to root.`;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="border-border bg-surface fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-xl">
          <Dialog.Title className="text-foreground text-base font-semibold tracking-tight">
            Delete “{folder.name}”{subfolderLine}?
          </Dialog.Title>
          <Dialog.Description className="text-foreground-muted mt-2 text-sm">
            {bookmarkLine}
          </Dialog.Description>
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
              onClick={() => void remove(folder.id, { confirmed: true })}
              className="bg-tag-rose text-background hover:bg-tag-rose/90 inline-flex h-8 items-center rounded-md px-3.5 text-sm font-medium transition-[colors,transform] duration-150 ease-out active:scale-[0.97]"
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
