/**
 * filter-board.js — logika buka/tutup laci (drawer) kategori pada board
 * pencarian + kategori gabungan. Dipakai di Beranda, Models, dan Video &
 * Tutorial lewat <script src="/filter-board.js" defer>.
 *
 * Tiap tombol dropdown ".filter-dropdown-btn" ditandai
 * data-drawer-target="ID_LACI" yang menunjuk ke elemen ".filter-drawer"
 * dengan id yang sama. Klik tombolnya => toggle class "open" di tombol
 * & lacinya. Cuma satu laci yang boleh terbuka dalam satu waktu (kalau ada
 * 2 dropdown, misal di halaman Models), dan laci otomatis tertutup kalau
 * klik di luar board.
 */
(function () {
  // Menempelkan laci (drawer) persis di bawah tombol yang memicunya,
  // dihitung dari posisi ASLI tombol di layar (getBoundingClientRect),
  // bukan lagi ditebak lewat CSS top/right statis relatif ke board.
  // Ini yang bikin popup-nya selalu pas ke mana pun tombolnya berada,
  // di layar berapa pun ukurannya, dan gak lagi "nempel" di posisi lama.
  function positionDrawer(drawer, btn) {
    const GAP = 8; // jarak popup ke tombol
    const EDGE = 16; // jarak minimal ke tepi layar

    // Reset dulu supaya lebar drawer terukur natural (max-content),
    // baru diukur ulang setelah itu.
    drawer.style.left = '0px';
    drawer.style.top = '0px';

    const btnRect = btn.getBoundingClientRect();
    const drawerRect = drawer.getBoundingClientRect();

    // Defaultnya rata kanan ke tombol (pojok kanan drawer = pojok kanan
    // tombol), sama seperti tampilan dropdown pada umumnya.
    let left = btnRect.right - drawerRect.width;
    // Kalau kepentok tepi kiri layar, geser supaya tetap kelihatan penuh.
    if (left < EDGE) left = Math.max(EDGE, btnRect.left);
    // Kalau kepentok tepi kanan layar, tarik balik ke dalam.
    const maxLeft = window.innerWidth - drawerRect.width - EDGE;
    if (left > maxLeft) left = Math.max(EDGE, maxLeft);

    let top = btnRect.bottom + GAP;
    // Kalau ruang di bawah tombol gak cukup (mis. tombolnya di bagian
    // bawah layar), tampilkan di ATAS tombol sebagai gantinya.
    const spaceBelow = window.innerHeight - btnRect.bottom;
    if (spaceBelow < drawerRect.height + GAP && btnRect.top > drawerRect.height + GAP) {
      top = btnRect.top - drawerRect.height - GAP;
    }

    drawer.style.left = Math.round(left) + 'px';
    drawer.style.top = Math.round(top) + 'px';
  }

  function closeAllDrawers(except) {
    document.querySelectorAll('.filter-drawer.open').forEach((drawer) => {
      if (drawer === except) return;
      drawer.classList.remove('open');
      const btn = document.querySelector(
        '.filter-dropdown-btn[data-drawer-target="' + drawer.id + '"]'
      );
      if (btn) {
        btn.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function initSearchToggle() {
    var toggleBtn = document.getElementById('search-toggle-btn');
    var board = document.getElementById('filter-board-main') || document.querySelector('.filter-board');
    if (!toggleBtn || !board) return;

    function setOpen(open) {
      board.classList.toggle('open', open);
      toggleBtn.classList.toggle('active', open);
      toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) {
        closeAllDrawers(null);
      } else {
        var input = board.querySelector('.filter-search-input');
        if (input) {
          window.setTimeout(function () { input.focus(); }, 60);
        }
      }
    }

    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!board.classList.contains('open'));
    });

    // Klik di luar board & di luar tombolnya sendiri -> tutup board.
    document.addEventListener('click', function (e) {
      if (e.target.closest('.filter-board') || e.target.closest('#search-toggle-btn')) return;
      if (board.classList.contains('open')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && board.classList.contains('open')) setOpen(false);
    });
  }

  function init() {
    const boards = document.querySelectorAll('.filter-board');
    if (!boards.length) return;

    initSearchToggle();

    document.querySelectorAll('.filter-dropdown-btn[data-drawer-target]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-drawer-target');
        const drawer = document.getElementById(targetId);
        if (!drawer) return;

        const willOpen = !drawer.classList.contains('open');
        closeAllDrawers(willOpen ? drawer : null);
        if (willOpen) positionDrawer(drawer, btn);
        drawer.classList.toggle('open', willOpen);
        btn.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });

    // Kalau layar di-resize / HP diputar selagi laci lagi kebuka, hitung
    // ulang posisinya supaya tetap pas nempel ke tombolnya.
    window.addEventListener('resize', () => {
      const openDrawer = document.querySelector('.filter-drawer.open');
      if (!openDrawer) return;
      const openBtn = document.querySelector(
        '.filter-dropdown-btn[data-drawer-target="' + openDrawer.id + '"]'
      );
      if (openBtn) positionDrawer(openDrawer, openBtn);
    });

    // Klik di luar board manapun -> tutup semua laci yang lagi terbuka.
    document.addEventListener('click', (e) => {
      if (e.target.closest('.filter-board')) return;
      closeAllDrawers(null);
    });

    // Tombol Escape -> tutup laci, memudahkan pengguna keyboard.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllDrawers(null);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Dipanggil dari script.js/tutorial/script.js setelah memilih 1 chip
  // kategori, supaya lacinya otomatis nutup (UX dropdown yang wajar).
  window.closeFilterDrawers = function () {
    closeAllDrawers(null);
  };
})();
