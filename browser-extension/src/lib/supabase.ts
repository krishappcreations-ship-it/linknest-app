import { createClient } from "@supabase/supabase-js";

const chromeStorage = {
  getItem: (key: string): Promise<string | null> =>
    chrome.storage.local.get(key).then((r) => (r[key] as string) ?? null),
  setItem: (key: string, val: string): Promise<void> =>
    chrome.storage.local.set({ [key]: val }),
  removeItem: (key: string): Promise<void> => chrome.storage.local.remove(key),
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  {
    auth: {
      storage: chromeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // PKCE so the Google flow (chrome.identity.launchWebAuthFlow) returns a
      // ?code= we exchange via exchangeCodeForSession. See hooks/useAuth.ts.
      flowType: "pkce",
    },
  }
);
