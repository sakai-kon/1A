// service-worker.js — オフラインでも基本機能が使えるようにするためのキャッシュ
const CACHE_VERSION = 'choir-player-v5';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './hidden-fix.css',
  './app-hardening.js',
  './app.js',
  './db.js',
  './audio.js',
  './player.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './icon-maskable-192.svg',
  './icon-maskable-512.svg',
];
const OPTIONAL_EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(LOCAL_ASSETS))
      .then(() => caches.open(CACHE_VERSION))
      .then((cache) => Promise.all(
        OPTIONAL_EXTERNAL_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            // CDN障害でService Worker全体のインストールを失敗させない。
          })
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (!res || !res.ok) return res;
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => cached || Response.error());
      })
    );
  } else {
    // CDN等の外部リソースはキャッシュ優先。オンラインなら未キャッシュ時に取得して保存する。
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached || Response.error());
        return cached || fetchPromise;
      })
    );
  }
});
