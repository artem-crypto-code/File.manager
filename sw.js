// Простой офлайн-кэш: локальные файлы и CDN-библиотеки
const VERSION = 'filemanager-v1';

const LOCAL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './theme.js',
  './manifest.webmanifest',
  './icon.svg',
];

const CDN = [
  'https://unpkg.com/lucide@latest',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(LOCAL.concat(CDN)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Локальные файлы: сеть, при отсутствии сети — кэш
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // Библиотеки: сначала кэш, потом сеть с дозаписью в кэш
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const copy = response.clone();
        caches.open(VERSION).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});
