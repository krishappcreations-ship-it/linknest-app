"use client";

import { useState, useRef, useEffect } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useTags } from "@/hooks/use-tags";
import { TagChip } from "./tag-chip";
import type { Tag, TagId } from "@/types";

interface Props {
  value: TagId[];
  onChange: (ids: TagId[]) => void;
}

export function TagCombobox({ value, onChange }: Props) {
  const { tags, byId, createOrGet } = useTags();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const selectedTags: Tag[] = value
    .map((id) => byId(id))
    .filter((t): t is Tag => t !== null);

  const lower = query.trim().toLowerCase();
  const suggestions = tags.filter(
    (t) => t.name.toLowerCase().includes(lower) && !value.includes(t.id)
  );
  const exactMatch = tags.find((t) => t.name.toLowerCase() === lower);
  const canCreate = lower.length > 0 && !exactMatch;

  function add(id: TagId) {
    if (value.includes(id)) return;
    onChange([...value, id]);
    setQuery("");
  }

  function remove(id: TagId) {
    onChange(value.filter((x) => x !== id));
  }

  async function commitTyped() {
    const trimmed = query.trim();
    if (!trimmed) return;
    const tag = await createOrGet(trimmed);
    if (tag) add(tag.id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map((t) => (
          <TagChip key={t.id} tag={t} size="md" onRemove={() => remove(t.id)} />
        ))}
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-foreground-subtle hover:text-foreground hover:bg-surface-hover h-6 rounded-md px-2 text-xs transition-[colors,transform] duration-150 ease-out active:scale-[0.97]"
          >
            + Add tag
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" sideOffset={4} className="w-64 p-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions.length > 0 && !canCreate) {
                add(suggestions[0]!.id);
              } else if (canCreate) {
                void commitTyped();
              }
            }
          }}
          placeholder="Search or create tag"
          className="border-border bg-background text-foreground focus:border-accent-blue mb-1 w-full rounded-sm border px-2 py-1 text-sm outline-none"
        />
        <div className="max-h-48 overflow-y-auto">
          {suggestions.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => add(t.id)}
              className="hover:bg-surface-hover flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors duration-100 ease-out"
            >
              <TagChip tag={t} size="md" />
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => void commitTyped()}
              className="hover:bg-surface-hover text-foreground-muted flex w-full items-center rounded-md px-2 py-1 text-left text-sm transition-colors duration-100 ease-out"
            >
              Create &ldquo;{query.trim()}&rdquo;
            </button>
          )}
          {!canCreate && suggestions.length === 0 && (
            <div className="text-foreground-subtle px-2 py-1 text-xs">
              No tags yet — type to create
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
