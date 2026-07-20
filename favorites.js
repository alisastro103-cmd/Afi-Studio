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
