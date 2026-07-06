// theme-toggle.js
// Menangani klik tombol ganti tema (light/dark) di semua halaman Afi Studio.
// Preferensi tersimpan di localStorage; kalau belum pernah dipilih manual,
// tema mengikuti sistem perangkat (prefers-color-scheme) secara live.
(function () {
  var STORAGE_KEY = 'afi-theme';

  function initToggle() {
    var btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    });

    // Selama user belum pernah pilih manual, ikuti perubahan tema sistem secara live.
    if (!localStorage.getItem(STORAGE_KEY) && window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
        if (!localStorage.getItem(STORAGE_KEY)) {
          document.documentElement.classList.toggle('dark', e.matches);
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle);
  } else {
    initToggle();
  }
})();