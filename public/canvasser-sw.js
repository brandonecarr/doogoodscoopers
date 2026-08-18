// Canvasser PWA service worker (scope: /app/canvasser).
// Independent of the field sw.js. Purpose: make the app shell installable and let
// previously-viewed pages + map tiles load offline. It does NOT queue writes —
// offline durability for pins/leads is handled client-side by the IndexedDB
// outbox (src/lib/pwa/canvasser-outbox.ts), which is more reliable for our POSTs.

const CACHE = "dgs-canvasser-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("dgs-canvasser-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // POSTs go straight to network; outbox handles offline

  const url = new URL(req.url);

  // Map tiles / Mapbox assets: cache-first, best-effort (opaque responses ok).
  if (url.hostname.endsWith("mapbox.com")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // Canvasser navigations: network-first, fall back to the last cached page.
  if (url.origin === self.location.origin && url.pathname.startsWith("/app/canvasser")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
          return res;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match(req)) || (await cache.match("/app/canvasser")) || Response.error();
        }
      })()
    );
    return;
  }

  // Same-origin static build assets: cache-first.
  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/images/"))) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      })
    );
  }
});
