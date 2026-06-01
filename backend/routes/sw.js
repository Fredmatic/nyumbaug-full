self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('nyumbaug-cache').then((cache) => {
            return cache.addAll(['/', '/index.html', '/css/style.css']);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});