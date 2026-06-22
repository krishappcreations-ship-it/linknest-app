"use client";

import { Command } from "cmdk";
import type { PaletteResultRow } from "@/hooks/use-command-results";

interface Props {
  row: PaletteResultRow;
}

/**
 * Single result row inside a CommandPalette group. cmdk gives us
 * data-selected for keyboard highlight; we map it to bg-surface-hover.
 */
export function CommandResultRow({ row }: Props) {
  return (
    <Command.Item
      value={row.searchableValue}
      onSelect={row.onSelect}
      className="data-[selected=true]:bg-surface-hover data-[selected=true]:text-foreground active:bg-surface-elevated/70 text-foreground-muted flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-100 ease-out"
    >
      {row.icon && (
        <span className="flex size-4 items-center justify-center">
          {row.icon}
        </span>
      )}
      <span className="truncate">{row.label}</span>
    </Command.Item>
  );
}
