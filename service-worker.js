// service-worker.js — オフラインでも基本機能が使えるようにするためのキャッシュ
const CACHE_VERSION = 'choir-player-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './audio.js',
  './player.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable-192.svg',
  './icons/icon-maskable-512.svg',
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
    // アプリ本体：キャッシュ優先、なければネットワーク→キャッシュへ保存
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => cached);
      })
    );
  } else {
    // 外部リソース（フォント・JSZipなど）：取得できたらキャッシュに保存しつつ返す。
    // オフライン時はキャッシュがあればそれを使い、それ以外は失敗をそのまま伝える。
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
