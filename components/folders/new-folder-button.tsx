"use client";

import { useFolders } from "@/hooks/use-folders";

export function NewFolderButton() {
  const { beginCreate } = useFolders();
  return (
    <button
      type="button"
      onClick={() => beginCreate(null)}
      className="text-foreground-subtle hover:text-foreground hover:bg-surface-hover mt-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs transition-colors"
    >
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 2v8M2 6h8" />
      </svg>
      New folder
    </button>
  );
}
