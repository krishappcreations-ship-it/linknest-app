/**
 * In-process sliding-window rate limiter.
 *
 * Survives warm serverless invocations; resets on cold starts.
 * Sufficient for MVP abuse prevention — swap `windows` for a Redis store
 * (e.g. Upstash) if multi-instance coordination is needed.
 */

const windows = new Map<string, number[]>();

export interface RateLimitConfig {
  /** Window size in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per key within the window. */
  max: number;
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

export function checkRateLimit(
  key: string,
  { windowMs, max }: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const prior = windows.get(key);
  const inWindow = prior ? prior.filter((t) => t > cutoff) : [];

  if (inWindow.length >= max) {
    // Earliest timestamp in window determines when a slot opens
    const retryAfterMs = inWindow[0] + windowMs - now;
    return { ok: false, retryAfterMs };
  }

  inWindow.push(now);
  windows.set(key, inWindow);
  return { ok: true };
}

/** Extracts the real client IP from Vercel/reverse-proxy forwarded headers. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
