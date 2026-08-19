// api/cron/pending-reminder.js
// Dijadwalin Vercel Cron (lihat "crons" di vercel.json) buat ngecek tiap hari:
// ada gak pendaftaran model yang udah nunggu direview lebih dari REMIND_AFTER_DAYS
// hari? Kalau ada, kirim 1 pesan ringkasan ke Telegram (bukan spam satu-satu per
// entry). Endpoint ini CUMA baca data & kirim notifikasi — gak pernah mengubah/
// menghapus apapun, jadi aman dijalankan berkali-kali tanpa efek samping.
//
// ================= SETUP =================
// Otomatis jalan tiap hari begitu di-deploy (lihat jadwal di vercel.json).
// Opsional: set env var CRON_SECRET di Vercel buat proteksi endpoint ini dari
// diakses orang lain lewat browser — kalau di-set, Vercel OTOMATIS nempelin
// header "Authorization: Bearer <CRON_SECRET>" tiap manggil endpoint ini lewat
// jadwal cron, jadi gak perlu setup tambahan apapun selain nge-set env var-nya.

import { Redis } from '@upstash/redis';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const CRON_SECRET = process.env.CRON_SECRET;

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const PENDING_KEY = 'afi-studio:data:pendingmodels';
const REMIND_AFTER_DAYS = 2; // ubah angka ini kalau mau ambang batasnya beda
const MAX_LISTED = 10; // jangan bikin pesannya kepanjangan kalau pending numpuk banyak

export default async function handler(req, res) {
  if (CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (!redis || !BOT_TOKEN || !CHAT_ID) {
    // Jangan bikin cron-nya "gagal" di dashboard Vercel cuma karena env var
    // belum lengkap pas awal setup — cukup laporin & keluar dengan status 200.
    return res.status(200).json({ skipped: true, reason: 'Redis/BOT_TOKEN/CHAT_ID belum lengkap di Environment Variables.' });
  }

  try {
    const list = (await redis.get(PENDING_KEY)) || [];
    const pending = Array.isArray(list) ? list : [];
    const now = Date.now();
    const old = pending.filter((p) => p.submittedAt && (now - new Date(p.submittedAt).getTime()) >= REMIND_AFTER_DAYS * 86400000);

    if (!old.length) {
      return res.status(200).json({ ok: true, reminded: 0 });
    }

    old.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)); // paling lama duluan

    let text = `⏰ <b>Reminder: ${old.length} pendaftaran model nunggu review &gt;${REMIND_AFTER_DAYS} hari</b>\n\n`;
    old.slice(0, MAX_LISTED).forEach((p) => {
      const days = Math.floor((now - new Date(p.submittedAt).getTime()) / 86400000);
      const name = (p.name || '-').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
      text += `• ${name} — ${days} hari\n`;
    });
    if (old.length > MAX_LISTED) {
      text += `\n...dan ${old.length - MAX_LISTED} lainnya.`;
    }
    text += `\n\nKetik /pending di bot buat lihat semua.`;

    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
    });
    const data = await resp.json();
    if (!data.ok) {
      return res.status(502).json({ error: data.description || 'Gagal kirim reminder ke Telegram.' });
    }

    return res.status(200).json({ ok: true, reminded: old.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
