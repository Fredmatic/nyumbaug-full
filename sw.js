const CACHE_NAME = "nyumbaug-v2";

self.addEventListener("install", (event) => {
    // Take control immediately without waiting
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(["/", "/index.html"]);
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

    // For everything else (CSS, JS, images): cache-first
    event.respondWith(
        caches.match(event.request).then((response) => response || fetch(event.request))
    );
});