/**
 * lucide-local.js — pengganti lokal untuk CDN Lucide
 * (sebelumnya: https://cdn.jsdelivr.net/npm/lucide@0.263.0/dist/umd/lucide.min.js)
 *
 * Cuma berisi ikon yang benar-benar dipakai di situs ini (dicek lewat
 * grep data-lucide= di semua file HTML/JS), bukan seluruh library Lucide
 * (yang isinya ratusan ikon) — jadi jauh lebih ringan.
 *
 * API-nya dibuat SAMA seperti Lucide asli: window.lucide.createIcons()
 * mencari semua elemen [data-lucide], lalu menggantinya dengan <svg> —
 * jadi TIDAK PERLU mengubah HTML atau script.js yang sudah ada sama sekali.
 *
 * Catatan: file ini di-load di SEMUA halaman (lewat <script src="/icons/lucide-local.js">),
 * jadi ini satu-satunya tempat yang perlu diedit untuk menambah ikon baru,
 * termasuk ikon di menu tab (dropdown "☰") — lihat decorateMenuIcons() di bawah,
 * yang otomatis jalan di semua halaman tanpa perlu ubah HTML satu-satu.
 */
(function () {
  // path data ikon (viewBox 24x24, gaya sama seperti Lucide: stroke 2px, line-cap/join round)
  const ICONS = {
    'x': '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
    'plus': '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    'search': '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"></polyline>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
    'settings': '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    'frown': '<circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
    'arrow-up-right': '<line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>',
    'arrow-right-circle': '<circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line><polyline points="12 8 16 12 12 16"></polyline>',
    'eye': '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path><circle cx="12" cy="12" r="3"></circle>',

    // --- Ditambahkan untuk ikon di menu tab (dropdown "☰") ---
    'home': '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z"></path>',
    'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    'trophy': '<path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"></path><path d="M17 5h3a2 2 0 0 1-2 4h-1"></path><path d="M7 5H4a2 2 0 0 0 2 4h1"></path>',
    'video': '<path d="m22 8-6 4 6 4V8Z"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect>',
    'help-circle': '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 2-3 4"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    'star': '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2Z"></path>',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line>',
    'heart': '<path d="M12 21s-6.72-4.35-9.5-8.5C.86 9.6 1.6 5.6 5 4.1c2.4-1.06 4.7-.1 7 2.2 2.3-2.3 4.6-3.26 7-2.2 3.4 1.5 4.14 5.5 2.5 8.4C18.72 16.65 12 21 12 21Z"></path>'
  };

  function buildSvg(name, sourceEl) {
    const inner = ICONS[name];
    if (!inner) return null; // ikon tidak dikenal, biarkan elemen asli apa adanya

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = inner;

    // Salin class & style dari elemen <i data-lucide="..."> asli, sama seperti Lucide asli,
    // supaya semua styling yang sudah ada (width, opacity, warna, dsb.) tidak berubah.
    if (sourceEl) {
      const existingClass = sourceEl.getAttribute('class') || '';
      svg.setAttribute('class', ('lucide lucide-' + name + ' ' + existingClass).trim());
      const styleAttr = sourceEl.getAttribute('style');
      if (styleAttr) svg.setAttribute('style', styleAttr);
      // salin atribut lain (selain data-lucide) yang mungkin dipasang manual di HTML
      for (const attr of Array.from(sourceEl.attributes)) {
        if (attr.name === 'data-lucide' || attr.name === 'class' || attr.name === 'style') continue;
        svg.setAttribute(attr.name, attr.value);
      }
    }
    return svg;
  }

  function createIcons() {
    document.querySelectorAll('[data-lucide]').forEach((el) => {
      const name = el.getAttribute('data-lucide');
      const svg = buildSvg(name, el);
      if (svg) el.replaceWith(svg);
    });
    decorateMenuIcons();
  }

  // Cocokkan tiap link di menu tab (dropdown "☰", class .page-menu-item / .page-menu-item-cta)
  // dengan ikonnya lewat teksnya. Dipasang di sini (satu file, dipakai di semua halaman)
  // supaya tidak perlu edit markup menu di 9 file HTML satu-satu.
  const MENU_ICON_MAP = [
    { match: 'Beranda', icon: 'home' },
    { match: 'Member Afi-Studio', icon: 'users' },
    { match: 'Event Render', icon: 'calendar' },
    { match: 'Ranking Render', icon: 'trophy' },
    { match: 'Video & Tutorial', icon: 'video' },
    { match: 'Bantuan', icon: 'help-circle' },
    { match: 'Feedback', icon: 'message-square' },
    { match: 'Favorit', icon: 'star' },
    { match: 'Daftar Model 3D', icon: 'user-plus' },
    { match: 'Daftar Member', icon: 'user-plus' }
  ];

  function decorateMenuIcons() {
    document.querySelectorAll('.page-menu-item, .page-menu-item-cta').forEach((link) => {
      if (link.getAttribute('data-icon-done') === '1') return; // sudah dihias, jangan diulang

      const label = link.textContent.trim();
      const entry = MENU_ICON_MAP.find((m) => label === m.match);
      if (!entry) return;

      const svg = buildSvg(entry.icon, null);
      if (!svg) return;
      svg.setAttribute('class', 'page-menu-icon');
      svg.style.width = '16px';
      svg.style.height = '16px';
      svg.style.flexShrink = '0';

      // Bungkus teks yang sudah ada supaya ikon + teks bisa disusun rapi jadi satu baris,
      // tanpa mengubah link/href/onclick yang sudah ada di HTML.
      const labelSpan = document.createElement('span');
      labelSpan.className = 'page-menu-label';
      labelSpan.textContent = link.textContent;
      link.textContent = '';
      link.appendChild(svg);
      link.appendChild(labelSpan);

      link.style.display = 'flex';
      link.style.alignItems = 'center';
      link.style.gap = '10px';
      if (link.classList.contains('page-menu-item-cta')) {
        // item CTA aslinya justify-content: space-between (teks kiri, biar ada jarak ke kanan)
        labelSpan.style.flex = '1';
      }
      link.setAttribute('data-icon-done', '1');
    });
  }

  window.lucide = { createIcons };
})();
