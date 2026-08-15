/* =========================================================================
   Afi Studio — Kontrol Laci Samping (Side Drawer) untuk Menu Halaman
   -------------------------------------------------------------------------
   Bekerja dengan markup #page-menu-btn / #page-menu-dropdown yang sudah ada
   di navbar tiap halaman publik. Header (judul + tombol tutup) dan overlay
   disisipkan lewat JS di sini, jadi markup di tiap halaman tidak perlu
   diubah satu per satu.

   - Mobile/tablet (<1024px): tombol membuka/menutup laci + overlay.
   - Desktop (>=1024px): laci selalu terbuka (diatur lewat CSS), skrip ini
     hanya memastikan overlay & status "locked" body ikut ditutup saat
     layar melebar melewati breakpoint 1024px.
   ========================================================================= */
(function () {
  function init() {
    var btn = document.getElementById('page-menu-btn');
    var drawer = document.getElementById('page-menu-dropdown');
    if (!btn || !drawer) return;

    // PENTING: `.nav-bar` (induk laci ini di markup asli) memakai
    // `backdrop-filter`, dan properti itu membuat elemen tersebut jadi
    // "containing block" baru untuk anak-anaknya yang `position: fixed`.
    // Akibatnya top/right/bottom laci dihitung relatif ke kotak navbar
    // (tinggi ±60px), bukan ke seluruh layar. Perbaikannya: pindahkan
    // (portal) laci supaya jadi anak langsung <body> (BUKAN <html>,
    // supaya laci tetap ikut `zoom` yang dipakai <body> di mobile/tablet
    // — biar ukuran teks & ikonnya senada dengan sisa halaman; sisi
    // tinggi yang ikut menyusut akibat zoom itu sudah dikompensasi lewat
    // `calc(100dvh / <faktor-zoom>)` di page-menu-drawer.css).
    if (drawer.parentElement !== document.body) {
      document.body.appendChild(drawer);
    }

    // Bungkus isi laci yang sudah ada dengan header (judul + tombol tutup)
    // dan wrapper body, hanya sekali.
    if (!drawer.querySelector('.page-menu-drawer-header')) {
      var existingChildren = Array.prototype.slice.call(drawer.children);

      var header = document.createElement('div');
      header.className = 'page-menu-drawer-header';
      header.innerHTML =
        '<span class="page-menu-drawer-title">Menu Halaman</span>' +
        '<button type="button" class="page-menu-drawer-close" aria-label="Tutup menu">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>' +
        '</button>';

      var body = document.createElement('div');
      body.className = 'page-menu-drawer-body';
      existingChildren.forEach(function (child) {
        body.appendChild(child);
      });

      drawer.innerHTML = '';
      drawer.appendChild(header);
      drawer.appendChild(body);
    }

    var closeBtn = drawer.querySelector('.page-menu-drawer-close');

    var overlay = document.getElementById('page-menu-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'page-menu-overlay';
      // Sama seperti laci: overlay juga anak langsung <body> (ikut zoom,
      // tapi overlay cuma latar polos jadi tidak perlu kompensasi tinggi).
      document.body.appendChild(overlay);
    }

    function isDesktop() {
      return window.matchMedia('(min-width: 1024px)').matches;
    }

    function openDrawer() {
      if (isDesktop()) return;
      drawer.classList.add('open');
      overlay.classList.add('open');
      document.body.classList.add('page-menu-locked');
      btn.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
      document.body.classList.remove('page-menu-locked');
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'page-menu-dropdown');

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isDesktop()) return;
      if (drawer.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // Tutup laci begitu salah satu link menu dipilih (mobile).
    drawer.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (link) closeDrawer();
    });

    window.addEventListener('resize', function () {
      if (isDesktop()) closeDrawer();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
