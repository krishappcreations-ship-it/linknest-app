/* LinkNest service worker (feature 33). Network-first navigation + offline
   fallback + stale-while-revalidate for static assets. Mirrors
   lib/pwa/sw-strategy.ts. */
const CACHE = "linknest-shell-v1";
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("linknest-shell-") && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function strategyFor(req, url) {
  const sameOrigin = url.origin === self.location.origin;
  if (req.method !== "GET" || !sameOrigin) return "passthrough";
  if (url.pathname.startsWith("/api/") || url.pathname.includes(".worker"))
    return "passthrough";
  if (req.mode === "navigate") return "network-first";
  if (
    ["/_next/static", "/icon", "/manifest"].some((p) =>
      url.pathname.startsWith(p)
    )
  )
    return "swr";
  return "passthrough";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const strategy = strategyFor(req, url);
  if (strategy === "passthrough") return;

  if (strategy === "network-first") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/offline"))
        )
    );
    return;
  }

  // swr
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => hit);
      return hit || fetchPromise;
    })
  );
});
