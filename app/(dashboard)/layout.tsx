import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ToastRegion } from "@/components/toasts/toast-region";
import { BookmarkDialog } from "@/components/forms/bookmark-dialog";
import { BulkDeleteConfirm } from "@/components/confirms/bulk-delete-confirm";
import { FolderDeleteConfirm } from "@/components/confirms/folder-delete-confirm";
import { TagDeleteConfirm } from "@/components/confirms/tag-delete-confirm";
import { SyncQueueDialog } from "@/components/sync/sync-queue-dialog";
import { SmartCollectionDialog } from "@/components/collections/smart-collection-dialog";
import { ImportExportDialog } from "@/components/io/import-export-dialog";
import { DndProvider } from "@/components/dnd/dnd-provider";
import { CommandPalette } from "@/components/search/command-palette";
import { ServiceWorkerRegistrar } from "@/components/pwa/sw-registrar";

/**
 * Dashboard layout — mounts AppShell + ToastRegion + global dialogs once.
 * Route group renders at /, so this is the root user-facing layout.
 * DndProvider wraps everything so sidebar + grid share one drag context.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DndProvider>
      <AppShell sidebar={<Sidebar />} topbar={<Topbar />}>
        {children}
      </AppShell>
      <ToastRegion />
      <BookmarkDialog />
      <BulkDeleteConfirm />
      <FolderDeleteConfirm />
      <TagDeleteConfirm />
      <SyncQueueDialog />
      <SmartCollectionDialog />
      <ImportExportDialog />
      <CommandPalette />
      <ServiceWorkerRegistrar />
    </DndProvider>
  );
}
