// Data video dimuat dari videos.json (lihat loadVideos di bawah)
let VIDEOS = [];

// --- Badge "Baru" ---
// Video dianggap "Baru" kalau field `added` di videos.json masih dalam
// rentang NEW_BADGE_DAYS hari terakhir dari hari ini. Ganti angka ini
// kalau mau badge "Baru" bertahan lebih lama/lebih singkat.
const NEW_BADGE_DAYS = 14;

function isNewVideo(v) {
    if (!v || !v.added) return false;
    const added = new Date(`${v.added}T00:00:00`);
    if (isNaN(added.getTime())) return false;
    const diffDays = (Date.now() - added.getTime()) / 86400000;
    // Toleransi -1 hari buat jaga-jaga selisih zona waktu kalau `added` diisi "hari ini"
    return diffDays <= NEW_BADGE_DAYS && diffDays >= -1;
}

// --- View counter "Populer" (localStorage, tanpa backend) ---
// Disimpan sebagai objek { [video.id]: jumlahDitonton } di localStorage
// browser masing-masing pengunjung (jadi ini hitungan lokal per-device,
// bukan hitungan global semua pengunjung situs).
const VIEW_STORAGE_KEY = 'afi-video-views';

function getViewCounts() {
    try {
        const raw = localStorage.getItem(VIEW_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (err) {
        return {};
    }
}

function getViewCount(id) {
    if (!id) return 0;
    const counts = getViewCounts();
    return counts[id] || 0;
}

function incrementView(id) {
    if (!id) return;
    try {
        const counts = getViewCounts();
        counts[id] = (counts[id] || 0) + 1;
        localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(counts));
    } catch (err) {
        // localStorage penuh/diblokir browser -> diem aja, fitur ini opsional
    }
}

function formatViews(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}rb`;
    return `${n}`;
}

// --- Riwayat nonton ("Baru saja dinonton") ---
// Disimpan sebagai daftar { id, ts } di localStorage, urut dari yang terbaru.
// Maksimal HISTORY_MAX video, dan otomatis terhapus kalau sudah lewat
// HISTORY_EXPIRE_DAYS hari -- KECUALI video itu sudah ditandai favorit.
const HISTORY_KEY = 'afi-watch-history';
const HISTORY_MAX = 9;
const HISTORY_EXPIRE_DAYS = 7;
const HISTORY_EXPIRE_MS = HISTORY_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

function getHistoryList() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

function saveHistoryList(list) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (err) {
        // localStorage penuh/diblokir -> diem aja, fitur ini opsional
    }
}

// Buang entri riwayat yang sudah lewat 1 minggu, kecuali videonya sudah difavoritkan
function cleanupHistory() {
    const list = getHistoryList();
    const now = Date.now();
    const kept = list.filter(entry => {
        const fav = typeof isVideoFavorited === 'function' && isVideoFavorited(entry.id);
        if (fav) return true;
        return (now - entry.ts) <= HISTORY_EXPIRE_MS;
    });
    if (kept.length !== list.length) saveHistoryList(kept);
    return kept;
}

// Catat video yang baru saja ditonton ke riwayat (dibatasi HISTORY_MAX video)
function addToHistory(id) {
    if (!id) return;
    let list = cleanupHistory().filter(entry => entry.id !== id);
    list.unshift({ id, ts: Date.now() });
    if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
    saveHistoryList(list);
}

function extractYouTubeId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
}

function videoCardHtml(v, index) {
    const id = extractYouTubeId(v.url);
    const thumb = id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
    const views = getViewCount(v.id);
    return `
        <article class="tutorial-card" onclick="openVideoModal(${index})">
            <div class="tutorial-thumb-wrap">
                <img src="${thumb}" class="tutorial-thumb" loading="lazy" alt="${v.title}">
                <div class="tutorial-play-badge">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
                ${isNewVideo(v) ? `<span class="new-badge">Baru</span>` : ''}
            </div>
            <div class="tutorial-card-title">${v.title}</div>
            ${views > 0 ? `<div class="view-badge"><i data-lucide="eye" style="width: 12px; height: 12px;"></i>${formatViews(views)}x ditonton</div>` : ''}
        </article>`;
}

// Merender feed video (filter berdasarkan judul)
function renderVideos(filter = '') {
    const grid = document.getElementById('content-grid');
    if (!grid) return;

    const s = filter.toLowerCase();
    const filtered = VIDEOS.filter(v => v.title.toLowerCase().includes(s));

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 text-center opacity-60">
                <i data-lucide="frown" style="width: 64px; height: 64px; margin-bottom: 16px;"></i>
                <p class="text-sm font-semibold">Coba cari yang lain dan coba lagi</p>
            </div>`;
    } else {
        grid.innerHTML = filtered.map(v => videoCardHtml(v, VIDEOS.indexOf(v))).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const cards = grid.querySelectorAll('.tutorial-card');
    cards.forEach((card, i) => {
        card.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
    });
}

// Merender section "Baru saja dinonton" (riwayat nonton beneran, urut dari
// yang paling baru ditonton, maksimal HISTORY_MAX video). Entri yang sudah
// lewat 1 minggu otomatis dibuang duluan lewat cleanupHistory(), kecuali
// videonya sudah ditandai favorit. Section disembunyikan kalau riwayat kosong.
function renderPopular() {
    const section = document.getElementById('popular-section');
    const grid = document.getElementById('popular-grid');
    if (!section || !grid) return;

    const history = cleanupHistory();
    const entries = history
        .map(entry => ({ v: VIDEOS.find(v => v.id === entry.id), i: -1 }))
        .filter(entry => !!entry.v)
        .map(entry => ({ v: entry.v, i: VIDEOS.indexOf(entry.v) }));

    if (entries.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    grid.innerHTML = entries.map(entry => videoCardHtml(entry.v, entry.i)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    grid.querySelectorAll('.tutorial-card').forEach((card, i) => {
        card.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
    });
}

let currentVideo = null;

// Update tampilan tombol bintang favorit sesuai status video yang lagi dibuka
function updateVideoFavButton() {
    const btn = document.getElementById('video-fav-btn');
    if (!btn || !currentVideo || typeof isVideoFavorited !== 'function') return;
    const fav = isVideoFavorited(currentVideo.id);
    btn.innerHTML = favStarIconSvg(fav);
    btn.classList.toggle('is-favorited', fav);
    btn.setAttribute('aria-label', fav ? 'Hapus dari favorit' : 'Tandai favorit');
}

function toggleCurrentVideoFavorite() {
    if (!currentVideo || typeof toggleVideoFavorite !== 'function') return;
    toggleVideoFavorite(currentVideo.id);
    updateVideoFavButton();
    renderPopular(); // riwayat ikut nyesuaiin (video favorit nggak ikut expired 1 minggu)
}

function openVideoModal(index) {
    const v = VIDEOS[index];
    if (!v) return;
    const id = extractYouTubeId(v.url);
    if (!id) return;

    currentVideo = v;
    incrementView(v.id);
    addToHistory(v.id);

    document.getElementById('video-modal-title').textContent = v.title;
    document.getElementById('video-youtube-link').href = v.url;
    document.getElementById('video-frame-wrap').innerHTML =
        `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    document.getElementById('video-modal-overlay').classList.add('active');
    updateVideoFavButton();

    // Refresh tampilan biar view count & riwayat "Baru saja dinonton" ikut update
    const searchInputEl = document.getElementById('search-input');
    renderVideos(searchInputEl ? searchInputEl.value : '');
    renderPopular();
}

function closeVideoModal() {
    document.getElementById('video-modal-overlay').classList.remove('active');
    document.getElementById('video-frame-wrap').innerHTML = '';
}

const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => renderVideos(e.target.value));
}

async function loadVideos() {
    try {
        const res = await fetch('/videos.json');
        VIDEOS = await res.json();
    } catch (err) {
        console.error('Gagal memuat videos.json:', err);
        VIDEOS = [];
    }
    renderVideos();
    renderPopular();
}
loadVideos();
