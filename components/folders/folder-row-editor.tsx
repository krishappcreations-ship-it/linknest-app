"use client";

import { useEffect, useRef, useState } from "react";
import { useFolders } from "@/hooks/use-folders";

interface Props {
  mode: "create" | "rename";
  initialName?: string;
  depth?: number;
}

export function FolderRowEditor({ mode, initialName = "", depth = 0 }: Props) {
  const { commitEdit, cancelEdit } = useFolders();
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function commit() {
    if (committedRef.current) return;
    committedRef.current = true;
    await commitEdit(value);
  }

  function cancel() {
    if (committedRef.current) return;
    committedRef.current = true;
    cancelEdit();
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      onBlur={() => {
        if (value.trim()) void commit();
        else cancel();
      }}
      maxLength={64}
      placeholder={mode === "create" ? "New folder name" : "Folder name"}
      className="border-accent-blue bg-background text-foreground flex-1 rounded-sm border px-1.5 py-0.5 text-sm outline-none"
      onClick={(e) => e.stopPropagation()}
    />
  );
}
