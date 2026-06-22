import { createClient } from "@supabase/supabase-js";

// Minimal MV3 service worker.
// - Keeps the Supabase auth token refreshed between popup opens.
// - Owns the Google OAuth flow: the browser-action popup closes the instant it
//   loses focus (which launchWebAuthFlow forces), so running the flow in the
//   popup means exchangeCodeForSession never fires. The service worker persists
//   across that focus change, so it drives the whole flow and writes the session
//   to chrome.storage; the popup then re-reads it via getSession on next render.

const chromeStorage = {
  getItem: (key: string): Promise<string | null> =>
    chrome.storage.local.get(key).then((r) => (r[key] as string) ?? null),
  setItem: (key: string, val: string): Promise<void> =>
    chrome.storage.local.set({ [key]: val }),
  removeItem: (key: string): Promise<void> => chrome.storage.local.remove(key),
};

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  {
    auth: {
      storage: chromeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);

supabase.auth.onAuthStateChange(() => {
  // autoRefreshToken handles token renewal; listener keeps the worker registered
});

async function googleSignIn(): Promise<{ userId?: string; error?: string }> {
  const redirectTo = chrome.identity.getRedirectURL();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    return { error: error?.message ?? "Could not start Google sign-in" };
  }

  let responseUrl: string;
  try {
    responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: data.url, interactive: true },
        (res) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr || !res) {
            reject(new Error(lastErr?.message ?? "Sign-in cancelled"));
          } else {
            resolve(res);
          }
        }
      );
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sign-in cancelled" };
  }

  const code = new URL(responseUrl).searchParams.get("code");
  if (!code) return { error: "No authorization code returned" };

  const { data: sess, error: exErr } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exErr || !sess.user) {
    return { error: exErr?.message ?? "Could not complete sign-in" };
  }
  return { userId: sess.user.id };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "google-signin") {
    googleSignIn().then(sendResponse);
    return true; // keep the message channel open for the async response
  }
  return undefined;
});
