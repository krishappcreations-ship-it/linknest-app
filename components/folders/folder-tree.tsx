"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useFolders } from "@/hooks/use-folders";
import { SortableFolderRow } from "./sortable-folder-row";
import { FolderRowEditor } from "./folder-row-editor";

export function FolderTree() {
  const { rows, editing } = useFolders();
  return (
    <div className="flex flex-col gap-0.5">
      <SortableContext
        items={rows.map((r) => `folder:${r.folder.id}:sortable`)}
        strategy={verticalListSortingStrategy}
      >
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <SortableFolderRow key={row.folder.id} row={row} />
          ))}
        </AnimatePresence>
      </SortableContext>
      {editing.mode === "create" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.125 }}
          className="py-1 pr-2 pl-2"
          style={{
            paddingLeft: `${
              8 +
              (editing.parentId
                ? depthOfParent(editing.parentId, rows) + 1
                : 0) *
                14
            }px`,
          }}
        >
          <FolderRowEditor mode="create" />
        </motion.div>
      )}
    </div>
  );
}

function depthOfParent(
  parentId: import("@/types").FolderId,
  rows: ReturnType<typeof useFolders>["rows"]
): number {
  const parentRow = rows.find((r) => r.folder.id === parentId);
  return parentRow?.depth ?? 0;
}
