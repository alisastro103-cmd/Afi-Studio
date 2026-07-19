const NEWS_TEXTS = [
    "Pamerkan Rendermu di \"Render Event\"",
    "Render Event tidak ada hadiah atau , hanya untuk hiburan",
    "Gabung digrup WhatsApp!!",
    "Join \"Saluran WhatsApp\" kami!!",
    "Lihat karya-karya di channel WhatsApp dan YouTube kami",
    "Daftarkan model, rig, dan map kamu disini"
];

const bannerData = [
    { img: "Banner1.webp", url: "#" },
    { img: "Banner2.webp", url: "https://chat.whatsapp.com/LSC5Ij7KzT01VEfPS9Spm2?mode=ems_copy_c" },
    { img: "Banner3.webp", url: "event/index.html" },
    { img: "Banner4.webp", url: "https://youtu.be/zdfKQt_enjc?si=MOWKnFsvVmYuDkUS" }
];

// Data model sekarang dimuat dari Models/models.json (lihat loadModels di bawah)
let MODELS = [];

let currentModel = null;

let CATEGORIES = ["Semua"];
let activeCategory = "Semua";

// Hitung ulang daftar kategori berdasarkan data yang beneran ada di
// models.json. Jadi nambah/hapus kategori baru CUKUP lewat edit JSON —
// tab filter otomatis ikut nambah/ilang, nggak perlu edit kode ini lagi.
function recomputeFilters() {
    const catSet = new Set();
    MODELS.forEach(m => {
        (m.category || []).forEach(c => c && catSet.add(c));
    });
    CATEGORIES = ["Semua", ...Array.from(catSet).sort((a, b) => a.localeCompare(b))];
}

// Merender tombol filter kategori
function renderCategoryButtons() {
    const container = document.getElementById('category-filter');
    if (!container) return;
    container.innerHTML = CATEGORIES.map(cat => `
        <button class="filter-btn ${activeCategory === cat ? 'active' : ''}" 
                onclick="filterByCategory('${cat}')">
            ${cat}
        </button>
    `).join('');
}

// Fungsi filter berdasarkan kategori
function filterByCategory(cat) {
    activeCategory = cat;
    const titleElement = document.getElementById('category-title');
    if (titleElement) {
        titleElement.textContent = cat.toLowerCase() === "semua" ? "SEMUA ITEM" : cat.toUpperCase();
    }
    renderCategoryButtons();
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? searchInput.value : '';
    renderModels(searchTerm);
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

        const textMatch = m.name.toLowerCase().includes(s) ||
            categoriesArray.join(' ').toLowerCase().includes(s) ||
            (m.converter && m.converter.toLowerCase().includes(s)) ||
            (m.creator && m.creator.toLowerCase().includes(s));

        return categoryMatch && textMatch;
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
                <img src="${model.thumb}" class="card-image" loading="lazy">
                ${model.app_target ? `<span class="app-badge">${model.app_target}</span>` : ''}
                <div class="card-content">
                    <div class="card-title">${model.name}</div>
                    <div class="card-caption">${model.caption}</div>
                </div>
            </article>
        `).join('');
    }
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
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('active');
}

// Fungsi Download & Copy Link
function handleDownload() {
    if (currentModel) window.open(currentModel.link, '_blank');
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

// Event Listeners
const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => renderModels(e.target.value));
}

// Inisialisasi: ambil data model dari JSON, baru render
async function loadModels() {
    try {
        const res = await fetch('/Models/models.json');
        MODELS = await res.json();
    } catch (err) {
        console.error('Gagal memuat Models/models.json:', err);
        MODELS = [];
    }
    recomputeFilters();
    renderCategoryButtons();
    renderModels();
    renderMarquee();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    // Beri tahu script lain (misal index.html) bahwa MODELS sudah siap
    document.dispatchEvent(new CustomEvent('modelsLoaded'));
}
loadModels();

// Animasi transisi halus untuk board konten (#content-grid).
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
