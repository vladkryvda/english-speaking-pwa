const CACHE_NAME = 'vocalize-pwa-v1';

// Базові файли для офлайну
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

// Встановлення: кешуємо статичні файли
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Активація: видаляємо старі кеші, якщо оновили версію
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Перехоплення запитів: спершу шукаємо в кеші, якщо немає — беремо з мережі і кешуємо
self.addEventListener('fetch', (event) => {
  // Пропускаємо не-GET запити або chrome-extension
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Якщо прийшла валідна відповідь (включно зі шрифтами Google) — кешуємо на майбутнє
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Якщо інтернету немає і ресурсу немає в кеші
          return caches.match('./index.html');
        });
    })
  );
});
