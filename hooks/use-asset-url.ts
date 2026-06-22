"use client";

/**
 * Resolves a signed display URL for an `assetPath` in the private `assets`
 * bucket. Cached per path in-memory (1h TTL, refreshed before expiry); returns
 * null when not signed-in / Supabase not configured. Used by the bookmark card
 * for image/pdf items.
 */

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/sync/supabase-client";

const TTL_S = 3600;
const cache = new Map<string, { url: string; exp: number }>();

export function useAssetUrl(
  assetPath: string | null | undefined
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!assetPath) return null;
    const c = cache.get(assetPath);
    return c && c.exp > Date.now() ? c.url : null;
  });

  useEffect(() => {
    if (!assetPath) {
      setUrl(null);
      return;
    }
    const cached = cache.get(assetPath);
    if (cached && cached.exp > Date.now()) {
      setUrl(cached.url);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.storage
      .from("assets")
      .createSignedUrl(assetPath, TTL_S)
      .then(({ data }) => {
        if (cancelled || !data?.signedUrl) return;
        cache.set(assetPath, {
          url: data.signedUrl,
          exp: Date.now() + (TTL_S - 60) * 1000,
        });
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [assetPath]);

  return url;
}
