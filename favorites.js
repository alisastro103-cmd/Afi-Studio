// === Sistem Favorit Afi-Studio (localStorage, per-device) ===
// Video disimpan sebagai daftar ID video (lihat videos.json).
// Model belum punya field `id` di models.json, jadi dipakai `link` (URL download)-nya
// sebagai penanda unik tiap model.
const FAV_VIDEO_KEY = 'afi-favorite-videos';
const FAV_MODEL_KEY = 'afi-favorite-models';

function _favGetList(key) {
    try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

function _favSaveList(key, list) {
    try {
        localStorage.setItem(key, JSON.stringify(list));
    } catch (err) {
        // localStorage penuh/diblokir -> diem aja, fitur ini opsional
    }
}

function isVideoFavorited(id) {
    if (!id) return false;
    return _favGetList(FAV_VIDEO_KEY).includes(id);
}

// Mengembalikan true kalau video sekarang JADI favorit, false kalau baru saja dihapus
function toggleVideoFavorite(id) {
    if (!id) return false;
    const list = _favGetList(FAV_VIDEO_KEY);
    const idx = list.indexOf(id);
    if (idx > -1) {
        list.splice(idx, 1);
    } else {
        list.push(id);
    }
    _favSaveList(FAV_VIDEO_KEY, list);
    return idx === -1;
}

// ID unik model dipakai dari field `link` (URL download), karena models.json
// belum punya field `id` tersendiri.
function modelFavId(model) {
    return model && model.link ? model.link : null;
}

function isModelFavorited(id) {
    if (!id) return false;
    return _favGetList(FAV_MODEL_KEY).includes(id);
}

// Mengembalikan true kalau model sekarang JADI favorit, false kalau baru saja dihapus
function toggleModelFavorite(id) {
    if (!id) return false;
    const list = _favGetList(FAV_MODEL_KEY);
    const idx = list.indexOf(id);
    if (idx > -1) {
        list.splice(idx, 1);
    } else {
        list.push(id);
    }
    _favSaveList(FAV_MODEL_KEY, list);
    return idx === -1;
}

function getFavoriteVideoIds() {
    return _favGetList(FAV_VIDEO_KEY);
}

function getFavoriteModelIds() {
    return _favGetList(FAV_MODEL_KEY);
}

// Ikon bintang kecil (SVG) - dua versi: kosong (belum favorit) & penuh (sudah favorit)
function favStarIconSvg(filled) {
    return filled
        ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>';
}

// === Layar "Terima kasih" full-screen saat model diunduh =========================
// Dipasang di sini (favorites.js) karena file ini sudah dimuat di semua halaman yang
// punya tombol "Download Now" (Beranda, Semua Model, Favorit) — jadi cukup satu fungsi
// global (window.showThankYouOverlay) yang dipanggil dari handleDownload() di
// Models/script.js & favorit/script.js, tanpa perlu bikin overlay baru di tiap halaman.
(function () {
    var OVERLAY_ID = 'afi-thankyou-overlay';
    var autoHideTimer = null;

    function injectStyleOnce() {
        if (document.getElementById('afi-thankyou-style')) return;
        var style = document.createElement('style');
        style.id = 'afi-thankyou-style';
        style.textContent =
            '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;' +
            'align-items:center;justify-content:center;gap:14px;text-align:center;padding:32px;' +
            'background:color-mix(in srgb, var(--bg, #1e293b) 92%, transparent);' +
            'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);' +
            'opacity:0;visibility:hidden;pointer-events:none;' +
            'transition:opacity .35s ease,visibility .35s;}' +
            '#' + OVERLAY_ID + '.show{opacity:1;visibility:visible;pointer-events:auto;}' +
            '#' + OVERLAY_ID + ' .afi-ty-heart{width:60px;height:60px;color:var(--accent,#4f86d6);' +
            'animation:afiHeartBeat 1.1s ease-in-out infinite;}' +
            '#' + OVERLAY_ID + ' .afi-ty-title{font-family:"Outfit",sans-serif;font-size:21px;' +
            'font-weight:800;color:var(--text,#26313f);max-width:320px;line-height:1.35;}' +
            '#' + OVERLAY_ID + ' .afi-ty-sub{font-size:13px;color:var(--text-sub,#5b6b80);}' +
            '#' + OVERLAY_ID + ' .afi-ty-close{margin-top:8px;padding:10px 24px;border-radius:999px;' +
            'border:1px solid var(--border,#c8d3e1);background:var(--surface,#f5f8fc);' +
            'color:var(--text,#26313f);font-weight:700;font-size:13px;cursor:pointer;}' +
            '@keyframes afiHeartBeat{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}';
        document.head.appendChild(style);
    }

    function ensureOverlay() {
        var el = document.getElementById(OVERLAY_ID);
        if (el) return el;
        injectStyleOnce();
        el = document.createElement('div');
        el.id = OVERLAY_ID;
        el.innerHTML =
            '<svg class="afi-ty-heart" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" ' +
            'stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' +
            '<path d="M12 21s-6.72-4.35-9.5-8.5C.86 9.6 1.6 5.6 5 4.1c2.4-1.06 4.7-.1 7 2.2 2.3-2.3 4.6-3.26 7-2.2 3.4 1.5 4.14 5.5 2.5 8.4C18.72 16.65 12 21 12 21Z"></path>' +
            '</svg>' +
            '<div class="afi-ty-title">Terimakasih Telah menggunakan karya kami</div>' +
            '<div class="afi-ty-sub">Model kamu sedang diunduh…</div>' +
            '<button type="button" class="afi-ty-close">Tutup</button>';
        document.body.appendChild(el);
        el.addEventListener('click', function (e) {
            if (e.target === el) hideThankYouOverlay();
        });
        el.querySelector('.afi-ty-close').addEventListener('click', hideThankYouOverlay);
        return el;
    }

    function hideThankYouOverlay() {
        var el = document.getElementById(OVERLAY_ID);
        if (el) el.classList.remove('show');
        clearTimeout(autoHideTimer);
    }

    // Panggil ini di handleDownload() sebelum redirect ke link download.
    window.showThankYouOverlay = function () {
        var el = ensureOverlay();
        requestAnimationFrame(function () { el.classList.add('show'); });
        clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(hideThankYouOverlay, 3200);
    };
    window.hideThankYouOverlay = hideThankYouOverlay;
})();
