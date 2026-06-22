"use client";
import { getSupabaseClient } from "./supabase-client";

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function signInWithEmail(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: "Sync not configured" };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthChange(
  cb: (
    user: {
      id: string;
      email: string | null;
      avatarUrl: string | null;
    } | null
  ) => void
) {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_, session) => {
    if (!session?.user) {
      cb(null);
      return;
    }
    cb({
      id: session.user.id,
      email: session.user.email ?? null,
      avatarUrl:
        (session.user.user_metadata?.avatar_url as string | null) ?? null,
    });
  });
  return () => data.subscription.unsubscribe();
}

export async function getSession() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
