/**
 * filter-board.js — logika buka/tutup laci (drawer) kategori pada board
 * pencarian + kategori gabungan. Dipakai di Beranda, Models, dan Video &
 * Tutorial lewat <script src="/filter-board.js" defer>.
 *
 * Tiap tombol dropdown ".filter-dropdown-btn" dibungkus bareng laci
 * ".filter-drawer"-nya di dalam satu ".filter-dropdown-wrap" (lihat
 * index.html / Models/index.html), dan ditandai
 * data-drawer-target="ID_LACI" yang menunjuk ke id laci itu. Posisi
 * laci (nempel tepat di bawah tombolnya) sepenuhnya ditangani CSS lewat
 * wrapper itu (position:relative + laci position:absolute di
 * dalamnya) — jadi skrip ini CUMA urusan toggle buka/tutup, tidak ada
 * hitung-hitungan piksel/koordinat sama sekali. Ini sengaja: pendekatan
 * berbasis JS (getBoundingClientRect) sebelumnya rapuh kalau halaman
 * dirender di dalam pembungkus yang men-scale tampilan (mis. mode
 * preview device/zoom), karena bisa bikin arah meleset X di satu
 * kondisi dan Y di kondisi lain. CSS relative/absolute murni tidak
 * punya masalah itu karena browser yang urus konversi koordinatnya.
 *
 * Cuma satu laci yang boleh terbuka dalam satu waktu (kalau ada 2
 * dropdown, misal di halaman Models), dan laci otomatis tertutup kalau
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
