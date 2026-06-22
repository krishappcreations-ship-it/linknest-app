"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePreferences } from "@/hooks/use-preferences";
import { SunIcon, MoonIcon } from "@radix-ui/react-icons";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (v: T) => void;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground-muted text-xs">{label}</span>
      <div className="border-border bg-surface inline-flex gap-0.5 rounded-md border p-0.5">
        {options.map(([v, lbl]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            data-active={v === value || undefined}
            className="data-[active=true]:bg-surface-elevated data-[active=true]:text-foreground text-foreground-subtle hover:text-foreground flex h-6 items-center rounded px-2 text-xs transition-colors"
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReaderToolbar({
  progress,
  onToggleHighlights,
  onToggleNote,
  noteActive,
}: {
  progress: number;
  onToggleHighlights?: () => void;
  onToggleNote?: () => void;
  noteActive?: boolean;
}) {
  const router = useRouter();
  const {
    theme,
    setTheme,
    readerFontSize,
    setReaderFontSize,
    readerFontFamily,
    setReaderFontFamily,
    readerWidth,
    setReaderWidth,
  } = usePreferences();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="border-border bg-background/80 sticky top-0 z-10 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[var(--reader-measure,42rem)] items-center gap-2 px-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover -ml-2 flex size-8 items-center justify-center rounded-md text-sm transition-colors active:scale-[0.97]"
        >
          ←
        </button>

        <div className="flex-1" />

        {onToggleNote && (
          <button
            type="button"
            onClick={onToggleNote}
            aria-label="Note"
            data-active={noteActive || undefined}
            className="text-foreground-muted hover:text-foreground hover:bg-surface-hover data-[active=true]:text-foreground flex size-8 items-center justify-center rounded-md transition-colors active:scale-[0.97]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 2.5h10v8l-3 3H3z M10 13.5V10h3.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {onToggleHighlights && (
          <button
            type="button"
            onClick={onToggleHighlights}
            aria-label="Highlights"
            className="text-foreground-muted hover:text-foreground hover:bg-surface-hover flex size-8 items-center justify-center rounded-md transition-colors active:scale-[0.97]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M2.5 11.5l6-6 2 2-6 6H2.5zM9.5 4.5l2-2 2 2-2 2z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Typography"
              className="text-foreground-muted hover:text-foreground hover:bg-surface-hover flex size-8 items-center justify-center rounded-md transition-colors active:scale-[0.97]"
            >
              <span className="text-sm">
                A<span className="text-xs">a</span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3">
            <Segmented
              label="Size"
              value={readerFontSize}
              options={[
                ["s", "S"],
                ["m", "M"],
                ["l", "L"],
              ]}
              onChange={(v) => void setReaderFontSize(v)}
            />
            <Segmented
              label="Font"
              value={readerFontFamily}
              options={[
                ["serif", "Serif"],
                ["sans", "Sans"],
              ]}
              onChange={(v) => void setReaderFontFamily(v)}
            />
            <Segmented
              label="Width"
              value={readerWidth}
              options={[
                ["narrow", "Narrow"],
                ["normal", "Normal"],
                ["wide", "Wide"],
              ]}
              onChange={(v) => void setReaderWidth(v)}
            />
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={() => void setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="text-foreground-muted hover:text-foreground hover:bg-surface-hover flex size-8 items-center justify-center rounded-md transition-colors active:scale-[0.97]"
        >
          {theme === "dark" ? (
            <SunIcon className="size-4" />
          ) : (
            <MoonIcon className="size-4" />
          )}
        </button>
      </div>

      <div
        className="bg-accent-blue h-0.5 origin-left transition-transform duration-150"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
