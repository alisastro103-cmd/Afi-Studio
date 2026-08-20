// Helper bersama buat nampilin skeleton loading (efek mengkilap) di semua
// halaman yang muat konten Model atau Video — lihat css/skeleton-shimmer.css
// buat animasinya. File ini CUMA nyiapin markup HTML-nya, pemanggilannya
// (kapan ditampilin, kapan diganti konten asli) tetap di masing-masing
// script halaman (Models/script.js, favorit/script.js, dst).

// Baca jumlah kolom yang LAGI AKTIF di sebuah grid (baca computed style
// grid-template-columns), biar jumlah skeleton yang muncul otomatis
// nyesuain ukuran layar / level zoom browser — bukan angka tetap.
function countGridColumns(gridEl, fallback) {
  fallback = fallback || 2;
  if (!gridEl) return fallback;
  try {
    const template = window.getComputedStyle(gridEl).getPropertyValue('grid-template-columns');
    const cols = template.split(' ').filter(Boolean).length;
    return cols || fallback;
  } catch (e) {
    return fallback;
  }
}

// Skeleton kartu Model — bentuknya niru markup asli .model-card
// (lihat renderModels di Models/script.js) supaya ukurannya identik.
function skeletonModelCardsHtml(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <article class="model-card skeleton-card" aria-hidden="true">
        <div class="card-image skeleton-shimmer"></div>
        <div class="card-content">
          <div class="skeleton-shimmer skeleton-line skeleton-line-title"></div>
          <div class="skeleton-shimmer skeleton-line skeleton-line-caption"></div>
        </div>
      </article>`;
  }
  return html;
}

// Skeleton kartu Video — variant 'video' buat baris horizontal di Beranda
// (.video-card dkk), variant 'tutorial' buat grid di halaman Tutorial &
// Favorit (.tutorial-card dkk). Class-nya beda nama tapi bentuk/ukurannya
// sama-sama niru markup asli masing-masing halaman.
function skeletonVideoCardsHtml(count, variant) {
  const cardClass = variant === 'tutorial' ? 'tutorial-card' : 'video-card';
  const wrapClass = variant === 'tutorial' ? 'tutorial-thumb-wrap' : 'video-thumb-wrap';
  const thumbClass = variant === 'tutorial' ? 'tutorial-thumb' : 'video-thumb';
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="${cardClass} skeleton-card" aria-hidden="true">
        <div class="${wrapClass}">
          <div class="${thumbClass} skeleton-shimmer"></div>
        </div>
        <div class="skeleton-shimmer skeleton-line skeleton-line-title"></div>
      </div>`;
  }
  return html;
}
