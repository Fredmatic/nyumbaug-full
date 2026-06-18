const CACHE_NAME = "nyumbaug-v3";

self.addEventListener("install", (event) => {
    // Take control immediately without waiting
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            const urlsToCache = [
                "/",
                "/index.html",
                "/css/style.css",
                "/js/api.js",
                "/js/main.js",
                "/icons/icon-192.png",
                "/icons/icon-512.png"
            ];
            // Cache each file individually so one missing/404 file
            // doesn't break the entire install (unlike cache.addAll
            // which is all-or-nothing and throws on any failure).
            return Promise.all(
                urlsToCache.map((url) =>
                    cache.add(url).catch((err) => {
                        console.warn("⚠️ Service worker could not cache:", url, err.message);
                    })
                )
            );
        })
    );
});

self.addEventListener("activate", (event) => {
    // Delete old caches so stale index.html is gone
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    // Only handle GET requests — POST/PATCH/DELETE should always hit the network
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    // For HTML pages: network-first so the browser always gets the latest version
    if (event.request.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname === "/") {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Update cache with the fresh response
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request)) // Fallback to cache if offline
        );
        return;
    }

    // For everything else (CSS, JS, images): cache-first, falling back to network
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) return response;
            return fetch(event.request).catch(() => {
                // If both cache and network fail, just let it fail silently
                // instead of throwing an unhandled error
                return new Response("", { status: 504, statusText: "Offline" });
            });
        })
    );
});