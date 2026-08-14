// api/telegram-webhook.js
// Webhook Telegram buat kontrol balik ke database & repo Afi Studio langsung dari chat.
// Beda sama bot yang udah ada (yang cuma KIRIM notifikasi satu arah) — endpoint ini
// yang NERIMA pesan dari Telegram dan menjalankan perintah.
//
// ================= SETUP (WAJIB dibaca sebelum dipakai) =================
// 1. Tambah Environment Variables baru di Vercel:
//      TELEGRAM_WEBHOOK_SECRET  -> string acak bebas, buat validasi request bener2
//                                   dari Telegram (bukan orang iseng nembak URL).
//      GITHUB_TOKEN             -> Personal Access Token GitHub (scope: repo / contents:write)
//      GITHUB_REPO              -> "username/Afi-Studio" (punya kamu)
//      GITHUB_BRANCH            -> "main" (atau branch default kamu)
//    (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, UPSTASH_*, ADMIN_TOKEN udah ada, dipakai ulang.)
//
// 2. Daftarin webhook ke Telegram (jalankan sekali aja lewat browser/curl, ganti placeholder):
//      https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://afi-studio.vercel.app/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
//
// 3. Chat ke bot kamu sendiri, ketik /help buat lihat daftar perintah.
//
// ================= KEAMANAN =================
// - Setiap request divalidasi header "X-Telegram-Bot-Api-Secret-Token" HARUS cocok
//   dengan TELEGRAM_WEBHOOK_SECRET. Kalau gak cocok, request langsung ditolak.
// - Setiap PESAN divalidasi chat_id pengirim HARUS sama dengan TELEGRAM_CHAT_ID
//   (chat admin yang sudah ada). Orang lain yang chat ke bot ini akan diabaikan.
// - Perintah yang mengubah/menghapus data (setthumb, delpending, delsurvey, dst)
//   TIDAK ADA tombol konfirmasi tambahan — sengaja langsung eksekusi, karena satu2nya
//   yang bisa manggil ini cuma kamu. Kalau mau, tinggal tambah langkah "ketik lagi buat
//   konfirmasi" di masing2 handler kalau suatu saat perlu.

import { Redis } from '@upstash/redis';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // "username/repo"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const PENDING_KEY = 'afi-studio:data:pendingmodels';
const SURVEYS_KEY = 'afi-studio:data:surveys';

// ================= HELPER: TELEGRAM =================

async function tgSend(text, opts = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', ...opts }),
  });
}

async function tgGetFileUrl(fileId) {
  const metaResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const meta = await metaResp.json();
  if (!meta.ok) throw new Error('Gagal ambil info file dari Telegram.');
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${meta.result.file_path}`;
}

// ================= HELPER: GITHUB (buat ganti file statis, mis. thumbnail.webp) =================

async function githubGetFile(path) {
  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!resp.ok) throw new Error(`Gagal baca ${path} dari GitHub (status ${resp.status}).`);
  const data = await resp.json();
  return data.sha;
}

async function githubPutFile(path, base64Content, message) {
  const sha = await githubGetFile(path).catch(() => null); // null kalau file belum ada
  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: base64Content,
        branch: GITHUB_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    }
  );
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Gagal commit ${path} ke GitHub (status ${resp.status}): ${errBody.slice(0, 200)}`);
  }
  return resp.json();
}

// ================= HANDLERS PER PERINTAH =================

async function cmdHelp() {
  await tgSend(
    '<b>Perintah Afi Studio Bot</b>\n\n' +
    '<b>Status &amp; data</b>\n' +
    '/status — ringkasan jumlah data\n' +
    '/pending — daftar pendaftaran model yang belum diproses\n' +
    '/delpending &lt;id&gt; — hapus 1 entri pending\n' +
    '/clearpending — hapus SEMUA entri pending\n' +
    '/surveys — daftar survey yang ada\n' +
    '/delsurvey &lt;id&gt; — hapus 1 survey\n\n' +
    '<b>Thumbnail</b>\n' +
    '/setsurveythumb &lt;id&gt; &lt;url&gt; — ganti thumbnail (OG) survey pakai link\n' +
    'Kirim FOTO dengan caption <code>/setthumb</code> — ganti thumbnail utama situs ' +
    '(dipakai di beranda, About, Privacy). Butuh GITHUB_TOKEN &amp; GITHUB_REPO di-set.'
  );
}

async function cmdStatus() {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const [pending, surveys] = await Promise.all([
    redis.get(PENDING_KEY).catch(() => null),
    redis.get(SURVEYS_KEY).catch(() => null),
  ]);
  const pendingCount = Array.isArray(pending) ? pending.length : 0;
  const surveyList = Array.isArray(surveys) ? surveys : [];
  const activeSurveys = surveyList.filter(s => !s.expiresAt || new Date(s.expiresAt) > new Date()).length;
  await tgSend(
    `<b>Status Afi Studio</b>\n\n` +
    `Pendaftaran model pending: <b>${pendingCount}</b>\n` +
    `Survey total: <b>${surveyList.length}</b> (aktif: ${activeSurveys})`
  );
}

async function cmdPending() {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(PENDING_KEY)) || [];
  if (!Array.isArray(list) || list.length === 0) return tgSend('Gak ada pendaftaran model yang pending. 🎉');
  const top = list.slice(-10).reverse();
  let text = `<b>Pendaftaran Pending</b> (${list.length} total, 10 terbaru)\n\n`;
  for (const item of top) {
    text += `• <code>${item.id}</code> — ${item.name || '-'} (${item.role || '-'})\n  ${new Date(item.submittedAt).toLocaleString('id-ID')}\n`;
  }
  text += '\nHapus: <code>/delpending id</code>';
  await tgSend(text);
}

async function cmdDelPending(id) {
  if (!id) return tgSend('Format: /delpending id_nya\nLihat id lewat /pending');
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(PENDING_KEY)) || [];
  if (!Array.isArray(list)) return tgSend('Data pending kosong/rusak.');
  const filtered = list.filter(item => item.id !== id);
  if (filtered.length === list.length) return tgSend(`Gak ketemu entri dengan id "${id}".`);
  await redis.set(PENDING_KEY, filtered);
  await tgSend(`Terhapus: <code>${id}</code>. Sisa pending: ${filtered.length}.`);
}

async function cmdClearPending() {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  await redis.set(PENDING_KEY, []);
  await tgSend('Semua antrian pendaftaran model pending sudah dibersihkan.');
}

async function cmdSurveys() {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(SURVEYS_KEY)) || [];
  if (!Array.isArray(list) || list.length === 0) return tgSend('Belum ada survey.');
  let text = `<b>Daftar Survey</b> (${list.length})\n\n`;
  for (const s of list) {
    const expired = s.expiresAt && new Date(s.expiresAt) < new Date();
    text += `• <code>${s.id}</code> — ${s.title || '(tanpa judul)'} ${expired ? '(kadaluarsa)' : ''}\n`;
  }
  text += '\nHapus: <code>/delsurvey id</code>\nGanti thumbnail: <code>/setsurveythumb id url</code>';
  await tgSend(text);
}

async function cmdDelSurvey(id) {
  if (!id) return tgSend('Format: /delsurvey id_nya\nLihat id lewat /surveys');
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(SURVEYS_KEY)) || [];
  if (!Array.isArray(list)) return tgSend('Data survey kosong/rusak.');
  const filtered = list.filter(s => s.id !== id);
  if (filtered.length === list.length) return tgSend(`Gak ketemu survey dengan id "${id}".`);
  await redis.set(SURVEYS_KEY, filtered);
  await tgSend(`Survey <code>${id}</code> terhapus. Sisa: ${filtered.length}.`);
}

async function cmdSetSurveyThumb(id, url) {
  if (!id || !url) return tgSend('Format: /setsurveythumb id https://url-gambar');
  if (!/^https?:\/\//i.test(url)) return tgSend('URL harus diawali http:// atau https://');
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(SURVEYS_KEY)) || [];
  if (!Array.isArray(list)) return tgSend('Data survey kosong/rusak.');
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return tgSend(`Gak ketemu survey dengan id "${id}".`);
  list[idx] = { ...list[idx], thumbnail: url };
  await redis.set(SURVEYS_KEY, list);
  await tgSend(`Thumbnail survey <code>${id}</code> diganti ke:\n${url}`);
}

async function cmdSetThumbFromPhoto(fileId) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return tgSend('Fitur ini butuh GITHUB_TOKEN dan GITHUB_REPO di-set dulu di Environment Variables Vercel.');
  }
  try {
    await tgSend('Lagi proses... ambil gambar & commit ke repo.');
    const fileUrl = await tgGetFileUrl(fileId);
    const imgResp = await fetch(fileUrl);
    if (!imgResp.ok) throw new Error('Gagal download gambar dari Telegram.');
    const buffer = Buffer.from(await imgResp.arrayBuffer());
    const base64 = buffer.toString('base64');
    await githubPutFile('thumbnail.webp', base64, 'chore: update thumbnail via Telegram bot');
    await tgSend(
      'Thumbnail utama berhasil diganti (commit ke GitHub).\n' +
      'Vercel bakal auto-redeploy — cek lagi dalam ~1-2 menit di link preview WhatsApp/Discord ' +
      '(mungkin perlu di-refresh cache preview-nya).'
    );
  } catch (e) {
    await tgSend(`Gagal ganti thumbnail: ${e.message}`);
  }
}

// ================= ROUTER =================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!BOT_TOKEN || !CHAT_ID || !WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi lengkap.' });
  }

  // Validasi request beneran dari Telegram
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
  if (secretHeader !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Selalu balas 200 cepat ke Telegram supaya gak retry terus, proses di background try/catch
  res.status(200).json({ ok: true });

  try {
    const update = req.body;
    const message = update && update.message;
    if (!message) return;

    // Cuma layani chat admin yang sama seperti TELEGRAM_CHAT_ID
    if (String(message.chat.id) !== String(CHAT_ID)) return;

    // Kasus: foto dikirim dengan caption /setthumb
    if (message.photo && message.caption && message.caption.trim().toLowerCase().startsWith('/setthumb')) {
      const largest = message.photo[message.photo.length - 1];
      await cmdSetThumbFromPhoto(largest.file_id);
      return;
    }

    const text = (message.text || '').trim();
    if (!text.startsWith('/')) return;

    const [cmdRaw, ...args] = text.split(/\s+/);
    const cmd = cmdRaw.toLowerCase().replace(/@.*$/, ''); // buang @botname kalau ada

    switch (cmd) {
      case '/start':
      case '/help':
        await cmdHelp();
        break;
      case '/status':
        await cmdStatus();
        break;
      case '/pending':
        await cmdPending();
        break;
      case '/delpending':
        await cmdDelPending(args[0]);
        break;
      case '/clearpending':
        await cmdClearPending();
        break;
      case '/surveys':
        await cmdSurveys();
        break;
      case '/delsurvey':
        await cmdDelSurvey(args[0]);
        break;
      case '/setsurveythumb':
        await cmdSetSurveyThumb(args[0], args[1]);
        break;
      case '/setthumb':
        await tgSend('Kirim FOTO-nya langsung (bukan cuma teks), dengan caption /setthumb.');
        break;
      default:
        await tgSend('Perintah gak dikenal. Ketik /help buat lihat daftar perintah.');
    }
  } catch (e) {
    console.error('Webhook error:', e);
    try { await tgSend(`Error: ${e.message}`); } catch {}
  }
}
