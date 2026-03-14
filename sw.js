const CACHE_NAME = "corpo-correcao-completa-v1";
const ASSETS = ["./","./index.html","./style.css","./app.js","./manifest.webmanifest","./assets/scale.svg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))); });
self.addEventListener("fetch", e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
