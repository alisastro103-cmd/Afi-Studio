// api/admin/media.js
//
// Semua endpoint yang berhubungan sama database gambar (ImageKit=secondary,
// Cloudinary=permanent) digabung jadi SATU file kayak api/admin/auth.js --
// alasannya sama: jatah serverless function di Vercel Hobby cuma 12,
// jadi endpoint kecil-kecil sengaja digabung lewat ?action=.
//
//   POST /api/admin/media?action=upload-secondary   — upload manual dari admin panel
//                                                       (banner beranda, thumbnail survey, dll)
//   POST /api/admin/media?action=upload-permanent    — upload manual buat konten permanen
//                                                       (dipakai kalau admin edit thumbnail Model dsb)
//   POST /api/admin/media?action=approve-model       — approve 1 pendaftaran model:
//                                                       pindah thumbnail secondary -> permanent,
//                                                       otomatis bikin entry Model baru
//   POST /api/admin/media?action=reject-model        — reject 1 pendaftaran model:
//                                                       hapus salinan secondary, buang dari antrian
//
// Semua action WAJIB login admin (checkAdminAuth), gak ada yang publik.

import { Redis } from '@upstash/redis';
import { checkAdminAuth } from '../../lib/admin-auth.js';
import { uploadToSecondary, uploadToPermanent, deleteFromSecondary, moveSecondaryToPermanent } from '../../lib/image-storage.js';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const PENDING_KEY = 'afi-studio:data:pendingmodels';
const MODELS_KEY = 'afi-studio:data:models';

async function parseJsonBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
}

// Terima "data:image/png;base64,AAAA..." ATAU base64 polos -> Buffer.
function decodeBase64Image(dataUrlOrBase64) {
  const match = /^data:.+;base64,(.*)$/.exec(String(dataUrlOrBase64 || ''));
  const raw = match ? match[1] : dataUrlOrBase64;
  return Buffer.from(raw, 'base64');
}

/* ---------------- action: upload-secondary ---------------- */
// Buat form admin panel yang butuh upload konten sementara/rotatif:
// banner beranda, thumbnail survey, dll. body: { imageBase64, fileName, folder }
async function actionUploadSecondary(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Belum login admin.' });

  const body = await parseJsonBody(req);
  if (!body.imageBase64) return res.status(400).json({ error: 'imageBase64 wajib diisi.' });

  try {
    const buffer = decodeBase64Image(body.imageBase64);
    const folder = body.folder || '/secondary/misc';
    const result = await uploadToSecondary(buffer, body.fileName || 'image.jpg', folder);
    return res.status(200).json({ ok: true, url: result.url, fileId: result.fileId });
  } catch (e) {
    return res.status(500).json({ error: `Gagal upload: ${e.message}` });
  }
}

/* ---------------- action: upload-permanent ---------------- */
// body: { imageBase64, fileName, folder }
async function actionUploadPermanent(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Belum login admin.' });

  const body = await parseJsonBody(req);
  if (!body.imageBase64) return res.status(400).json({ error: 'imageBase64 wajib diisi.' });

  try {
    const buffer = decodeBase64Image(body.imageBase64);
    const folder = body.folder || 'permanent/misc';
    const result = await uploadToPermanent(buffer, folder);
    return res.status(200).json({ ok: true, url: result.url, publicId: result.publicId });
  } catch (e) {
    return res.status(500).json({ error: `Gagal upload: ${e.message}` });
  }
}

/* ---------------- action: approve-model ---------------- */
// body: { pendingId }
async function actionApproveModel(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  if (!redis) return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Belum login admin.' });

  const body = await parseJsonBody(req);
  const pendingId = String(body.pendingId || '').trim();
  if (!pendingId) return res.status(400).json({ error: 'pendingId wajib diisi.' });

  const list = (await redis.get(PENDING_KEY)) || [];
  const pending = Array.isArray(list) ? list : [];
  const entry = pending.find((p) => p.id === pendingId);
  if (!entry) return res.status(404).json({ error: 'Submission gak ditemukan (mungkin udah diproses).' });

  // Wajib ada salinan secondary buat dipindah -- kalau gagal keupload pas
  // submit dulu (env belum lengkap saat itu / hosting sumbernya error),
  // admin diminta isi Model-nya manual lewat form Tambah Model biasa.
  if (!entry.thumbSecondary || !entry.thumbSecondary.url) {
    return res.status(400).json({ error: 'Submission ini gak punya salinan thumbnail di secondary storage. Tambahkan Model secara manual lewat menu Model, lalu hapus antrian ini.' });
  }

  let permanent;
  try {
    permanent = await moveSecondaryToPermanent(entry.thumbSecondary.url, entry.thumbSecondary.fileId, 'permanent/models', pendingId);
  } catch (e) {
    return res.status(500).json({ error: `Gagal pindahkan gambar ke permanent storage: ${e.message}` });
  }

  // Susun entry Model baru, mapping dari data pendaftaran.
  // Skema mengikuti apa yang dipakai form Tambah Model di panel:
  // { name, caption, creator, converter, category, app_target, thumb, link }
  const newModel = {
    name: entry.name || '',
    caption: entry.caption || '',
    creator: entry.role === 'creator' ? (entry.creatorConverterName || '') : '',
    converter: entry.role === 'converter' ? (entry.creatorConverterName || '') : '',
    category: Array.isArray(entry.category) ? entry.category : [],
    app_target: entry.appTarget || '',
    thumb: permanent.url,
    // Link download cuma keisi otomatis kalau submission modenya "link".
    // Kalau modenya "upload" (file dikirim ke Telegram), admin masih perlu
    // rehost manual & isi link-nya lewat Edit Model setelah ini -- itu di
    // luar cakupan database gambar, karena itu file model, bukan gambar.
    link: entry.download && entry.download.type === 'link' ? entry.download.value : '',
  };

  try {
    const modelsExisting = (await redis.get(MODELS_KEY)) || [];
    const models = Array.isArray(modelsExisting) ? modelsExisting : [];
    models.push(newModel);
    await redis.set(MODELS_KEY, models);

    const remaining = pending.filter((p) => p.id !== pendingId);
    await redis.set(PENDING_KEY, remaining);
  } catch (e) {
    return res.status(500).json({ error: `Gambar sudah dipindah, tapi gagal simpan ke database: ${e.message}. Cek menu Model, mungkin perlu ditambahkan manual.` });
  }

  return res.status(200).json({
    ok: true,
    model: newModel,
    needsManualLink: !(entry.download && entry.download.type === 'link'),
  });
}

/* ---------------- action: reject-model ---------------- */
// body: { pendingId }
async function actionRejectModel(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  if (!redis) return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return res.status(401).json({ error: 'Belum login admin.' });

  const body = await parseJsonBody(req);
  const pendingId = String(body.pendingId || '').trim();
  if (!pendingId) return res.status(400).json({ error: 'pendingId wajib diisi.' });

  const list = (await redis.get(PENDING_KEY)) || [];
  const pending = Array.isArray(list) ? list : [];
  const entry = pending.find((p) => p.id === pendingId);

  if (entry && entry.thumbSecondary && entry.thumbSecondary.fileId) {
    await deleteFromSecondary(entry.thumbSecondary.fileId);
  }

  try {
    const remaining = pending.filter((p) => p.id !== pendingId);
    await redis.set(PENDING_KEY, remaining);
  } catch (e) {
    return res.status(500).json({ error: `Gagal hapus dari antrian: ${e.message}` });
  }

  return res.status(200).json({ ok: true });
}

const ACTIONS = {
  'upload-secondary': actionUploadSecondary,
  'upload-permanent': actionUploadPermanent,
  'approve-model': actionApproveModel,
  'reject-model': actionRejectModel,
};

export default async function handler(req, res) {
  const action = req.query.action;
  const fn = ACTIONS[action];
  if (!fn) return res.status(400).json({ error: `Action gak dikenal: ${action || '(kosong)'}` });
  return fn(req, res);
}
