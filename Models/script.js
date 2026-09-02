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
    // Separator HANYA di akhir (trailing-only), bukan di awal & akhir.
    // Kalau dipasang di awal+akhir, dua salinan (A+B) yang ditaro sebelahan
    // bakal ketemu "akhir A" (sep) langsung disusul "awal B" (sep) di titik
    // sambungan -> muncul dua garis "|  |" numpuk jadi satu (double garis)
    // dan jarak di titik itu jadi 2x lebih lebar dari jarak antar teks lain.
    // Dengan trailing-only, tiap salinan = teks+sep, jadi di titik sambungan
    // (baik A->B maupun B->A saat loop balik) selalu cuma ketemu 1 separator,
    // jaraknya pun konsisten sama kayak jarak antar teks lainnya.
    const html = `${NEWS_TEXTS.join(separator)}${separator}`;

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

// --- Util: salin teks ke clipboard secara aman.
// navigator.clipboard bisa saja tidak ada sama sekali (mis. halaman dibuka
// lewat iframe pihak ketiga tanpa izin "clipboard-write", atau browser lama)
// -- kalau langsung dipanggil tanpa dicek, ini bikin error dan diam-diam
// gagal (popup gak muncul, teks gak kesalin). Makanya selalu dicek dulu, dan
// kalau gagal/tidak ada, jatuhkan ke cara lama (execCommand) sebagai cadangan.
function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    }
    return fallbackCopyText(text);
}

function fallbackCopyText(text) {
    return new Promise((resolve, reject) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.top = '0';
            ta.style.left = '-9999px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            ta.setSelectionRange(0, text.length);
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            if (ok) resolve(); else reject(new Error('execCommand copy gagal'));
        } catch (err) {
            reject(err);
        }
    });
}

// Tampilkan popup kecil di bawah (#toast) dengan teks custom.
// Catatan: teks LANGSUNG dikembalikan ke default begitu toast selesai
// sembunyi total (bukan di saat bareng animasi keluar dimulai) -- sebelumnya
// teks di-reset di setTimeout yang sama dengan yang men-trigger animasi
// keluar, jadi sempat "keliatan" teksnya berubah sekilas pas toast lagi
// meluncur turun. Delay ini disamain sama TOAST_HIDE_TRANSITION_MS di bawah
// (durasi transisi CSS toast) supaya reset teksnya kejadian PAS toast udah
// bener-bener gak keliatan lagi.
const TOAST_VISIBLE_MS = 2000;
const TOAST_HIDE_TRANSITION_MS = 300; // harus sama dengan durasi .toast-slide di CSS
let toastHideTimer = null;
let toastResetTimer = null;

function showToastMessage(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    const label = t.querySelector('span') || t;
    const original = t.dataset.defaultText || (t.dataset.defaultText = label.textContent);

    clearTimeout(toastHideTimer);
    clearTimeout(toastResetTimer);

    label.textContent = msg;
    t.classList.remove('translate-y-20');

    toastHideTimer = setTimeout(() => {
        t.classList.add('translate-y-20');
        toastResetTimer = setTimeout(() => { label.textContent = original; }, TOAST_HIDE_TRANSITION_MS);
    }, TOAST_VISIBLE_MS);
}

function handleCopyLink() {
    if (!currentModel) return;
    copyTextToClipboard(currentModel.link).then(() => {
        showToastMessage('Link disalin ke clipboard');
    }).catch(() => {
        prompt('Gagal menyalin otomatis, salin manual link ini:', currentModel.link);
    });
}

// Salin link publik model (halaman /model/?id=...) yang thumbnail & judulnya bakal
// kebaca otomatis kalau di-share ke WhatsApp/Telegram/Discord (lihat api/model-page.js).
// id-nya pakai model.link (URL download) -- sama seperti modelFavId() di
// favorites.js -- karena data model belum punya field "id" sendiri.
function getModelShareUrl() {
    if (!currentModel || !currentModel.link) return '';
    return `${window.location.origin}/model/?id=${encodeURIComponent(currentModel.link)}`;
}

// Kumpulan template pesan share ke WhatsApp & Telegram -- dipilih random tiap
// kali tombol share dipencet, biar gak keliatan spam/robotic kalau dikirim
// berkali-kali ke chat/grup yang sama. Semua tetap pakai "{name}" (nama
// model) & baris URL terpisah di akhir, sama kayak template aslinya.
const SHARE_MESSAGE_TEMPLATES = [
    (name) => `Halo bang, Rig ${name} bagus cuy, cobain aja bang.`,
    (name) => `Woy, ada Rig ${name} baru nih di Afi Studio, mayan buat koleksi.`,
    (name) => `Gan, cek deh Rig ${name} ini, lumayan rapi hasilnya.`,
    (name) => `Nemu Rig ${name} bagus nih, sikat aja gan sebelum lupa.`,
    (name) => `Bro, Rig ${name} ini worth it buat dicoba, gratis pula.`,
    (name) => `Rig ${name} ini keren sih menurutku, cobain deh bang.`,
    (name) => `Ada rig baru nih namanya ${name}, kualitasnya lumayan bagus.`,
    (name) => `Kalo butuh Rig ${name}, ini link download-nya bang, langsung sikat.`,
];

// Teks pesan doang (tanpa link) -- dipakai Telegram yang punya parameter
// "url" terpisah dari "text".
function buildShareText() {
    if (!currentModel) return '';
    const template = SHARE_MESSAGE_TEMPLATES[Math.floor(Math.random() * SHARE_MESSAGE_TEMPLATES.length)];
    return template(currentModel.name);
}

// Pesan template + link jadi satu baris -- dipakai buat share ke WhatsApp
// & buat disalin ke clipboard, yang gak punya parameter link terpisah.
function buildShareMessage() {
    const text = buildShareText();
    if (!text) return '';
    return `${text}\n${getModelShareUrl()}`;
}

// Tombol "Bagikan" sekarang membuka sheet pilihan (WhatsApp / Telegram / Salin
// Link) alih-alih langsung memanggil Web Share API bawaan browser -- karena
// di beberapa konteks (mis. dibuka di dalam iframe testing tool) API itu
// tidak tersedia/diblokir dan gagal diam-diam tanpa ada tanda apa pun.
function handleShareModel() {
    if (!currentModel || !currentModel.link) return;
    const el = document.getElementById('share-sheet-overlay');
    if (el) el.classList.add('active');
}

function closeShareSheet() {
    const el = document.getElementById('share-sheet-overlay');
    if (el) el.classList.remove('active');
}

function shareToWhatsApp() {
    const msg = buildShareMessage();
    if (!msg) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    closeShareSheet();
}

// Telegram punya URL share resmi (t.me/share/url) yang -- sama kayak wa.me --
// langsung buka layar pilih kontak/grup tujuan begitu link-nya dibuka, jadi
// user gak perlu buka app dulu lalu cari sendiri mau dikirim ke siapa
// (beda dari Discord sebelumnya, yang cuma buka halaman utama app tanpa
// arahan kirim ke mana). "text" diisi pesan template + nama model, "url"
// diisi terpisah supaya Telegram yang nampilin link preview-nya sendiri.
function shareToTelegram() {
    if (!currentModel) return;
    const text = buildShareText();
    const url = getModelShareUrl();
    if (!text || !url) return;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    closeShareSheet();
}

function shareCopyLink() {
    const url = getModelShareUrl();
    if (!url) return;
    copyTextToClipboard(url).then(() => {
        showToastMessage('Link disalin ke clipboard');
    }).catch(() => {
        prompt('Gagal menyalin otomatis, salin manual link ini:', url);
    });
    closeShareSheet();
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
