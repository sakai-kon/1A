// service-worker.js — オフラインでも基本機能が使えるようにするためのキャッシュ
const CACHE_VERSION = 'choir-player-v4';
const CORE_ASSETS = [
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
  // バックアップ/復元機能が初回オフラインでも使えるようJSZipも事前キャッシュする。
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
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
    // CDN等の外部リソースはキャッシュ優先。オンラインなら更新版も保存する。
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
