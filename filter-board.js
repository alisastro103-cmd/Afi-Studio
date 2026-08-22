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

  function init() {
    const boards = document.querySelectorAll('.filter-board');
    if (!boards.length) return;

    document.querySelectorAll('.filter-dropdown-btn[data-drawer-target]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-drawer-target');
        const drawer = document.getElementById(targetId);
        if (!drawer) return;

        const willOpen = !drawer.classList.contains('open');
        closeAllDrawers(willOpen ? drawer : null);
        drawer.classList.toggle('open', willOpen);
        btn.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
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
