"use client";

import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { signInWithGoogle, signInWithEmail } from "@/lib/sync/auth-client";
import { GoogleGlyph } from "./google-glyph";

type Mode = "buttons" | "email-form" | "email-sent";

/**
 * Login dialog for the landing page. Renders the "Login" CTA as its own trigger
 * and offers Google + email-OTP — the same two paths the in-app sidebar uses
 * (lib/sync/auth-client.ts). Supabase auto-creates accounts, so this also works
 * for first-time visitors. Uses the @/components/ui Dialog wrapper (never raw
 * Radix) so it inherits the design-system fade+zoom entry.
 */
export function LoginDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("buttons");
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function reset() {
    setMode("buttons");
    setEmailInput("");
    setSending(false);
    setFormError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-lg font-semibold tracking-tight">
          Welcome to LinkNest
        </DialogTitle>
        <DialogDescription className="text-foreground-muted mt-1 text-sm">
          Sign in to sync your bookmarks across devices.
        </DialogDescription>

        {mode === "email-sent" ? (
          <div className="mt-5 space-y-2">
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
        ) : (
          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="border-border bg-surface-elevated hover:bg-surface-hover text-foreground flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-100 ease-out active:translate-y-px"
            >
              <GoogleGlyph />
              Continue with Google
            </button>

            {mode === "buttons" && (
              <button
                type="button"
                onClick={() => setMode("email-form")}
                className="text-foreground-subtle hover:text-foreground-muted block w-full text-center text-xs transition-colors duration-100 ease-out"
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
                  if (result.ok) setMode("email-sent");
                  else setFormError(result.error);
                }}
                className="space-y-2"
              >
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  disabled={sending}
                  className="border-border bg-background text-foreground focus:border-accent-blue w-full rounded-md border px-3 py-2 text-sm outline-none disabled:opacity-50"
                />
                {formError && (
                  <p className="text-tag-rose text-xs">{formError}</p>
                )}
                <button
                  type="submit"
                  disabled={sending || !emailInput.trim()}
                  className="bg-accent-blue text-foreground hover:bg-accent-blue/90 flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-100 ease-out active:translate-y-px disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Continue with email"}
                </button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
