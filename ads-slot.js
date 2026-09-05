// ads-slot.js
//
// Render iklan/sponsor SATU tempat aja: di dalam <div id="ad-slot"></div>
// yang ditaruh manual di tengah alur halaman (di antara section konten,
// BUKAN posisi fixed/sticky/overlay). Karena bentuknya ikut alur halaman
// biasa (bukan mengambang), dia gak akan PERNAH nutupin navbar, tombol
// PWA install, atau tombol apapun -- itu jaminan dari cara pemasangannya,
// bukan dari logic JS ini.
//
// Config-nya diatur admin lewat menu "Iklan" di admin panel (tersimpan di
// /api/data/ads). Kalau enabled=false atau gambar/link belum diisi, slot-nya
// dikosongin total (elemennya dihapus, gak nyisain kotak kosong).
//
// Cara pakai di halaman manapun:
//   <div id="ad-slot"></div>
//   <script src="/ads-slot.js" defer></script>

(function () {
  function renderAdSlot(cfg) {
    const el = document.getElementById('ad-slot');
    if (!el) return;
    if (!cfg || !cfg.enabled || !cfg.img || !cfg.url) { el.remove(); return; }

    const label = (cfg.label || 'Sponsor').replace(/</g, '&lt;');
    el.innerHTML = `
      <a href="${cfg.url}" target="_blank" rel="noopener sponsored" class="sponsor-slot">
        <span class="sponsor-slot-tag">${label}</span>
        <img src="${cfg.img}" alt="${label}" loading="lazy">
      </a>`;
  }

  fetch('/api/data/ads')
    .then((r) => (r.ok ? r.json() : null))
    .then(renderAdSlot)
    .catch(() => { const el = document.getElementById('ad-slot'); if (el) el.remove(); });
})();
