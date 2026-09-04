// Halaman Favorit -- menampilkan video & model yang sudah ditandai bintang
// (lihat /favorites.js untuk penyimpanan localStorage-nya).
let VIDEOS = [];
let MODELS = [];
let currentVideo = null;

// Skeleton loading buat kedua grid favorit — tampil segera saat halaman
// dibuka, diganti konten asli (atau pesan "belum ada") begitu
// loadFavoritesData() kelar di bawah.
(function showInitialFavoriteSkeletons() {
  if (typeof skeletonModelCardsHtml !== 'function' || typeof skeletonVideoCardsHtml !== 'function') return;
  const videoGrid = document.getElementById('video-fav-grid');
  if (videoGrid) videoGrid.innerHTML = skeletonVideoCardsHtml(countGridColumns(videoGrid, 2) * 2, 'tutorial');
  const modelGrid = document.getElementById('model-fav-grid');
  if (modelGrid) modelGrid.innerHTML = skeletonModelCardsHtml(countGridColumns(modelGrid, 2) * 2);
})();

function extractYouTubeId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
}

function emptyStateHtml(text) {
    return `
        <div class="col-span-full fav-empty">
            <i data-lucide="star-off" style="width: 48px; height: 48px; margin-bottom: 12px;"></i>
            <p class="text-sm font-semibold">${text}</p>
        </div>`;
}

// --- Video Favorit ---
function videoCardHtml(v, index) {
    const id = extractYouTubeId(v.url);
    const thumb = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
    return `
        <article class="tutorial-card" onclick="openVideoModal(${index})">
            <div class="tutorial-thumb-wrap">
                <img src="${thumb}" class="tutorial-thumb" loading="lazy" alt="${v.title}">
                <div class="tutorial-play-badge">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
            </div>
            <div class="tutorial-card-title">${v.title}</div>
        </article>`;
}

function renderFavoriteVideos() {
    const grid = document.getElementById('video-fav-grid');
    if (!grid) return;
    const favIds = getFavoriteVideoIds();
    const favVideos = VIDEOS
        .map((v, i) => ({ v, i }))
        .filter(entry => favIds.includes(entry.v.id));

    grid.innerHTML = favVideos.length === 0
        ? emptyStateHtml('Belum ada video yang ditandai favorit')
        : favVideos.map(entry => videoCardHtml(entry.v, entry.i)).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateVideoFavButton() {
    const btn = document.getElementById('video-fav-btn');
    if (!btn || !currentVideo) return;
    const fav = isVideoFavorited(currentVideo.id);
    btn.innerHTML = favStarIconSvg(fav);
    btn.classList.toggle('is-favorited', fav);
    btn.setAttribute('aria-label', fav ? 'Hapus dari favorit' : 'Tandai favorit');
}

function toggleCurrentVideoFavorite() {
    if (!currentVideo) return;
    toggleVideoFavorite(currentVideo.id);
    updateVideoFavButton();
    renderFavoriteVideos(); // langsung hilang dari daftar begitu dihapus dari favorit
}

function openVideoModal(index) {
    const v = VIDEOS[index];
    if (!v) return;
    const id = extractYouTubeId(v.url);
    if (!id) return;

    currentVideo = v;
    document.getElementById('video-modal-title').textContent = v.title;
    document.getElementById('video-youtube-link').href = v.url;
    document.getElementById('video-frame-wrap').innerHTML =
        `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    document.getElementById('video-modal-overlay').classList.add('active');
    updateVideoFavButton();
}

function closeVideoModal() {
    document.getElementById('video-modal-overlay').classList.remove('active');
    document.getElementById('video-frame-wrap').innerHTML = '';
}

// --- Model Favorit ---
// Link publik model (format pendek /m/<id>-<nama-model>). HARUS PERSIS SAMA
// dengan versi di Models/script.js & api/model-page.js supaya link yang
// dibuat di sini bisa ketemu balik di server.
function shortModelId(str) {
    let hash = 0x811c9dc5;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
        hash ^= s.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36).padStart(4, '0').slice(-4);
}

function slugifyModelName(name) {
    const cleaned = String(name || '')
        .toLowerCase()
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20)
        .replace(/-+$/g, '');
    return cleaned || 'model';
}

function modelShareUrl(m) {
    return `/m/${shortModelId(m.link)}-${slugifyModelName(m.name)}`;
}

// Kartu model favorit sekarang nge-link LANGSUNG ke halaman detail model
// (/m/<id>-<nama>), persis kayak di Beranda & Semua Model -- bukan buka
// modal popup lagi (sistem modal lama udah dihapus, sama modal-model-nya
// di index.html + fungsi openModal/closeModal/handleDownload/handleCopyLink
// yang dulu nemplok di sini).
function modelCardHtml(model, index) {
    return `
        <article class="model-card" onclick="window.location.href='${modelShareUrl(model)}'">
            <img src="${model.thumb}" class="card-image" loading="lazy" alt="${(model.name || "Thumbnail model").replace(/"/g, "&quot;")}">
            <div class="card-content">
                <div class="card-title">${model.name}</div>
                <div class="card-caption">${model.caption}</div>
            </div>
        </article>`;
}

function renderFavoriteModels() {
    const grid = document.getElementById('model-fav-grid');
    if (!grid) return;
    const favIds = getFavoriteModelIds();
    const favModels = MODELS
        .map((m, i) => ({ m, i }))
        .filter(entry => favIds.includes(modelFavId(entry.m)));

    grid.innerHTML = favModels.length === 0
        ? emptyStateHtml('Belum ada model yang ditandai favorit')
        : favModels.map(entry => modelCardHtml(entry.m, entry.i)).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- Inisialisasi ---
async function loadFavoritesData() {
    try {
        const [videosRes, modelsRes] = await Promise.all([
            fetch('/api/data/videos'),
            fetch('/api/data/models')
        ]);
        VIDEOS = await videosRes.json();
        MODELS = await modelsRes.json();
    } catch (err) {
        console.error('Gagal memuat data favorit:', err);
        VIDEOS = [];
        MODELS = [];
    }
    renderFavoriteVideos();
    renderFavoriteModels();
}
loadFavoritesData();
