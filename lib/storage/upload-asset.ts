"use client";

/**
 * Upload an image/PDF to the private Supabase Storage `assets` bucket.
 * Path convention `${userId}/${bookmarkId}.${ext}` matches the RLS policy in
 * supabase/migrations/0007_assets.sql (owner = first path segment). Display URLs
 * are resolved lazily via hooks/use-asset-url.ts (signed URLs).
 */

import { getSupabaseClient } from "@/lib/sync/supabase-client";

export const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB

const TYPE_MAP: Record<string, { kind: "image" | "pdf"; ext: string }> = {
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "application/pdf": { kind: "pdf", ext: "pdf" },
};

export type UploadError =
  | "unsupported"
  | "too_large"
  | "unauthenticated"
  | "upload_failed"
  | "config";

export type UploadResult =
  | { ok: true; kind: "image" | "pdf"; assetPath: string }
  | { ok: false; error: UploadError };

/** Pure validation + type → kind/ext mapping (unit-tested). */
export function classifyAsset(file: {
  type: string;
  size: number;
}):
  | { ok: true; kind: "image" | "pdf"; ext: string }
  | { ok: false; error: UploadError } {
  if (file.size > MAX_ASSET_BYTES) return { ok: false, error: "too_large" };
  const m = TYPE_MAP[file.type];
  if (!m) return { ok: false, error: "unsupported" };
  return { ok: true, kind: m.kind, ext: m.ext };
}

export async function uploadAsset(
  file: File,
  id: string
): Promise<UploadResult> {
  const cls = classifyAsset(file);
  if (!cls.ok) return cls;

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: "config" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const path = `${user.id}/${id}.${cls.ext}`;
  const { error } = await supabase.storage
    .from("assets")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { ok: false, error: "upload_failed" };

  return { ok: true, kind: cls.kind, assetPath: path };
}
