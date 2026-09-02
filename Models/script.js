// Teks marquee/text-scroll sekarang dimuat dari marquee.json (lihat loadMarquee di bawah)
let NEWS_TEXTS = [];

// Data banner slider root sekarang dimuat dari banner.json (lihat loadBanner di bawah)
let bannerData = [];

// Data model sekarang dimuat dari Models/models.json (lihat loadModels di bawah)
let MODELS = [];

// Tampilkan skeleton loading (efek mengkilap) SEGERA begitu script ini
// jalan — sebelum fetch data model selesai — biar user gak lihat area
// kosong pas nunggu. Jumlahnya otomatis nyesuain jumlah kolom grid yang
// lagi aktif (2 di HP, 3-4 di tablet/desktop, ngikutin lebar layar/zoom
// browser saat itu). Diganti konten asli begitu loadModels() kelar
// (lihat renderModels & renderCategoryButtons di bawah).
(function showInitialModelSkeleton() {
  const grid = document.getElementById('content-grid');
  if (!grid || typeof skeletonModelCardsHtml !== 'function') return;
  const cols = countGridColumns(grid, 2);
  grid.innerHTML = skeletonModelCardsHtml(cols * 2);
})();

let currentModel = null;

let CATEGORIES = ["Semua"];
let activeCategory = "Semua";

// Kategori custom yang dibikin lewat Panel Admin (Models > Kategori Model),
// dimuat dari categories.json lewat loadCategories(). Ini bikin kategori bisa
// "ada duluan" walau belum dipasang ke model manapun.
let CATEGORY_MASTER = [];

// Kategori khusus "Target Aplikasi" (Prisma3D, Mine-Imator, Blender, Viontri,
// C4D, Lainnya) — ini BARIS TERPISAH dari kategori model biasa di atas, dan
// datanya diatur sendiri lewat Panel Admin > Kategori Aplikasi (tersimpan di
// Redis/appcategories.json lewat loadAppCategories()), BUKAN daftar tetap di kode.
let APP_CATEGORIES = ["Semua"];
let activeAppCategory = "Semua";
let APP_CATEGORY_MASTER = [];

// Ambil daftar kategori master (custom) dari categories.json lewat API,
// supaya kategori yang diatur admin lewat Panel Admin ikut tampil di sini
// walau belum dipasang ke model manapun.
async function loadCategories() {
    try {
        const res = await fetch('/api/data/categories');
        const data = await res.json();
        CATEGORY_MASTER = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('Gagal memuat categories.json:', err);
        CATEGORY_MASTER = [];
    }
}

// Ambil daftar kategori Target Aplikasi dari Panel Admin (Kategori Aplikasi),
// disimpan terpisah dari kategori model biasa lewat /api/data/appcategories.
async function loadAppCategories() {
    try {
        const res = await fetch('/api/data/appcategories');
        const data = await res.json();
        APP_CATEGORY_MASTER = Array.isArray(data) ? data : [];
    } catch (err) {
        console.error('Gagal memuat app-categories.json:', err);
        APP_CATEGORY_MASTER = [];
    }
}

// Hitung ulang daftar kategori model biasa — murni dari kategori master yang
// diatur admin lewat Panel Admin > Kategori Model (diurutkan A-Z).
function recomputeFilters() {
    CATEGORIES = [
        "Semua",
        ...CATEGORY_MASTER.slice().sort((a, b) => a.localeCompare(b)),
    ];
}

// Hitung ulang daftar kategori Target Aplikasi — murni dari urutan yang
// diatur admin lewat Panel Admin > Kategori Aplikasi (urutan dipertahankan
// APA ADANYA, tidak diurutkan ulang).
function recomputeAppFilters() {
    APP_CATEGORIES = ["Semua", ...APP_CATEGORY_MASTER];
}

// Merender tombol filter kategori (tampil di dalam laci/drawer board pencarian)
function renderCategoryButtons() {
    const container = document.getElementById('category-filter');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(cat => `
        <button class="filter-chip-btn ${activeCategory === cat ? 'active' : ''}" 
                onclick="filterByCategory('${cat}')">
            ${cat}
        </button>
    `).join('');
    updateCategoryDropdownLabel();
}

// Merender tombol filter kategori Target Aplikasi (laci terpisah)
function renderAppCategoryButtons() {
    const container = document.getElementById('app-category-filter');
    if (!container) return;
    container.innerHTML = APP_CATEGORIES.map(cat => `
        <button class="filter-chip-btn ${activeAppCategory === cat ? 'active' : ''}" 
                onclick="filterByAppCategory('${cat}')">
            ${cat}
        </button>
    `).join('');
    updateAppCategoryDropdownLabel();
}

// Label tombol dropdown "Kategori" mengikuti kategori yang lagi aktif,
// dan dikasih warna aksen (class has-active) kalau bukan "Semua".
function updateCategoryDropdownLabel() {
    const label = document.getElementById('category-dropdown-label');
    const btn = label ? label.closest('.filter-dropdown-btn') : null;
    if (!label) return;
    label.textContent = activeCategory === 'Semua' ? 'Tipe' : activeCategory;
    if (btn) btn.classList.toggle('has-active', activeCategory !== 'Semua');
}

// Sama seperti di atas, tapi buat dropdown "Aplikasi" (Target Aplikasi)
function updateAppCategoryDropdownLabel() {
    const label = document.getElementById('app-category-dropdown-label');
    const btn = label ? label.closest('.filter-dropdown-btn') : null;
    if (!label) return;
    label.textContent = activeAppCategory === 'Semua' ? 'Aplikasi' : activeAppCategory;
    if (btn) btn.classList.toggle('has-active', activeAppCategory !== 'Semua');
}

// Fungsi filter berdasarkan kategori
function filterByCategory(cat) {
    activeCategory = cat;
    const titleElement = document.getElementById('category-title');
    if (titleElement) {
        titleElement.textContent = cat.toLowerCase() === "semua" ? "Semua Item" : cat;
    }
    renderCategoryButtons();
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value : '';
    renderModels(searchTerm);
    if (typeof window.closeFilterDrawers === 'function') window.closeFilterDrawers();
}

// Fungsi filter berdasarkan kategori Target Aplikasi (independen dari kategori model biasa)
function filterByAppCategory(cat) {
    activeAppCategory = cat;
    renderAppCategoryButtons();
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value : '';
    renderModels(searchTerm);
    if (typeof window.closeFilterDrawers === 'function') window.closeFilterDrawers();
}

// Ambil data teks marquee dari marquee.json, baru render begitu siap
async function loadMarquee() {
    try {
        const res = await fetch('/api/data/marquee');
        NEWS_TEXTS = await res.json();
    } catch (err) {
        console.error('Gagal memuat marquee.json:', err);
        NEWS_TEXTS = [];
    }
    renderMarquee();
}

// Ambil data banner slider dari banner.json, lalu beri tahu index.html
// lewat event 'bannerLoaded' supaya slider bisa dibangun begitu data siap
// (index.html yang bertanggung jawab membangun DOM slider-nya sendiri).
async function loadBanner() {
    try {
        const res = await fetch('/api/data/banner');
        bannerData = await res.json();
    } catch (err) {
        console.error('Gagal memuat banner.json:', err);
        bannerData = [];
    }
    document.dispatchEvent(new CustomEvent('bannerLoaded'));
}

// Merender teks berjalan (marquee)
// Menggunakan animasi CSS (translateX) dengan dua salinan teks berdampingan
// agar loop berjalan mulus tanpa jeda, dan durasi dihitung ulang secara
// dinamis dari lebar konten sebenarnya (px) sehingga kecepatan tetap
// konsisten berapapun panjang teks dan berapapun level zoom browser.
function renderMarquee() {
    const bar = document.getElementById('marquee-bar');
    const track = document.getElementById('news-marquee');
    const contentA = document.getElementById('marquee-content-a');
    const contentB = document.getElementById('marquee-content-b');
    if (!bar || !track || !contentA || !contentB) return;

    // Jarak margin horizontal antar teks dirapatkan dari 45px ke 20px
    const separator = `<span style="color: var(--accent); margin: 0 20px; font-weight: bold; opacity: 0.8;">|</span>`;
    const joinedContent = NEWS_TEXTS.join(separator);
    const html = `${separator}${joinedContent}${separator}`;

    // Kedua salinan diisi konten yang sama persis agar saat animasi
    // mencapai -50% (akhir salinan pertama), salinan kedua sudah pas
    // di posisi awal, sehingga terlihat menyambung tanpa terputus.
    contentA.innerHTML = html;
    contentB.innerHTML = html;

    // Konstanta kecepatan dalam pixel per detik. Semakin besar nilainya,
    // semakin cepat teks berjalan, tapi tetap konsisten untuk semua panjang teks.
    const PIXELS_PER_SECOND = 60;
    const MIN_DURATION = 8; // detik, batas bawah agar teks pendek tidak melesat

    const applySpeed = () => {
        // Lebar salah satu salinan (bukan total track) karena translateX(-50%)
        // bergerak sejauh setengah lebar track = lebar satu salinan konten.
        const contentWidth = contentA.getBoundingClientRect().width;
        if (contentWidth > 0) {
            const duration = Math.max(contentWidth / PIXELS_PER_SECOND, MIN_DURATION);
            track.style.animationDuration = `${duration}s`;
        }
    };

    // requestAnimationFrame memastikan pengukuran lebar dilakukan setelah
    // browser selesai layout, termasuk saat teks/zoom berubah.
    requestAnimationFrame(applySpeed);

    // Hitung ulang saat ukuran viewport/zoom berubah supaya kecepatan tetap wajar.
    if (!bar.dataset.marqueeResizeBound) {
        window.addEventListener('resize', () => requestAnimationFrame(applySpeed));
        bar.dataset.marqueeResizeBound = 'true';
    }

    // Pengganti onmouseover="this.stop()" / onmouseout="this.start()" pada tag <marquee> lama.
    if (!bar.dataset.marqueeHoverBound) {
        bar.addEventListener('mouseenter', () => track.classList.add('marquee-paused'));
        bar.addEventListener('mouseleave', () => track.classList.remove('marquee-paused'));
        bar.dataset.marqueeHoverBound = 'true';
    }
}

// Merender kartu model ke grid utama
function renderModels(filter = '') {
    const grid = document.getElementById('content-grid');
    if (!grid) return;

    const filtered = MODELS.filter(m => {
        const s = filter.toLowerCase();
        const categoriesArray = Array.isArray(m.category) ? m.category : [m.category];

        const categoryMatch = activeCategory === "Semua" ||
            categoriesArray.some(c => c.toLowerCase() === activeCategory.toLowerCase());

        const appCategoryMatch = activeAppCategory === "Semua" ||
            (m.app_target && m.app_target.toLowerCase() === activeAppCategory.toLowerCase());

        const textMatch = m.name.toLowerCase().includes(s) ||
            categoriesArray.join(' ').toLowerCase().includes(s) ||
            (m.converter && m.converter.toLowerCase().includes(s)) ||
            (m.creator && m.creator.toLowerCase().includes(s));

        return categoryMatch && appCategoryMatch && textMatch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 text-center opacity-60">
                <i data-lucide="frown" style="width: 64px; height: 64px; margin-bottom: 16px;"></i>
                <p class="text-sm font-semibold">Coba cari yang lain dan coba lagi</p>
            </div>`;
    } else {
        grid.innerHTML = filtered.map(model => `
            <article class="model-card" onclick="openModal(${MODELS.indexOf(model)})">
                <img src="${model.thumb}" class="card-image" loading="lazy" alt="${(model.name || "Thumbnail model").replace(/"/g, "&quot;")}">
                <div class="card-content">
                    <div class="card-title">${model.name}</div>
                    <div class="card-caption">${model.caption}</div>
                </div>
            </article>
        `).join('');
    }
    // Konten asli sudah terpasang -> lepas reservasi tinggi anti-CLS
    // (lihat #content-grid.grid-loading di CSS), supaya board tidak lagi
    // menyisakan ruang kosong panjang di bawah kartu kalau kartunya sedikit.
    grid.classList.remove('grid-loading');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Fungsi Modal
function openModal(index) {
    currentModel = MODELS[index];
    const infoBox = document.getElementById('info-container');
    const modalThumb = document.getElementById('modal-thumb');

    if (modalThumb) modalThumb.src = currentModel.thumb;
    document.getElementById('modal-title').textContent = currentModel.name;
    document.getElementById('modal-caption').textContent = currentModel.caption;

    let infoHtml = '';
    if (currentModel.creator) infoHtml += `<div class="flex justify-between"><span>Creator:</span><b>${currentModel.creator}</b></div>`;
    if (currentModel.converter) infoHtml += `<div class="flex justify-between"><span>Converter:</span><b>${currentModel.converter}</b></div>`;
    if (currentModel.app_target) infoHtml += `<div class="flex justify-between"><span>Untuk Aplikasi:</span><b>${currentModel.app_target}</b></div>`;
    if (currentModel.category) {
        const catText = Array.isArray(currentModel.category) ? currentModel.category.join(', ') : currentModel.category;
        infoHtml += `<div class="flex justify-between"><span>Category:</span><b>${catText}</b></div>`;
    }
    if (infoBox) infoBox.innerHTML = infoHtml;
    document.getElementById('modal-overlay').classList.add('active');
    updateModelFavButton();
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('active');
}

// Update tampilan tombol bintang favorit sesuai status model yang lagi dibuka
function updateModelFavButton() {
    const btn = document.getElementById('model-fav-btn');
    if (!btn || !currentModel || typeof isModelFavorited !== 'function') return;
    const id = modelFavId(currentModel);
    const fav = isModelFavorited(id);
    btn.innerHTML = favStarIconSvg(fav);
    btn.classList.toggle('is-favorited', fav);
    btn.setAttribute('aria-label', fav ? 'Hapus dari favorit' : 'Tandai favorit');
}

function toggleCurrentModelFavorite() {
    if (!currentModel || typeof toggleModelFavorite !== 'function') return;
    toggleModelFavorite(modelFavId(currentModel));
    updateModelFavButton();
}

// Fungsi Download & Copy Link
function handleDownload() {
    if (!currentModel) return;
    // Tampilkan layar "Terima kasih" dulu (lihat favorites.js), baru redirect
    // ke link download setelah sempat terlihat sebentar.
    if (typeof showThankYouOverlay === 'function') showThankYouOverlay();
    setTimeout(function () {
        window.location.href = currentModel.link;
    }, 1700);
}

function handleCopyLink() {
    if (!currentModel) return;
    navigator.clipboard.writeText(currentModel.link).then(() => {
        const t = document.getElementById('toast');
        if (t) {
            t.classList.remove('translate-y-20');
            setTimeout(() => t.classList.add('translate-y-20'), 2000);
        }
    });
}

// Salin link publik model (halaman /model/?id=...) yang thumbnail & judulnya bakal
// kebaca otomatis kalau di-share ke WhatsApp/Discord (lihat api/model-page.js).
// id-nya pakai model.link (URL download) -- sama seperti modelFavId() di
// favorites.js -- karena data model belum punya field "id" sendiri.
function handleShareModel() {
    if (!currentModel || !currentModel.link) return;
    const shareUrl = `${window.location.origin}/model/?id=${encodeURIComponent(currentModel.link)}`;
    const showToast = () => {
        const t = document.getElementById('toast');
        if (t) {
            const label = t.querySelector('span') || t;
            const original = label.textContent;
            label.textContent = 'Link share disalin ke clipboard';
            t.classList.remove('translate-y-20');
            setTimeout(() => { t.classList.add('translate-y-20'); label.textContent = original; }, 2000);
        }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(showToast).catch(() => prompt('Salin link ini:', shareUrl));
    } else {
        prompt('Salin link ini:', shareUrl);
    }
}

// Event Listeners
const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => renderModels(e.target.value));
}

// Inisialisasi: ambil data model dari JSON, baru render
async function loadModels() {
    try {
        const res = await fetch('/api/data/models');
        MODELS = await res.json();
    } catch (err) {
        console.error('Gagal memuat Models/models.json:', err);
        MODELS = [];
    }
    recomputeFilters();
    recomputeAppFilters();
    renderCategoryButtons();
    renderAppCategoryButtons();
    renderModels();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Beri tahu script lain (misal index.html) bahwa MODELS sudah siap
    document.dispatchEvent(new CustomEvent('modelsLoaded'));
}
// Kategori master (categories.json) & kategori Target Aplikasi (appcategories.json)
// perlu selesai dimuat dulu sebelum loadModels() menghitung daftar filter, supaya
// kategori custom dari admin ikut muncul sejak render pertama (bukan menunggu render kedua).
(async function initModelsAndCategories() {
    await Promise.all([loadCategories(), loadAppCategories()]);
    await loadModels();
})();
loadMarquee();
loadBanner();

// === Animasi transisi halus untuk board konten (#content-grid) ===
// Kartu muncul dengan efek slide-up + fade-in secara bertahap (staggered)
// setiap kali grid diisi ulang. Dipasang via MutationObserver supaya
// otomatis berlaku untuk index.html (root) maupun Models/index.html,
// termasuk saat root meng-override renderModels untuk 6 model acak —
// tanpa perlu mengubah logic render yang sudah ada sama sekali.
// Pakai transform + opacity murni, jadi tidak mengubah posisi/layout kartu.
(function initCardRevealAnimation() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes cardRevealUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #content-grid .model-card {
            animation: cardRevealUp 0.45s ease-out both;
        }
    `;
    document.head.appendChild(style);

    const grid = document.getElementById('content-grid');
    if (!grid) return;

    const applyStagger = () => {
        const cards = grid.querySelectorAll('.model-card');
        cards.forEach((card, i) => {
            card.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
        });
    };

    // Terapkan untuk render pertama kali
    applyStagger();

    // Pantau setiap kali isi grid berubah (render ulang, filter, pencarian,
    // ganti kategori, dsb) supaya animasi tetap konsisten muncul.
    const observer = new MutationObserver(applyStagger);
    observer.observe(grid, { childList: true });
})();
