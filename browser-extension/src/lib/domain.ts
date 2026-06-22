// Copied from types/index.ts — no cross-package import from Next.js app.

export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  if (
    (u.protocol === "http:" && u.port === "80") ||
    (u.protocol === "https:" && u.port === "443")
  ) {
    u.port = "";
  }
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }
  // WHATWG URL returns "" hash for both no-fragment and empty-fragment URLs.
  // Detect empty fragment via href and clear it (sets fragment to null).
  if (u.href.endsWith("#")) u.hash = "";
  return u.toString();
}

/** Extract registrable domain (host without leading "www."). */
export function extractDomain(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}
