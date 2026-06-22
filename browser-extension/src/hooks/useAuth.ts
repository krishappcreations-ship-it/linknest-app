import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; userId: string };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setState({ status: "authenticated", userId: data.session.user.id });
      } else {
        setState({ status: "unauthenticated" });
      }
    });
  }, []);

  async function signIn(
    email: string,
    password: string
  ): Promise<string | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      return error?.message ?? "Sign in failed";
    }
    setState({ status: "authenticated", userId: data.user.id });
    return null;
  }

  async function signInWithGoogle(): Promise<string | null> {
    // The browser-action popup closes the moment it loses focus, which
    // launchWebAuthFlow forces — so the OAuth flow runs in the persistent
    // service worker (see background.ts) and writes the session to
    // chrome.storage. We just trigger it and re-read the session here. If the
    // popup got torn down mid-flow, the next open picks the session up via
    // getSession() on mount.
    const res = (await chrome.runtime.sendMessage({
      type: "google-signin",
    })) as { userId?: string; error?: string } | undefined;

    if (!res || res.error || !res.userId) {
      return res?.error ?? "Could not complete sign-in";
    }
    setState({ status: "authenticated", userId: res.userId });
    return null;
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
    await chrome.storage.local.clear();
    setState({ status: "unauthenticated" });
  }

  return { state, signIn, signInWithGoogle, signOut };
}
