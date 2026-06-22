"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/store";
import {
  signInWithGoogle,
  signInWithEmail,
  signOut,
} from "@/lib/sync/auth-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "./avatar";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 18 18" className="size-4 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.71v2.26h2.9c1.7-1.56 2.69-3.87 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.81 5.95-2.18l-2.9-2.26c-.81.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.92v2.33A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.92A8.997 8.997 0 0 0 0 9c0 1.45.35 2.82.92 4.04l3.05-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.997 8.997 0 0 0 .92 4.96l3.05 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export function AuthButton() {
  const status = useStore((s) => s.auth.status);
  const userId = useStore((s) => s.auth.userId);
  const email = useStore((s) => s.auth.email);
  const avatarUrl = useStore((s) => s.auth.avatarUrl);

  const [mode, setMode] = useState<"buttons" | "email-form" | "email-sent">(
    "buttons"
  );
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "signed-in") {
      setMode("buttons");
      setEmailInput("");
      setFormError(null);
    }
  }, [status]);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  if (status === "anon" || status === "signing-in") {
    if (mode === "email-sent") {
      return (
        <div className="space-y-2 px-1 py-1.5">
          <p className="text-foreground text-sm">
            Check your email for a link.
          </p>
          <p className="text-foreground-muted text-xs">
            Sent to <span className="text-foreground">{emailInput}</span>. New
            accounts are created automatically on first use.
          </p>
          <button
            type="button"
            onClick={() => {
              setMode("email-form");
              setFormError(null);
            }}
            className="text-foreground-subtle hover:text-foreground-muted text-xs underline transition-colors duration-100 ease-out"
          >
            Use a different email
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={status === "signing-in"}
          className="hover:bg-surface-hover active:bg-surface-elevated/70 text-foreground-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-100 ease-out disabled:opacity-50"
        >
          <GoogleGlyph />
          <span>
            {status === "signing-in" ? "Signing in…" : "Continue with Google"}
          </span>
        </button>

        {mode === "buttons" && (
          <button
            type="button"
            onClick={() => setMode("email-form")}
            className="text-foreground-subtle hover:text-foreground-muted block w-full px-2 text-left text-xs transition-colors duration-100 ease-out"
          >
            or continue with email
          </button>
        )}

        {mode === "email-form" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmed = emailInput.trim();
              if (!trimmed) return;
              setSending(true);
              setFormError(null);
              const result = await signInWithEmail(trimmed);
              setSending(false);
              if (result.ok) {
                setMode("email-sent");
              } else {
                setFormError(result.error);
              }
            }}
            className="space-y-1.5 px-1"
          >
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              disabled={sending}
              className="border-border bg-background text-foreground focus:border-accent-blue w-full rounded-md border px-2 py-1 text-sm outline-none disabled:opacity-50"
            />
            {formError && <p className="text-tag-rose text-xs">{formError}</p>}
            <button
              type="submit"
              disabled={sending || !emailInput.trim()}
              className="bg-accent-blue text-foreground hover:bg-accent-blue/90 active:bg-accent-blue/80 flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors duration-100 ease-out disabled:opacity-50"
            >
              {sending ? "Sending…" : "Continue with email"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-surface-hover active:bg-surface-elevated/70 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-100 ease-out"
        >
          <Avatar url={avatarUrl} email={email} />
          <span className="text-foreground-muted flex-1 truncate text-xs">
            {email ?? `${userId?.slice(0, 12)}…`}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onSelect={() => void signOut()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
