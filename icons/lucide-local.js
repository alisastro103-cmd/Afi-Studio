/**
 * lucide-local.js — pengganti lokal untuk CDN Lucide
 * (sebelumnya: https://cdn.jsdelivr.net/npm/lucide@0.263.0/dist/umd/lucide.min.js)
 *
 * Cuma berisi 9 ikon yang benar-benar dipakai di situs ini (dicek lewat
 * grep data-lucide= di semua file HTML/JS), bukan seluruh library Lucide
 * (yang isinya ratusan ikon) — jadi jauh lebih ringan.
 *
 * API-nya dibuat SAMA seperti Lucide asli: window.lucide.createIcons()
 * mencari semua elemen [data-lucide], lalu menggantinya dengan <svg> —
 * jadi TIDAK PERLU mengubah HTML atau script.js yang sudah ada sama sekali.
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
    'help-circle': '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
    'arrow-up-right': '<line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline>'
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
  }

  window.lucide = { createIcons };
})();
