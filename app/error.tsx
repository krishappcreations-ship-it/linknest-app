"use client";
import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/app/styles/motion";

async function deleteLocalData(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("linknest");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="bg-background flex min-h-[100dvh] items-center justify-center px-6">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
        className="w-full max-w-sm space-y-6 text-center"
      >
        <svg
          className="text-tone-error mx-auto size-10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>

        <div className="space-y-2">
          <h1 className="text-foreground text-lg font-medium">
            Something went wrong
          </h1>
          <p className="text-foreground-muted text-sm">
            An unexpected error occurred.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre className="text-foreground-subtle bg-surface mt-3 overflow-auto rounded-md px-3 py-2 text-left font-mono text-xs">
              {error.message}
            </pre>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="bg-accent-blue text-foreground hover:bg-accent-blue/90 active:bg-accent-blue/80 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-100 ease-out"
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={async () => {
              await deleteLocalData();
              window.location.reload();
            }}
            className="border-border text-foreground-subtle hover:text-foreground-muted rounded-md border px-4 py-2 text-sm transition-colors duration-100 ease-out"
          >
            Clear local data
          </button>
        </div>
      </motion.div>
    </div>
  );
}
