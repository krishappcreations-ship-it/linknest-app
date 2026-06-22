import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Supabase connection targets (REST + Realtime WebSocket)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ?? "https://*.supabase.co";
const supabaseWss = supabaseUrl
  ? supabaseUrl.replace(/^https?:\/\//, "wss://")
  : "wss://*.supabase.co";

const cspDirectives = [
  "default-src 'self'",
  // Next.js App Router inlines hydration JSON — unsafe-inline required.
  // unsafe-eval only in dev (fast refresh).
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  // Framer Motion injects inline styles
  "style-src 'self' 'unsafe-inline'",
  // Bookmark OG images and favicons come from arbitrary domains
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  // Supabase REST (fetch) + Realtime (WebSocket)
  `connect-src 'self' ${supabaseHost} ${supabaseWss}`,
  "frame-src 'none'",
  // frame-ancestors supersedes X-Frame-Options in modern browsers
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Prevents base-tag hijacking
  "base-uri 'self'",
  "form-action 'self'",
  // Only upgrade in production — avoids localhost https issues in dev
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
];

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // HSTS: 2-year max-age, preload-ready. Only meaningful over real TLS.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: cspDirectives.join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // F23 capture: keep Readability external (CJS). jsdom was dropped from the
  // capture path — its import chain crashed the serverless function on Vercel
  // (500 on every /api/capture request); extract-readable now uses linkedom,
  // which bundles fine. jsdom stays a devDependency for the vitest DOM env only.
  serverExternalPackages: ["@mozilla/readability"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
