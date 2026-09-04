// Service Worker - Afi Studio
// Fokus: bikin HALAMAN ROOT ("/") tetap bisa dibuka saat offline.
// Halaman lain (ranking, feedback, member, dll) SENGAJA tidak di-cache.

const CACHE_NAME = 'afi-studio-root-v10';

// Aset wajib biar root page render sempurna.
// Lucide & Google Fonts sudah tidak dari CDN luar lagi (lihat fonts/ dan icons/),
// jadi sekarang semuanya same-origin dan masuk CORE_ASSETS biasa.
// Catatan: cuma weight yang beneran dipakai index.html yang di-precache di sini
// (bukan semua weight yang ada di folder fonts/), biar cache-nya gak boros.
// Banner1/2/3.webp DIHAPUS dari sini — itu sisa sistem lama waktu banner masih
// file statis. Sekarang banner dimuat dinamis dari banner.json + /api/data/banner
// (lihat Models/script.js), jadi path lama itu udah gak ada filenya sama sekali
// (selalu 404 diem-diem, gak fatal tapi percuma).
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/icon.png',
  '/Models/script.js',
  '/api/data/models',
  '/dist/output.css',
  '/fonts/fonts.css',
  '/fonts/Geist-400.woff2',
  '/fonts/Geist-500.woff2',
  '/fonts/Geist-600.woff2',
  '/fonts/Geist-700.woff2',
  '/fonts/CreatoDisplay-700.woff2',
  '/fonts/Minercraftory.woff2',
  '/fonts/DancingScript-700.woff2',
  '/icons/lucide-local.js',
  '/icons/social-icons.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Aset inti: coba satu-satu, jangan sampai 1 aset gagal (koneksi lemot/putus)
      // bikin SELURUH instalasi service worker gagal (ini yang bikin sebagian
      // device gagal install app-nya walau di device lain lancar).
      await Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch(() => {}) // diem aja kalau 1 aset gagal, gak fatal
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isCoreAsset = isSameOrigin && CORE_ASSETS.includes(url.pathname);

  // Cuma tangani request yang memang kita cache.
  // Request lain (halaman lain, API, dll) dibiarkan lewat jaringan seperti biasa.
  if (isCoreAsset) {
    const isRootPage = url.pathname === '/' || url.pathname === '/index.html';

    if (isRootPage) {
      // Network-first: selalu coba versi terbaru dulu, cache cuma buat offline.
      e.respondWith(
        fetch(e.request)
          .then((res) => {
            if (res && res.status === 200) {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
            }
            return res;
          })
          .catch(() => caches.match(e.request))
      );
      return;
    }

    e.respondWith(
      caches.match(e.request).then((cached) => {
        // Cache-first, tapi tetap update cache di background kalau online (stale-while-revalidate)
        const fetchPromise = fetch(e.request)
          .then((res) => {
            if (res && res.status === 200) {
              const resClone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
            }
            return res;
          })
          .catch(() => cached); // offline -> fallback ke cache

        return cached || fetchPromise;
      })
    );
  }
});