// Vite injects import.meta.env at build time. Declared directly (not via
// `vite/client`, which pulls Vite's node types and collides here). Only the env
// vars the extension reads are typed.

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_LINKNEST_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
