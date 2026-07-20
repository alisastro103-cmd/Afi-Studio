// Halaman Favorit -- menampilkan video & model yang sudah ditandai bintang
// (lihat /favorites.js untuk penyimpanan localStorage-nya).
let VIDEOS = [];
let MODELS = [];
let currentVideo = null;
let currentModel = null;

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
        `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    document.getElementById('video-modal-overlay').classList.add('active');
    updateVideoFavButton();
}

function closeVideoModal() {
    document.getElementById('video-modal-overlay').classList.remove('active');
    document.getElementById('video-frame-wrap').innerHTML = '';
}

// --- Model Favorit ---
function modelCardHtml(model, index) {
    return `
        <article class="model-card" onclick="openModal(${index})">
            <img src="${model.thumb}" class="card-image" loading="lazy">
            ${model.app_target ? `<span class="app-badge">${model.app_target}</span>` : ''}
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

function updateModelFavButton() {
    const btn = document.getElementById('model-fav-btn');
    if (!btn || !currentModel) return;
    const fav = isModelFavorited(modelFavId(currentModel));
    btn.innerHTML = favStarIconSvg(fav);
    btn.classList.toggle('is-favorited', fav);
    btn.setAttribute('aria-label', fav ? 'Hapus dari favorit' : 'Tandai favorit');
}

function toggleCurrentModelFavorite() {
    if (!currentModel) return;
    toggleModelFavorite(modelFavId(currentModel));
    updateModelFavButton();
    renderFavoriteModels(); // langsung hilang dari daftar begitu dihapus dari favorit
}

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

// --- Inisialisasi ---
async function loadFavoritesData() {
    try {
        const [videosRes, modelsRes] = await Promise.all([
            fetch('/videos.json'),
            fetch('/Models/models.json')
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
