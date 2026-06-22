"use client";

import { useRef, useState } from "react";
import { useStore } from "@/store";
import { openAddDialog, pushToast } from "@/store/slices/ui-slice";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { AssetDialog } from "@/components/forms/asset-dialog";
import { PromptDialog } from "@/components/forms/prompt-dialog";

/**
 * The "Add" split menu: bookmark (opens the existing dialog) / PDF / image
 * (file upload) / prompt. File items require sign-in (Storage is cloud + RLS);
 * anon users get a prompt. Picking a file opens the AssetDialog.
 *
 * `variant`: "toolbar" = desktop pill (hidden on mobile); "fab" = the round
 * bottom-nav button (mobile). Both open the same four items.
 */
export function AddMenu({
  variant = "toolbar",
}: {
  variant?: "toolbar" | "fab";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [accept, setAccept] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const authed = useStore(
    (s) => s.auth.status === "signed-in" || s.auth.status === "syncing"
  );

  function pickFile(acceptType: string) {
    if (!authed) {
      useStore.setState((s) => ({
        ui: pushToast(s.ui, {
          tone: "info",
          title: "Sign in to add files",
          ttlMs: 4000,
        }),
      }));
      return;
    }
    setAccept(acceptType);
    requestAnimationFrame(() => inputRef.current?.click());
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) setFile(f);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "fab" ? (
            <button
              type="button"
              aria-label="Add"
              className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 active:scale-[0.97]"
            >
              <span className="bg-accent-blue text-foreground -mt-4 flex size-10 items-center justify-center rounded-full shadow-lg">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="size-5"
                >
                  <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="bg-foreground text-background hover:bg-foreground-muted hidden h-8 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-[transform,background-color] duration-100 active:translate-y-px md:inline-flex"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="size-3.5"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="size-3"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={variant === "fab" ? "center" : "end"}
          side={variant === "fab" ? "top" : "bottom"}
        >
          <DropdownMenuItem
            onSelect={() =>
              useStore.setState((s) => ({ ui: openAddDialog(s.ui) }))
            }
          >
            Add bookmark
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => pickFile("application/pdf")}>
            Add PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => pickFile("image/*")}>
            Add image
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPromptOpen(true)}>
            Add prompt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {file && <AssetDialog file={file} onClose={() => setFile(null)} />}
      {promptOpen && <PromptDialog onClose={() => setPromptOpen(false)} />}
    </>
  );
}
