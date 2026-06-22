"use client";

import { useState } from "react";
import {
  BookmarkInputSchema,
  type BookmarkInput,
  type FolderId,
  type TagId,
} from "@/types";
import { FolderPicker } from "./folder-picker";
import { TagCombobox } from "@/components/tags/tag-combobox";
import { SuggestTagsChips } from "./suggest-tags-chips";

interface InitialValues {
  url?: string;
  title?: string;
  description?: string | null;
  folderId?: FolderId | null;
  tagIds?: TagId[];
  note?: string | null;
}

interface Props {
  initial?: InitialValues;
  submitLabel: string;
  onSubmit: (input: BookmarkInput) => Promise<void> | void;
  onCancel: () => void;
}

/**
 * Controlled form shared by add + edit modes. zod-validates on submit
 * via BookmarkInputSchema. Live char count on description. URL field
 * autofocuses. Save button disabled while pending or URL empty.
 */
export function BookmarkForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [folderId, setFolderId] = useState<FolderId | null>(
    initial?.folderId ?? null
  );
  const [tagIds, setTagIds] = useState<TagId[]>(initial?.tagIds ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = BookmarkInputSchema.safeParse({
      url,
      title: title.trim() || undefined,
      description: description.trim() || null,
      folderId,
      tagIds,
      note: note.trim() || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    try {
      await onSubmit(parsed.data);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <Field label="URL" error={error}>
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          autoFocus
          required
          className="border-border-strong bg-background text-foreground focus:border-accent-blue w-full rounded-md border px-2.5 py-2 text-sm transition-colors outline-none"
        />
      </Field>

      <Field label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Defaults to domain"
          className="border-border-strong bg-background text-foreground focus:border-accent-blue w-full rounded-md border px-2.5 py-2 text-sm transition-colors outline-none"
        />
      </Field>

      <Field label={`Description (${description.length} / 500)`}>
        <textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows={3}
          className="border-border-strong bg-background text-foreground focus:border-accent-blue w-full resize-y rounded-md border px-2.5 py-2 text-sm transition-colors outline-none"
        />
      </Field>

      <Field label="Note">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Private note for this bookmark"
          className="border-border-strong bg-background text-foreground focus:border-accent-blue w-full resize-y rounded-md border px-2.5 py-2 text-sm transition-colors outline-none"
        />
      </Field>

      <Field label="Save in">
        <FolderPicker value={folderId} onChange={setFolderId} />
      </Field>

      <Field label="Tags">
        <div className="mb-2">
          <SuggestTagsChips
            url={url}
            title={title}
            description={description}
            currentTagIds={tagIds}
            onApply={(tagId) => {
              if (!tagIds.includes(tagId)) {
                setTagIds([...tagIds, tagId]);
              }
            }}
          />
        </div>
        <TagCombobox value={tagIds} onChange={setTagIds} />
      </Field>

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-border-strong text-foreground-muted hover:bg-surface-hover hover:text-foreground inline-flex h-8 items-center rounded-md border bg-transparent px-3.5 text-sm transition-[transform,background-color,color] duration-100 active:translate-y-px"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !url.trim()}
          className="bg-foreground text-background hover:bg-foreground-muted inline-flex h-8 items-center rounded-md px-3.5 text-sm font-medium transition-[transform,background-color] duration-100 active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-foreground-muted text-xs font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-tag-rose text-[11px]">{error}</p>}
    </div>
  );
}
