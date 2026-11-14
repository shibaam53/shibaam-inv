// Shibaam Enterprises — Service Worker (PWA)
// IMPORTANT (AGENTS.md §10): Never cache authenticated API responses or stock data in a service worker.
// Stale stock is a correctness bug. Supabase API calls are ALWAYS strictly network-only.

const CACHE_NAME = "shibaam-shell-v1";
const STATIC_SHELL_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.png",
  "/logo-icon.png",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png"
];

// Install: Cache static app shell assets and activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS).catch((err) => {
        console.warn("[SW] Some assets failed to pre-cache:", err);
      });
    })
  );
});

// Activate: Clean up previous cache versions and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strictly bypass database/API requests; serve static assets safely
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. NON-GET requests (POST, PUT, DELETE, PATCH): Always strictly network-only
  if (event.request.method !== "GET") {
    return;
  }

  // 2. SUPABASE / BACKEND / API / AUTH: Never cache. Always live network.
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/storage/") ||
    url.pathname.includes("/rpc/")
  ) {
    return; // Pass through to browser network directly
  }

  // 3. Navigation requests (HTML document for SPA routes like /app/inventory):
  // Network-first, fallback to cached shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match("/");
      })
    );
    return;
  }

  // 4. Static Compiled Assets (Vite assets / JS / CSS / images):
  // Stale-While-Revalidate for instant launch
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

