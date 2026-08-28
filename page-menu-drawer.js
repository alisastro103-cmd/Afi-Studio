/* =========================================================================
   Afi Studio — Kontrol Laci Samping (Side Drawer) untuk Menu Halaman
   -------------------------------------------------------------------------
   Bekerja dengan markup #page-menu-btn / #page-menu-dropdown yang sudah ada
   di navbar tiap halaman publik. Header (judul + tombol tutup) dan overlay
   disisipkan lewat JS di sini, jadi markup di tiap halaman tidak perlu
   diubah satu per satu.

   - Mobile/tablet (<1024px): tombol membuka/menutup laci + overlay (laci
     jadi anak langsung <body>, posisinya fixed & meluncur dari kanan).

   - Desktop (>=1024px): PENDEKATAN BARU — sebelumnya laci dipindah jadi
     anak <body> lalu diposisikan `position:fixed` dengan lebar dihitung
     manual (100vw dikurangi lebar laci). Kombinasi `fixed` + `zoom` +
     `backdrop-filter` itu terbukti gampang meleset di banyak browser/WebView
     (itulah kenapa perbaikan sebelumnya kelihatan "gak ngefek" walau
     kodenya sudah benar). Sekarang laci dipindah jadi ANAK LANGSUNG #app,
     disandingkan dengan sisa konten halaman lewat flexbox (#app-content-row
     > #app-main-col + laci), lalu laci cukup pakai `position: sticky` —
     sama seperti navbar (juga sticky, bukan fixed lagi). Sticky dihitung
     relatif ke scroll container (#app) langsung dari alur layout yang
     sudah ter-zoom, jadi tidak ada lagi kalkulasi lebar/zoom manual yang
     bisa meleset. Laci jadi betul-betul "satu layer" dengan konten
     (banner, Models, marquee, dll — karena sama-sama di dalam alur normal
     #app), tapi tetap "menempel"/tidak ikut ke-scroll hilang, persis
     seperti sifat navbar.
   ========================================================================= */
(function () {
  function init() {
    var btn = document.getElementById('page-menu-btn');
    var drawer = document.getElementById('page-menu-dropdown');
    var app = document.getElementById('app');
    if (!btn || !drawer) return;

    // Bungkus isi laci yang sudah ada dengan header (judul + tombol tutup)
    // dan wrapper body, hanya sekali. (Dilakukan sebelum laci dipindah-
    // pindah, supaya isinya tidak perlu dibongkar ulang tiap kali breakpoint
    // berubah.)
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
      // Overlay tetap SELALU anak <body> (cuma dipakai di mobile/tablet
      // sebagai latar gelap di belakang laci yang meluncur masuk).
      document.body.appendChild(overlay);
    }

    function isDesktop() {
      return window.matchMedia('(min-width: 1024px)').matches;
    }

    // --- Penataan ulang posisi laci sesuai lebar layar -----------------
    var contentRow = null;
    var mainCol = null;

    // PENTING (akar bug "navbar/laci turun ke bawah"): tiap halaman punya
    // script inline terpisah yang mengukur tinggi navbar (--nav-h) SEKALI,
    // segera setelah </nav> — momen itu laci MASIH nempel di dalam <nav>.
    // Karena di desktop laci sekarang position:sticky (ikut alur normal,
    // bukan fixed lagi), tingginya numpang ke navbar saat masih nempel di
    // situ, jadi navbar "terukur" jauh lebih tinggi dari aslinya (navbar +
    // seluruh isi laci). Angka salah itu lalu dipakai lagi sebagai jarak
    // `top` laci itu sendiri (lihat CSS), jadi laci ketarik turun jauh.
    // Perbaikannya: ukur ULANG tinggi navbar di sini, SETELAH laci
    // dipastikan sudah dipindah keluar dari <nav> (baik ke #app-content-row
    // maupun ke <body>), supaya --nav-h selalu benar.
    function syncNavHeight() {
      var nav = document.querySelector('.nav-bar, .navbar');
      if (nav) {
        document.documentElement.style.setProperty('--nav-h', nav.getBoundingClientRect().height + 'px');
      }
    }

    function ensureDesktopLayout() {
      if (!app || contentRow) return;
      var nav = app.querySelector('.nav-bar, .navbar');

      contentRow = document.createElement('div');
      contentRow.id = 'app-content-row';
      mainCol = document.createElement('div');
      mainCol.id = 'app-main-col';

      // Beberapa halaman (ranking, Models, tutorial, bantuan, favorit)
      // memberi #app sendiri class "flex flex-col justify-between" —
      // trik supaya footer terdorong ke bawah kalau konten halamannya
      // pendek. Supaya perilaku itu TIDAK berubah setelah #app-main-col
      // membungkus isi asli #app (selain navbar), class tsb dipindah ke
      // #app-main-col (dicatat di app._afiJustifyBetween supaya bisa
      // dikembalikan lagi ke #app saat resize balik ke mobile).
      if (app.classList.contains('justify-between')) {
        app._afiJustifyBetween = true;
        mainCol.classList.add('flex', 'flex-col', 'justify-between', 'h-full');
        app.classList.remove('flex', 'flex-col', 'justify-between');
      }

      var kids = Array.prototype.slice.call(app.children);
      kids.forEach(function (kid) {
        if (kid === nav) return;
        mainCol.appendChild(kid);
      });

      contentRow.appendChild(mainCol);
      contentRow.appendChild(drawer); // otomatis "mencabut" laci dari lokasi lamanya
      app.appendChild(contentRow);
      syncNavHeight();
    }

    function teardownDesktopLayout() {
      if (app && contentRow) {
        while (mainCol.firstChild) {
          app.insertBefore(mainCol.firstChild, contentRow);
        }
        app.removeChild(contentRow);
        contentRow = null;
        mainCol = null;
        if (app._afiJustifyBetween) {
          app.classList.add('flex', 'flex-col', 'justify-between');
          app._afiJustifyBetween = false;
        }
      }
      // PENTING: `.nav-bar` (induk asli laci ini di markup) memakai
      // `backdrop-filter`, yang membuatnya jadi "containing block" baru
      // untuk anak `position: fixed`. Di mobile/tablet, laci masih pakai
      // `position: fixed` (meluncur dari kanan) — jadi tetap wajib jadi
      // anak langsung <body>, bukan dibiarkan di dalam <nav>.
      if (drawer.parentElement !== document.body) {
        document.body.appendChild(drawer);
      }
      syncNavHeight();
    }

    function syncDrawerLayout() {
      if (isDesktop()) {
        ensureDesktopLayout();
      } else {
        teardownDesktopLayout();
      }
    }

    syncDrawerLayout();

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
      syncDrawerLayout();
      if (isDesktop()) closeDrawer();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
