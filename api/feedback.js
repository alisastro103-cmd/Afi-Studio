// api/feedback.js
// Endpoint ini jalan di server Vercel. Token Telegram diambil dari
// Environment Variable, jadi tidak pernah terlihat oleh pengunjung.
// Support kirim teks saja ATAU teks + gambar (multipart/form-data).
//
// Lapisan proteksi di file ini (urutan eksekusi):
//   1. Rate limiting (Upstash Redis, sliding window 5x/10 menit per IP)
//   2. Validasi input server-side
//   3. Verifikasi reCAPTCHA ke Google
//   4. Escape markdown sebelum dikirim ke Telegram

import formidable from 'formidable';
import fs from 'fs';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Rate limiter dibuat di module scope supaya instance-nya dipakai ulang
// antar-invocation selama function masih "warm", bukan dibuat baru
// tiap request. Sliding window: maksimal 5 request per 10 menit per IP.
const ratelimit = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      analytics: true,
      prefix: 'afi-studio:feedback',
    })
  : null;

// Escape karakter spesial legacy Telegram Markdown supaya input user
// (nama/pesan) tidak bisa merusak format pesan atau bikin request ke
// Telegram API gagal (unclosed entities, dsb).
function escapeMarkdown(str) {
  return String(str).replace(/([_*`\[])/g, '\\$1');
}

// Verifikasi token reCAPTCHA ke Google. Wajib dilakukan di server,
// karena token dari client bisa dipalsukan/dikosongkan begitu saja.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID || !process.env.RECAPTCHA_SECRET_KEY) {
    return res.status(500).json({ error: 'Konfigurasi server belum lengkap.' });
  }

  // Ambil IP client dari header Vercel.
  const clientIp = req.headers['x-forwarded-for'] || '127.0.0.1';

  // === 1. RATE LIMITING (paling awal, sebelum form.parse) ===
  // Dibungkus try-catch: kalau Upstash sedang down/error, request tetap
  // diloloskan (fail-open) daripada mem-block semua orang gara-gara
  // masalah di pihak Redis. Ini trade-off yang disengaja: availability
  // diprioritaskan di atas proteksi rate-limit saat terjadi outage.
  // Perlu diketahui: ini berarti selama Upstash down, endpoint kembali
  // tidak terlindungi dari spam volume tinggi (tapi reCAPTCHA tetap aktif).
  if (ratelimit) {
    try {
      const { success, reset } = await ratelimit.limit(clientIp);
      if (!success) {
        const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({
          error: 'Terlalu banyak mengirim pesan. Silakan coba lagi nanti.',
        });
      }
    } catch (e) {
      // Redis error/outage -> lolos (fail-safe), tapi tetap dicatat di log
      // server supaya kamu tahu kalau Upstash sedang bermasalah.
      console.error('Rate limit check failed, allowing request through:', e);
    }
  }

  const form = formidable({
    maxFileSize: 1 * 1024 * 1024, // 1MB, samain kayak batas di frontend
    multiples: false,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      // Formidable juga throw error kalau file kelebihan maxFileSize
      return res.status(400).json({ error: 'Gagal memproses form atau ukuran file terlalu besar.' });
    }

    const name = (Array.isArray(fields.name) ? fields.name[0] : fields.name || '').trim();
    const message = (Array.isArray(fields.message) ? fields.message[0] : fields.message || '').trim();
    const recaptchaToken = Array.isArray(fields['g-recaptcha-response'])
      ? fields['g-recaptcha-response'][0]
      : fields['g-recaptcha-response'];
    const imageFile = Array.isArray(files.imageFile) ? files.imageFile[0] : files.imageFile;

    // === 2. VALIDASI INPUT SERVER-SIDE ===
    if (!name || !message) {
      return res.status(400).json({ error: 'Nama dan pesan wajib diisi.' });
    }
    if (name.length > 50 || message.length > 600) {
      return res.status(400).json({ error: 'Karakter melebihi batas yang ditentukan.' });
    }

    // === 3. VERIFIKASI reCAPTCHA ===
    // WAJIB: tanpa ini, siapa pun bisa POST langsung ke endpoint ini
    // dan melewati captcha sepenuhnya.
    const captcha = await verifyRecaptcha(recaptchaToken, clientIp);
    if (!captcha.ok) {
      return res.status(400).json({ error: 'Verifikasi reCAPTCHA gagal. Coba lagi.' });
    }

    // === 4. ESCAPE MARKDOWN sebelum dikirim ke Telegram ===
    const safeName = escapeMarkdown(name);
    const safeMessage = escapeMarkdown(message);
    const text = `📩 *FEEDBACK BARU - AFI STUDIO*\n\n👤 *Nama:* ${safeName}\n💬 *Pesan:* ${safeMessage}`;

    try {
      let response;

      if (imageFile) {
        const filePath = imageFile.filepath || imageFile.path;
        const fileBuffer = fs.readFileSync(filePath);
        const blob = new Blob([fileBuffer], { type: imageFile.mimetype || 'image/jpeg' });

        const telegramForm = new FormData();
        telegramForm.append('chat_id', CHAT_ID);
        telegramForm.append('photo', blob, imageFile.originalFilename || 'image.jpg');
        telegramForm.append('caption', text);
        telegramForm.append('parse_mode', 'Markdown');

        response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: telegramForm,
        });

        // Bersihin file temporary setelah dipakai
        fs.unlink(filePath, () => {});
      } else {
        response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text,
            parse_mode: 'Markdown',
          }),
        });
      }

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.description || 'Gagal mengirim ke Telegram');
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: 'Gagal mengirim feedback. Coba lagi nanti.' });
    }
  });
}
