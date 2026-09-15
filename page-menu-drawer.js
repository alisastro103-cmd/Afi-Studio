/* =========================================================================
   Afi Studio — Kontrol Laci Samping (Side Drawer) untuk Menu Halaman
   -------------------------------------------------------------------------
   Bekerja dengan markup #page-menu-btn / #page-menu-dropdown yang sudah ada
   di navbar tiap halaman publik. Header (judul + tombol tutup) dan overlay
   disisipkan lewat JS di sini, jadi markup di tiap halaman tidak perlu
   diubah satu per satu.

   CATATAN: sebelumnya sempat dicoba restrukturisasi DOM (laci dipindah
   jadi anak #app + flexbox) supaya "satu layer" dengan konten. Itu DITARIK
   BALIK karena struktur tiap halaman ternyata berbeda-beda (ada yang pakai
   flex-col/justify-between, ada yang tidak), jadi restrukturisasi lewat
   satu script yang sama bikin banyak halaman malah rusak (navbar/laci
   hilang, UI bertabrakan). Sekarang kembali ke pendekatan yang lebih aman:
   laci HANYA dipindah jadi anak <body> (tidak menyentuh struktur konten
   apa pun), lalu diposisikan lewat CSS saja (lihat page-menu-drawer.css).

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

    initAccountMenu(drawer);
  }

  // Bagian "Lihat Profil" + avatar (kalau udah login) atau tombol "Masuk"/
  // "Daftar" (kalau belum) di paling atas laci. Markup-nya SAMA PERSIS di
  // 17 halaman (lihat page-menu-profile-preview/-auth) -- sengaja dibikin
  // dimmed & non-interaktif dari awal ("Segera hadir") sampai sistem login
  // Google-nya jadi. Sekarang udah jadi (lihat api/auth.js), jadi diaktifin
  // di sini SEKALI di script bersama ini -- gak perlu ubah markup 17
  // halaman itu satu-satu.
  function initAccountMenu(drawer) {
    var preview = drawer.querySelector('.page-menu-profile-preview');
    var auth = drawer.querySelector('.page-menu-profile-auth');
    if (!preview || !auth) return;

    var avatarEl = preview.querySelector('.page-menu-profile-avatar');
    var ctaEl = preview.querySelector('.page-menu-profile-cta');
    var subEl = preview.querySelector('.page-menu-profile-sub');
    var authBtns = Array.prototype.slice.call(auth.querySelectorAll('.page-menu-profile-auth-btn'));

    var loginUrl = '/api/auth?action=google-login&next=' + encodeURIComponent(window.location.pathname);

    function goToProfile() { window.location.href = '/profil/'; }
    function goToLogin() { window.location.href = loginUrl; }

    function doLogout() {
      fetch('/api/auth?action=logout', { method: 'POST' })
        .catch(function () {})
        .then(function () { window.location.href = '/'; });
    }

    function activatePreview(user) {
      auth.style.display = 'none';
      preview.classList.add('is-ready');
      preview.removeAttribute('aria-disabled');
      preview.setAttribute('role', 'link');
      preview.setAttribute('tabindex', '0');
      preview.addEventListener('click', goToProfile);
      preview.addEventListener('keydown', function (e) { if (e.key === 'Enter') goToProfile(); });

      var photo = user.avatarUrl || user.picture;
      if (photo) {
        avatarEl.innerHTML = '';
        avatarEl.style.backgroundImage = 'url(' + photo + ')';
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
      }
      ctaEl.textContent = user.nickname || user.name || 'Profil';
      subEl.textContent = user.username ? ('@' + user.username) : 'Lihat profil';

      // Tombol "Lihat Profil" & "Keluar" eksplisit -- dibikin dinamis di sini
      // (bukan nambahin markup baru ke 17 halaman satu-satu) supaya tetap satu
      // titik perawatan. Ditaruh sebagai baris baru SETELAH preview (bukan di
      // dalamnya), jadi klik di tombol ini gak bentrok sama klik di seluruh
      // area preview yang udah ngarah ke profil juga.
      if (!preview._afiActionsRow) {
        var actionsRow = document.createElement('div');
        actionsRow.className = 'page-menu-profile-auth is-ready';
        actionsRow.style.marginTop = '8px';

        var viewBtn = document.createElement('span');
        viewBtn.className = 'page-menu-profile-auth-btn page-menu-profile-auth-btn--solid';
        viewBtn.textContent = 'Lihat Profil';
        viewBtn.setAttribute('role', 'link');
        viewBtn.setAttribute('tabindex', '0');
        viewBtn.addEventListener('click', goToProfile);
        viewBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter') goToProfile(); });

        var logoutBtn = document.createElement('span');
        logoutBtn.className = 'page-menu-profile-auth-btn page-menu-profile-auth-btn--outline';
        logoutBtn.textContent = 'Keluar';
        logoutBtn.setAttribute('role', 'link');
        logoutBtn.setAttribute('tabindex', '0');
        logoutBtn.addEventListener('click', doLogout);
        logoutBtn.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogout(); });

        actionsRow.appendChild(viewBtn);
        actionsRow.appendChild(logoutBtn);
        preview.parentNode.insertBefore(actionsRow, preview.nextSibling);
        preview._afiActionsRow = actionsRow;
      }
    }

    function activateAuth() {
      preview.style.display = 'none';
      auth.classList.add('is-ready');
      auth.removeAttribute('aria-disabled');
      authBtns.forEach(function (btn) {
        btn.setAttribute('role', 'link');
        btn.setAttribute('tabindex', '0');
        btn.addEventListener('click', goToLogin);
        btn.addEventListener('keydown', function (e) { if (e.key === 'Enter') goToLogin(); });
      });
    }

    fetch('/api/auth?action=me')
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data && result.data.user) {
          activatePreview(result.data.user);
        } else {
          activateAuth();
        }
      })
      .catch(function () {
        // Gagal ngecek (mis. lagi offline) -- biarin placeholder dimmed
        // default apa adanya, daripada nampilin tombol yang salah.
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
