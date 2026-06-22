"use client";

/**
 * Global keyboard bindings for the bookmark dashboard.
 *
 * Bindings:
 *   N             open Add dialog
 *   E             open Edit dialog for single-selected bookmark
 *   Backspace/Delete  soft-delete focused or single-selected;
 *                     if selection.size >= 3 → bulk-delete confirm dialog
 *   Escape        clear selection + close dialog
 *   Cmd/Ctrl+A    select all visible
 *
 * All bindings respect text-input focus to avoid hijacking typing.
 */

import { useEffect } from "react";
import { useStore } from "@/store";
import {
  openAddDialog,
  openEditDialog,
  openBulkDeleteConfirm,
  closeDialog,
  clearSelection,
  selectAll as uiSelectAll,
} from "@/store/slices/ui-slice";
import { selectVisibleBookmarks } from "@/store/slices/bookmarks-slice";
import { useBookmarks } from "./use-bookmarks";

function isTextInputFocused(): boolean {
  const t = document.activeElement?.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
}

export function useBookmarkShortcuts(): void {
  const api = useBookmarks();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isModifier = e.metaKey || e.ctrlKey;
      const inText = isTextInputFocused();

      // Cmd/Ctrl+A — select all visible
      if (isModifier && e.key.toLowerCase() === "a") {
        if (inText) return;
        e.preventDefault();
        useStore.setState((s) => ({
          ui: uiSelectAll(
            s.ui,
            selectVisibleBookmarks(s.bookmarks).map((b) => b.id)
          ),
        }));
        return;
      }

      // Escape — clear selection + close dialog
      if (e.key === "Escape") {
        useStore.setState((s) => ({ ui: clearSelection(closeDialog(s.ui)) }));
        return;
      }

      if (inText) return; // text-input keys below are blocked while typing

      // N — open add dialog
      if (e.key.toLowerCase() === "n") {
        useStore.setState((s) => ({ ui: openAddDialog(s.ui) }));
        return;
      }

      // E — edit single-selected bookmark
      if (e.key.toLowerCase() === "e") {
        const sel = api.selection;
        if (sel.length === 1) {
          const id = sel[0]!;
          useStore.setState((s) => ({ ui: openEditDialog(s.ui, id) }));
        }
        return;
      }

      // Backspace / Delete — soft-delete single or bulk-confirm 3+
      if (e.key === "Backspace" || e.key === "Delete") {
        const sel = api.selection;
        if (sel.length >= 3) {
          e.preventDefault();
          useStore.setState((s) => ({ ui: openBulkDeleteConfirm(s.ui, sel) }));
        } else if (sel.length === 1) {
          e.preventDefault();
          void api.remove(sel[0]!);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);
}
