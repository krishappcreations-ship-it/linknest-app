"use client";

import { signInWithGoogle } from "@/lib/sync/auth-client";
import { LoginDialog } from "./login-dialog";

/**
 * Landing hero CTAs. "Get Started" runs Google OAuth one-click (primary);
 * "Login" opens the dialog with Google + email. Both resolve to the same
 * Supabase flow — new accounts are created on first sign-in — so either entry
 * point works for new and returning users.
 */
export function AuthCtas() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={signInWithGoogle}
        className="bg-accent-blue text-foreground hover:bg-accent-blue/90 inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium shadow-lg shadow-black/20 transition-colors duration-100 ease-out active:translate-y-px"
      >
        Get started
      </button>
      <LoginDialog
        trigger={
          <button
            type="button"
            className="border-border-strong bg-surface hover:bg-surface-hover text-foreground inline-flex items-center justify-center rounded-md border px-5 py-2.5 text-sm font-medium transition-colors duration-100 ease-out active:translate-y-px"
          >
            Log in
          </button>
        }
      />
    </div>
  );
}
