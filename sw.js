const CACHE_NAME = 'vocalize-offline-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com'
];

// 1. При встановленні: примусово кешуємо сторінку та стилі
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          fetch(url)
            .then((res) => {
              if (res.ok || res.type === 'opaque') {
                return cache.put(url, res);
              }
            })
            .catch((err) => console.warn('Cache error for:', url, err))
        )
      );
    })
  );
});

// 2. При активації: очищаємо старі кеші та беремо контроль над вкладками
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. При запитах: якщо офлайн — миттєво віддаємо з пам'яті телефону
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Якщо це відкриття сторінки (навігація)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          // ОФЛАЙН: миттєво повертаємо index.html із кешу
          const cached = await caches.match('./index.html') || await caches.match('./');
          return cached;
        })
    );
    return;
  }

  // Для скриптів, шрифтів і стилів: спочатку кеш, потім мережа
  event.respondWith(
    caches.match(event.request).then((cachedRes) => {
      if (cachedRes) {
        // Оновлюємо у фоні, якщо з'явився інтернет
        fetch(event.request).then((networkRes) => {
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkRes));
          }
        }).catch(() => {});
        return cachedRes;
      }

      return fetch(event.request).then((networkRes) => {
        if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkRes;
      }).catch(() => {});
    })
  );
});
