const CACHE_NAME = 'orator-cache-v1';

// Список ресурсів для негайного збереження в офлайн-пам'ять
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './data.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

// 1. Інсталяція: кешуємо ядро додатку
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Активація: видаляємо старі версії кешу, якщо оновився код
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Перехоплення запитів: працюємо строго офлайн
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Для бази data.json: спершу віддаємо з кешу, але оновлюємо у фоні, якщо є інтернет
  if (url.pathname.endsWith('data.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Для всього іншого (HTML, іконки, стилі) — чистий Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Кешуємо зовнішні ресурси (наприклад, шрифти Google Fonts), якщо вони завантажились
        if (response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // Якщо офлайн і ресурс не знайдено — повертаємо головний index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
