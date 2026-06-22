"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { useStore } from "@/store";
import type { SyncQueueRow } from "@/lib/db/schema";
import { flushOpportunistic } from "@/lib/sync/sync-runtime";

/**
 * Sync queue inspection Dialog (F14).
 *
 * Open state derives from ui.dialog.kind === "sync-queue" — no parallel
 * boolean. Triggered by the "Sync queue" Cmd+K action (P3). Fetches the
 * queue once on open via syncQueueAdapter.list(). The Flush button calls
 * the F10 flushOpportunistic helper (exported in P2) and refetches after
 * the promise settles so flushed-or-failed items both refresh the table.
 *
 * Empty state copy is reassuring rather than blank. Long IDs are
 * truncated with title attr for full-value hover. Modal uses existing
 * 300ms/200ms enter/exit from DialogContent.
 */
export function SyncQueueDialog() {
  const dialog = useStore((s) => s.ui.dialog);
  const open = dialog.kind === "sync-queue";
  const queueAdapter = useStore((s) => s.syncQueueAdapter);

  const [items, setItems] = useState<SyncQueueRow[]>([]);
  const [flushing, setFlushing] = useState(false);

  const refetch = useCallback(async () => {
    if (!queueAdapter) return;
    const rows = await queueAdapter.list();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    setItems(rows);
  }, [queueAdapter]);

  useEffect(() => {
    if (!open) return;
    void refetch();
  }, [open, refetch]);

  const handleFlush = async () => {
    setFlushing(true);
    try {
      await flushOpportunistic();
    } finally {
      setFlushing(false);
      await refetch();
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      useStore.setState((s) => ({
        ui: { ...s.ui, dialog: { kind: "closed" } },
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-base font-medium">Sync queue</DialogTitle>
        <DialogDescription className="text-text-muted mt-1 text-sm">
          {items.length === 0
            ? "Nothing pending. Local writes are in sync with the cloud."
            : `${items.length} pending write${items.length === 1 ? "" : "s"}.`}
        </DialogDescription>

        {items.length > 0 && (
          <div className="border-border mt-4 max-h-80 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="text-text-muted bg-surface-elevated/50 sticky top-0 text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium tabular-nums">
                    Attempts
                  </th>
                  <th className="px-3 py-2 font-medium tabular-nums">Age</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const rawId = row.key.split(":").slice(1).join(":");
                  return (
                    <tr key={row.key} className="border-border/50 border-t">
                      <td className="px-3 py-2 capitalize">{row.entity}</td>
                      <td
                        className="text-text-muted truncate px-3 py-2 font-mono text-xs"
                        title={rawId}
                      >
                        {rawId.slice(0, 12)}
                        {rawId.length > 12 ? "…" : ""}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.attempts} / 5
                      </td>
                      <td className="text-text-muted px-3 py-2 tabular-nums">
                        {formatAge(Date.now() - row.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <DialogClose className="text-text-muted hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors duration-100 ease-out active:scale-[0.97]">
            Close
          </DialogClose>
          <button
            type="button"
            onClick={handleFlush}
            disabled={flushing || items.length === 0}
            className="bg-accent-blue hover:bg-accent-blue/90 rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors duration-100 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {flushing ? "Flushing…" : "Flush now"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}
