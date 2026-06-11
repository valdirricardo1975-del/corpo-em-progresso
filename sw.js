const CACHE_NAME = "corpo-em-progresso-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./chart.umd.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // nunca intercepta a API de sincronização
  if (url.hostname === "jsonblob.com") return;
  if (e.request.method !== "GET") return;

  // CDN (Chart.js, fontes): cache-first com preenchimento em segundo plano
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const rede = fetch(e.request).then(resp => {
          if (resp && resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, copia));
          }
          return resp;
        }).catch(() => cached);
        return cached || rede;
      })
    );
    return;
  }

  // mesma origem: rede primeiro (pega atualizações), cache como reserva
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp && resp.ok) {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copia));
      }
      return resp;
    }).catch(() =>
      caches.match(e.request).then(r => r || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined))
    )
  );
});
