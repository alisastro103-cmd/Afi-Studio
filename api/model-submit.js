// api/model-submit.js
// Endpoint buat form "Daftar Model" (/daftar-model/).
// Alurnya beda dikit dari api/feedback.js: submission ini punya DUA tujuan
// sekaligus tiap kali berhasil dikirim:
//   1. Notifikasi LENGKAP (termasuk file/gambar asli kalau user upload)
//      dikirim ke Telegram bot yang sama kayak feedback.
//   2. METADATA TEKS SAJA (bukan file) disimpan ke Redis sebagai antrian
//      "pendingmodels", supaya admin bisa lihat daftar submission yang
//      masih perlu ditinjau lewat Admin Panel, tanpa perlu buka Telegram.
//
// File (thumbnail/file model) TIDAK PERNAH disimpan ke Redis atau ke repo.
// Admin ambil filenya dari chat Telegram, rehost manual ke Drive/Mediafire,
// baru isi link final itu pas approve submission di Admin Panel.
//
// Lapisan proteksi (sama seperti feedback.js):
//   1. Rate limiting (Upstash Redis, sliding window per IP)
//   2. Validasi input server-side
//   3. Verifikasi reCAPTCHA ke Google
//   4. Escape markdown sebelum dikirim ke Telegram

import formidable from 'formidable';
import fs from 'fs';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { imageSize } from 'image-size';

export const config = {
  api: {
    bodyParser: false,
  },
};

// PENTING: Vercel Functions punya batas KERAS 4.5MB per request body,
// gak bisa dinaikin lewat config apapun (infra-level limit). Kalau user
// upload thumbnail DAN file model bersamaan dalam 1 request, keduanya
// harus muat dalam batas itu. Makanya batasnya jauh di bawah 10MB yang
// sempat didiskusikan — kalau butuh file lebih besar, tetap arahkan ke
// link (Mediafire/Drive), sesuai desain awal.
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB per file
const MAX_COMBINED_UPLOAD = 3.8 * 1024 * 1024; // batas gabungan thumb+file kalau dua-duanya upload
const PENDING_REDIS_KEY = 'afi-studio:data:pendingmodels';

// Rasio thumbnail yang wajib dipatuhi: 16:9 (contoh 800x450). Resolusi
// bebas asal rasionya sama. Toleransi kecil buat kompensasi pembulatan.
const TARGET_RATIO = 800 / 450;
const RATIO_TOLERANCE = 0.03;

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      analytics: true,
      prefix: 'afi-studio:modelsubmit',
    })
  : null;

function escapeMarkdown(str) {
  return String(str).replace(/([_*`\[])/g, '\\$1');
}

async function verifyRecaptcha(token, remoteIp) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!token) return { ok: false, reason: 'missing_token' };

  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token);
  if (remoteIp) params.append('remoteip', remoteIp);

  const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await resp.json();
  return { ok: !!data.success, reason: data['error-codes'] };
}

const APP_TARGET_VALUES = ['Prisma3D', 'Blender', 'Mine-Imator', 'Viontri', 'C4D', 'Lainnya'];

function field(fields, name) {
  const v = fields[name];
  return (Array.isArray(v) ? v[0] : v || '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID || !process.env.RECAPTCHA_SECRET_KEY) {
    return res.status(500).json({ error: 'Konfigurasi server belum lengkap.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });
  }

  const clientIp = req.headers['x-forwarded-for'] || '127.0.0.1';

  // === 1. RATE LIMITING ===
  if (ratelimit) {
    try {
      const { success, reset } = await ratelimit.limit(clientIp);
      if (!success) {
        const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({
          error: 'Terlalu banyak mengirim pendaftaran. Silakan coba lagi nanti.',
        });
      }
    } catch (e) {
      console.error('Rate limit check failed, allowing request through:', e);
    }
  }

  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    multiples: false,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: 'Gagal memproses form atau ada file yang lebih dari 10MB. Pakai link kalau file kamu di atas itu.' });
    }

    const name = field(fields, 'name');
    const caption = field(fields, 'caption');
    const creatorConverterName = field(fields, 'creatorConverterName');
    const role = field(fields, 'role'); // 'creator' | 'converter'
    const source = field(fields, 'source');
    const appTarget = field(fields, 'appTarget');
    const thumbMode = field(fields, 'thumbMode'); // 'link' | 'upload'
    const thumbLink = field(fields, 'thumbLink');
    const downloadMode = field(fields, 'downloadMode');
    const downloadLink = field(fields, 'downloadLink');
    const recaptchaToken = field(fields, 'g-recaptcha-response');

    let categories = [];
    try {
      categories = JSON.parse(field(fields, 'categories') || '[]');
      if (!Array.isArray(categories)) categories = [];
    } catch { categories = []; }

    const thumbFile = Array.isArray(files.thumbFile) ? files.thumbFile[0] : files.thumbFile;
    const downloadFile = Array.isArray(files.downloadFile) ? files.downloadFile[0] : files.downloadFile;

    // === 2. VALIDASI INPUT SERVER-SIDE ===
    const errors = [];
    if (!name || name.length > 60) errors.push('Nama model wajib diisi (maks 60 karakter).');
    if (!caption || caption.length > 600) errors.push('Caption wajib diisi (maks 600 karakter).');
    if (!creatorConverterName || creatorConverterName.length > 60) errors.push('Nama kreator/konverter wajib diisi.');
    if (role !== 'creator' && role !== 'converter') errors.push('Pilih Creator atau Converter.');
    if (role === 'converter' && !source) errors.push('Sumber asal wajib diisi kalau kamu Converter.');
    if (categories.length === 0) errors.push('Pilih minimal 1 kategori.');
    if (appTarget && !APP_TARGET_VALUES.includes(appTarget)) errors.push('Aplikasi tujuan tidak valid.');

    if (thumbMode === 'link') {
      if (!thumbLink || !/^https?:\/\//i.test(thumbLink)) errors.push('Link thumbnail wajib diisi dan valid.');
    } else if (thumbMode === 'upload') {
      if (!thumbFile) errors.push('Thumbnail wajib diupload.');
    } else {
      errors.push('Pilih metode thumbnail (link/upload).');
    }

    if (downloadMode === 'link') {
      if (!downloadLink || !/^https?:\/\//i.test(downloadLink)) errors.push('Link download wajib diisi dan valid.');
    } else if (downloadMode === 'upload') {
      if (!downloadFile) errors.push('File model wajib diupload.');
    } else {
      errors.push('Pilih metode file model (link/upload).');
    }

    if (errors.length) {
      // Bersihin file temporary kalau ada, sebelum keluar
      if (thumbFile) fs.unlink(thumbFile.filepath || thumbFile.path, () => {});
      if (downloadFile) fs.unlink(downloadFile.filepath || downloadFile.path, () => {});
      return res.status(400).json({ error: errors[0], errors });
    }

    // === 2b. BATAS GABUNGAN (khusus kalau DUA-DUANYA upload sekaligus) ===
    // Ini di luar batas per-file karena limit sesungguhnya ada di level
    // request Vercel (4.5MB total), bukan per file.
    if (thumbFile && downloadFile && (thumbFile.size + downloadFile.size) > MAX_COMBINED_UPLOAD) {
      fs.unlink(thumbFile.filepath || thumbFile.path, () => {});
      fs.unlink(downloadFile.filepath || downloadFile.path, () => {});
      return res.status(400).json({ error: 'Thumbnail + file model kalau diupload bersamaan totalnya harus di bawah ~3.8MB. Pakai link buat salah satunya.' });
    }

    // === 2c. VALIDASI RASIO THUMBNAIL (wajib 16:9, resolusi bebas) ===
    try {
      let thumbBuffer;
      if (thumbMode === 'upload') {
        thumbBuffer = fs.readFileSync(thumbFile.filepath || thumbFile.path);
      } else {
        const imgResp = await fetch(thumbLink, { signal: AbortSignal.timeout(6000) });
        if (!imgResp.ok) throw new Error('unreachable');
        thumbBuffer = Buffer.from(await imgResp.arrayBuffer());
      }
      const dims = imageSize(thumbBuffer);
      const ratio = dims.width / dims.height;
      if (Math.abs(ratio - TARGET_RATIO) > RATIO_TOLERANCE) {
        if (thumbFile) fs.unlink(thumbFile.filepath || thumbFile.path, () => {});
        if (downloadFile) fs.unlink(downloadFile.filepath || downloadFile.path, () => {});
        return res.status(400).json({ error: `Rasio thumbnail harus 16:9 (contoh 800x450). Gambar kamu ${dims.width}x${dims.height} (rasio ${ratio.toFixed(2)}, harus ~${TARGET_RATIO.toFixed(2)}).` });
      }
    } catch (e) {
      if (thumbFile) fs.unlink(thumbFile.filepath || thumbFile.path, () => {});
      if (downloadFile) fs.unlink(downloadFile.filepath || downloadFile.path, () => {});
      return res.status(400).json({ error: 'Gagal membaca gambar thumbnail. Kalau pakai link, pastikan link-nya ngarah LANGSUNG ke file gambar (bukan halaman preview).' });
    }

    // === 3. VERIFIKASI reCAPTCHA ===
    const captcha = await verifyRecaptcha(recaptchaToken, clientIp);
    if (!captcha.ok) {
      if (thumbFile) fs.unlink(thumbFile.filepath || thumbFile.path, () => {});
      if (downloadFile) fs.unlink(downloadFile.filepath || downloadFile.path, () => {});
      return res.status(400).json({ error: 'Verifikasi reCAPTCHA gagal. Coba lagi.' });
    }

    // === 4. SUSUN PESAN TELEGRAM (escape markdown dulu) ===
    const safe = {
      name: escapeMarkdown(name),
      caption: escapeMarkdown(caption),
      creatorConverterName: escapeMarkdown(creatorConverterName),
      source: escapeMarkdown(source),
      appTarget: escapeMarkdown(appTarget || '-'),
      categories: escapeMarkdown(categories.join(', ')),
    };

    const roleLabel = role === 'converter' ? 'Converter' : 'Creator';
    let text = `🧩 *PENDAFTARAN MODEL BARU*\n\n`;
    text += `📦 *Nama:* ${safe.name}\n`;
    text += `📝 *Caption:* ${safe.caption}\n`;
    text += `👤 *${roleLabel}:* ${safe.creatorConverterName}\n`;
    if (role === 'converter') text += `🔗 *Sumber asal:* ${safe.source}\n`;
    text += `🏷️ *Kategori:* ${safe.categories}\n`;
    text += `🎯 *Aplikasi Tujuan:* ${safe.appTarget}\n`;
    text += `🖼️ *Thumbnail:* ${thumbMode === 'link' ? thumbLink : `Upload (lihat lampiran, ${thumbFile ? Math.round(thumbFile.size / 1024) : '?'} KB)`}\n`;
    text += `📁 *File Model:* ${downloadMode === 'link' ? downloadLink : `Upload (lihat lampiran, ${downloadFile ? Math.round(downloadFile.size / 1024) : '?'} KB)`}`;

    let thumbFileId = null;

    try {
      // Kirim teks lengkap dulu (selalu ada, apapun kombinasi link/upload-nya)
      const msgResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
      });
      const msgResult = await msgResp.json();
      if (!msgResult.ok) throw new Error(msgResult.description || 'Gagal mengirim ke Telegram');

      // Kirim thumbnail asli kalau diupload
      if (thumbFile) {
        const buf = fs.readFileSync(thumbFile.filepath || thumbFile.path);
        const blob = new Blob([buf], { type: thumbFile.mimetype || 'image/jpeg' });
        const tf = new FormData();
        tf.append('chat_id', CHAT_ID);
        tf.append('photo', blob, thumbFile.originalFilename || 'thumbnail.jpg');
        tf.append('caption', `🖼️ Thumbnail untuk: ${name}`);
        const tfResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: tf });
        const tfResult = await tfResp.json();
        if (tfResult.ok) {
          const photos = tfResult.result.photo || [];
          thumbFileId = photos.length ? photos[photos.length - 1].file_id : null;
        }
        fs.unlink(thumbFile.filepath || thumbFile.path, () => {});
      }

      // Kirim file model asli kalau diupload
      if (downloadFile) {
        const buf = fs.readFileSync(downloadFile.filepath || downloadFile.path);
        const blob = new Blob([buf], { type: downloadFile.mimetype || 'application/octet-stream' });
        const df = new FormData();
        df.append('chat_id', CHAT_ID);
        df.append('document', blob, downloadFile.originalFilename || 'model-file');
        df.append('caption', `📁 File model untuk: ${name}`);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: 'POST', body: df });
        fs.unlink(downloadFile.filepath || downloadFile.path, () => {});
      }
    } catch (e) {
      console.error('Gagal kirim ke Telegram:', e.message);
      return res.status(500).json({ error: 'Gagal mengirim pendaftaran. Coba lagi nanti.' });
    }

    // === 5. SIMPAN METADATA (TANPA FILE) KE ANTRIAN "pendingmodels" ===
    const entry = {
      id: 'pm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      submittedAt: new Date().toISOString(),
      name,
      caption,
      creatorConverterName,
      role,
      source: role === 'converter' ? source : '',
      category: categories,
      appTarget: appTarget || '',
      thumb: thumbMode === 'link'
        ? { type: 'link', value: thumbLink }
        : { type: 'upload', filename: thumbFile.originalFilename || '', sizeKb: Math.round((thumbFile.size || 0) / 1024), fileId: thumbFileId },
      download: downloadMode === 'link'
        ? { type: 'link', value: downloadLink }
        : { type: 'upload', filename: downloadFile.originalFilename || '', sizeKb: Math.round((downloadFile.size || 0) / 1024) },
    };

    try {
      const existing = (await redis.get(PENDING_REDIS_KEY)) || [];
      const list = Array.isArray(existing) ? existing : [];
      list.push(entry);
      await redis.set(PENDING_REDIS_KEY, list);
    } catch (e) {
      // Pesan sudah terlanjur nyampe ke Telegram, jadi tetap dianggap sukses
      // buat user walau gagal nyimpen ke antrian pending (admin masih bisa
      // proses manual dari chat Telegram sebagai fallback).
      console.error('Gagal simpan ke antrian pendingmodels:', e.message);
    }

    return res.status(200).json({ success: true, id: entry.id });
  });
}
