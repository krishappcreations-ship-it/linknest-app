/**
 * Screenshot-service fallback for the preview pipeline.
 *
 * When a page exposes no og:image / twitter:image, we use a live screenshot of
 * the page itself as the preview. WordPress mShots is free and key-less; the
 * target URL is single-encoded into the path. Width is tuned for the
 * aspect-video bookmark card. See lib/preview/fetch-preview.ts (injection point).
 */

export const SCREENSHOT_WIDTH = 1280;

export function screenshotFallbackUrl(pageUrl: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(
    pageUrl
  )}?w=${SCREENSHOT_WIDTH}`;
}
