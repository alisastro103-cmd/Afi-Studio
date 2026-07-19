// Data video dimuat dari videos.json (lihat loadVideos di bawah)
let VIDEOS = [];

function extractYouTubeId(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
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
        grid.innerHTML = filtered.map(v => {
            const index = VIDEOS.indexOf(v);
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
        }).join('');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const cards = grid.querySelectorAll('.tutorial-card');
    cards.forEach((card, i) => {
        card.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
    });
}

function openVideoModal(index) {
    const v = VIDEOS[index];
    if (!v) return;
    const id = extractYouTubeId(v.url);
    if (!id) return;

    document.getElementById('video-modal-title').textContent = v.title;
    document.getElementById('video-youtube-link').href = v.url;
    document.getElementById('video-frame-wrap').innerHTML =
        `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    document.getElementById('video-modal-overlay').classList.add('active');
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
}
loadVideos();
