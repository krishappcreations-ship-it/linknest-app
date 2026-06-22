"use client";

import { useState } from "react";
import { Command } from "cmdk";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import * as Dialog from "@radix-ui/react-dialog";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useCommandResults } from "@/hooks/use-command-results";
import { useSemanticResults } from "@/hooks/use-semantic-results";
import { CommandResultRow } from "./command-result-row";

/**
 * Top-level command palette. Mounted once at the dashboard layout level.
 * Uses cmdk's Command.Dialog (which bundles dialog + command behavior;
 * one-off exception to the @/components/ui/dialog wrapper convention
 * per ADR-007).
 */
export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const { actions, navigation, bookmarks } = useCommandResults();
  const [query, setQuery] = useState("");
  const hasQuery = query.trim().length > 0;
  const keywordIds = new Set(
    bookmarks.map((row) => row.id.replace(/^bookmark:/, ""))
  );
  const related = useSemanticResults(query, keywordIds);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      label="Command palette"
      overlayClassName="fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:duration-200 data-[state=open]:duration-300"
      className="bg-surface text-foreground border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 fixed top-[15%] left-1/2 z-50 w-full max-w-[640px] -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl shadow-black/50 data-[state=closed]:duration-200 data-[state=open]:duration-300"
    >
      <VisuallyHidden.Root>
        <Dialog.Title>Command palette</Dialog.Title>
        <Dialog.Description>
          Search bookmarks, navigate to folders or tags, or run an action.
        </Dialog.Description>
      </VisuallyHidden.Root>

      <div className="border-border flex h-12 items-center gap-2 border-b px-3">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="text-foreground-subtle size-4 shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Search bookmarks or run a command…"
          className="text-foreground placeholder:text-foreground-subtle h-full w-full bg-transparent text-sm outline-none"
        />
        <kbd className="border-border bg-surface-elevated text-foreground-subtle rounded border px-1.5 py-px font-mono text-[10px]">
          ESC
        </kbd>
      </div>

      <Command.List className="max-h-[420px] overflow-y-auto p-1.5">
        <Command.Empty className="text-foreground-subtle px-3 py-6 text-center text-sm">
          No results.
        </Command.Empty>

        {actions.length > 0 && (
          <Command.Group
            heading="Actions"
            className="text-foreground-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
          >
            {actions.map((row) => (
              <CommandResultRow key={row.id} row={row} />
            ))}
          </Command.Group>
        )}

        {navigation.length > 0 && (
          <Command.Group
            heading="Navigation"
            className="text-foreground-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
          >
            {navigation.map((row) => (
              <CommandResultRow key={row.id} row={row} />
            ))}
          </Command.Group>
        )}

        {hasQuery && bookmarks.length > 0 && (
          <Command.Group
            heading="Bookmarks"
            className="text-foreground-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
          >
            {bookmarks.map((row) => (
              <CommandResultRow key={row.id} row={row} />
            ))}
          </Command.Group>
        )}

        {hasQuery && related.length > 0 && (
          <Command.Group
            heading="Related"
            className="text-foreground-subtle [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
          >
            {related.map((row) => (
              <CommandResultRow key={row.id} row={row} />
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
