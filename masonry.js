// masonry.js — Susunan kartu ala Pinterest, dipakai bareng di beberapa halaman
// (Beranda, Video & Tutorial, dst) supaya logikanya cuma ada di SATU tempat.
// Kalau nanti ketemu bug lagi atau mau di-tuning, cukup dibenerin di sini,
// gak perlu diubah satu-satu di tiap halaman.
//
// Cara pakai:
//   const grid = initMasonry('#content-grid', {
//       cardSelector: '.model-card',
//       imageSelector: '.card-image',
//       getColumns: (width) => width < 768 ? 2 : (width < 1024 ? 3 : Math.max(1, Math.floor((width + 14) / (260 + 14)))),
//       getGap: (width) => width < 640 ? 12 : (width < 1024 ? 20 : 14),
//   });
//   // Setiap kali isi grid berubah (render ulang / filter / cari):
//   grid.relayout();
//
// Kenapa ada "relayout otomatis pas font/gambar telat kelar dimuat":
// Tinggi tiap kartu dipakai buat ngitung posisinya. Di koneksi lambat, font
// custom (mis. 'DM Sans') atau gambar bisa kelar dimuat BELAKANGAN, bikin
// tinggi kartu berubah SETELAH posisinya kadung dikunci -- akibatnya kartu
// numpuk/nabrak. Makanya di sini layout-nya otomatis dihitung ulang begitu
// font & tiap gambar beneran kelar, bukan cuma sekali di awal.
function initMasonry(gridSelector, options) {
    const grid = typeof gridSelector === 'string' ? document.querySelector(gridSelector) : gridSelector;
    if (!grid) return { relayout() {} };

    const cardSelector = options.cardSelector;
    const imageSelector = options.imageSelector || null;
    const getColumns = options.getColumns;
    const getGap = options.getGap || (() => 14);

    function relayout() {
        const cards = Array.from(grid.children).filter(el => el.matches(cardSelector));
        if (cards.length === 0) { grid.style.height = ''; return; }

        const w = window.innerWidth;
        const gap = getGap(w);
        const columns = Math.max(1, getColumns(grid.clientWidth || w));
        const colWidth = (grid.clientWidth - (columns - 1) * gap) / columns;
        const colHeights = new Array(columns).fill(0);

        cards.forEach(card => {
            let col = 0;
            for (let i = 1; i < columns; i++) {
                if (colHeights[i] < colHeights[col]) col = i;
            }
            card.style.width = colWidth + 'px';
            card.style.left = col * (colWidth + gap) + 'px';
            card.style.top = colHeights[col] + 'px';
            colHeights[col] += card.getBoundingClientRect().height + gap;
        });

        grid.style.height = (Math.max(...colHeights) - gap) + 'px';

        if (imageSelector) {
            cards.forEach(card => {
                const img = card.querySelector(imageSelector);
                if (img && !img.complete) {
                    img.addEventListener('load', () => requestAnimationFrame(relayout), { once: true });
                }
            });
        }
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => requestAnimationFrame(relayout));
    }
    window.addEventListener('resize', () => requestAnimationFrame(relayout));

    return { relayout };
}
