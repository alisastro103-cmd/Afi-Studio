// api/telegram-webhook.js
// Webhook Telegram buat kontrol balik ke database & repo Afi Studio langsung dari chat.
// Beda sama bot yang udah ada (yang cuma KIRIM notifikasi satu arah) — endpoint ini
// yang NERIMA pesan dari Telegram dan menjalankan perintah.
//
// ================= SETUP (WAJIB dibaca sebelum dipakai) =================
// 1. Environment Variables di Vercel:
//      TELEGRAM_WEBHOOK_SECRET   -> string acak bebas, buat validasi request bener2
//                                    dari Telegram (bukan orang iseng nembak URL).
//      GITHUB_TOKEN              -> Personal Access Token GitHub (scope: repo / contents:write)
//      GITHUB_REPO               -> "username/Afi-Studio" (punya kamu)
//      GITHUB_BRANCH             -> "main" (atau branch default kamu)
//      TELEGRAM_BROADCAST_CHAT_ID -> (opsional) chat_id channel/grup Folofi buat /broadcast.
//                                    Bot HARUS jadi admin di channel/grup itu dulu.
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
//   yang bisa manggil ini cuma kamu. Pengecualian: /restore, yang efeknya nimpa SEMUA
//   data live sekaligus, jadi wajib diketik ulang dengan kata "KONFIRMASI".
//
// ================= PENTING: KENAPA RESPONSE DIKIRIM DI PALING AKHIR =================
// Versi awal file ini balas 200 ke Telegram DULUAN, baru lanjut proses command di
// belakang (biar Telegram gak nunggu/retry). Ini ternyata JUSTRU jadi sumber bug
// "kadang bot diem gak bales, baru kebales pas pesan berikutnya" — karena begitu
// response udah keluar, Vercel/AWS Lambda kadang langsung MEMBEKUKAN container
// sebelum kode async di belakangnya (redis.set, fetch ke Telegram, dst) sempet
// kelar. Proses yang "kepotong" itu baru lanjut/ke-flush pas invocation BERIKUTNYA
// masuk — makanya kerasanya harus "kirim pesan ulang baru dibales".
// Fix-nya: semua proses di-`await` SAMPAI SELESAI dulu, baru response 200 dikirim
// paling akhir. Command di sini ringan (beberapa panggilan redis/fetch), jadi masih
// jauh di bawah batas timeout function Vercel.

import { Redis } from '@upstash/redis';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const BROADCAST_CHAT_ID = process.env.TELEGRAM_BROADCAST_CHAT_ID;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // "username/repo"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const PENDING_KEY = 'afi-studio:data:pendingmodels';
const SURVEYS_KEY = 'afi-studio:data:surveys';
const MODELS_KEY = 'afi-studio:data:models';

// Semua koleksi data yang ikut di-backup/restore. Nama di kiri dipakai sebagai
// nama field di file backup JSON-nya; harus sinkron sama api/data/[type].js.
const BACKUP_KEYS = {
  models: MODELS_KEY,
  videos: 'afi-studio:data:videos',
  banner: 'afi-studio:data:banner',
  marquee: 'afi-studio:data:marquee',
  member: 'afi-studio:data:member',
  ranking: 'afi-studio:data:ranking',
  categories: 'afi-studio:data:categories',
  appcategories: 'afi-studio:data:appcategories',
  settings: 'afi-studio:data:settings',
  pendingmodels: PENDING_KEY,
  surveys: SURVEYS_KEY,
};

// ================= HELPER: TELEGRAM =================

async function tgSendTo(chatId, text, opts = {}) {
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...opts }),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.description || 'Gagal kirim pesan ke Telegram');
  return data;
}

async function tgSend(text, opts = {}) {
  return tgSendTo(CHAT_ID, text, opts);
}

async function tgGetFileUrl(fileId) {
  const metaResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const meta = await metaResp.json();
  if (!meta.ok) throw new Error('Gagal ambil info file dari Telegram.');
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${meta.result.file_path}`;
}

// ================= HELPER: GITHUB (statis file & backup) =================

async function githubGetFileMeta(path) {
  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!resp.ok) throw new Error(`Gagal baca ${path} dari GitHub (status ${resp.status}).`);
  return resp.json();
}

async function githubGetFileRaw(path) {
  try {
    const data = await githubGetFileMeta(path);
    return { sha: data.sha, content: Buffer.from(data.content, 'base64').toString('utf-8') };
  } catch {
    return null;
  }
}

async function githubListDir(path) {
  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${GITHUB_BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

async function githubPutFile(path, base64Content, message) {
  const sha = await githubGetFileMeta(path).then(d => d.sha).catch(() => null); // null kalau file belum ada
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

function requireGithub() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new Error('Fitur ini butuh GITHUB_TOKEN dan GITHUB_REPO di-set dulu di Environment Variables Vercel.');
  }
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
    '/delsurvey &lt;id&gt; — hapus 1 survey\n' +
    '/find &lt;kata kunci&gt; — cari model/pending/survey by nama\n\n' +
    '<b>Thumbnail</b>\n' +
    '/setsurveythumb &lt;id&gt; &lt;url&gt; — ganti thumbnail (OG) survey pakai link\n' +
    'Kirim FOTO dengan caption <code>/setthumb</code> — ganti thumbnail utama situs\n\n' +
    '<b>Backup &amp; restore</b> (butuh GITHUB_TOKEN &amp; GITHUB_REPO)\n' +
    '/backup — simpan snapshot semua data ke repo GitHub\n' +
    '/backups — lihat daftar backup yang tersimpan\n' +
    '/restore &lt;file&gt; KONFIRMASI — timpa data live pakai isi backup\n\n' +
    '<b>Broadcast</b> (butuh TELEGRAM_BROADCAST_CHAT_ID)\n' +
    '/broadcast &lt;pesan&gt; — kirim pengumuman ke channel/grup Folofi'
  );
}

async function cmdStatus() {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const [pending, surveys, models] = await Promise.all([
    redis.get(PENDING_KEY).catch(() => null),
    redis.get(SURVEYS_KEY).catch(() => null),
    redis.get(MODELS_KEY).catch(() => null),
  ]);
  const pendingCount = Array.isArray(pending) ? pending.length : 0;
  const surveyList = Array.isArray(surveys) ? surveys : [];
  const modelsCount = Array.isArray(models) ? models.length : 0;
  const activeSurveys = surveyList.filter(s => !s.expiresAt || new Date(s.expiresAt) > new Date()).length;
  await tgSend(
    `<b>Status Afi Studio</b>\n\n` +
    `Model terpublish: <b>${modelsCount}</b>\n` +
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
  try {
    requireGithub();
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

// --- Pencarian cepat ---

async function cmdFind(keyword) {
  if (!keyword) return tgSend('Format: /find kata_kunci');
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const q = keyword.toLowerCase();

  const [models, pending, surveys] = await Promise.all([
    redis.get(MODELS_KEY).catch(() => []),
    redis.get(PENDING_KEY).catch(() => []),
    redis.get(SURVEYS_KEY).catch(() => []),
  ]);

  const results = [];
  (Array.isArray(models) ? models : []).forEach(m => {
    if ((m.name || '').toLowerCase().includes(q)) results.push(`📦 Model: ${m.name}`);
  });
  (Array.isArray(pending) ? pending : []).forEach(p => {
    if ((p.name || '').toLowerCase().includes(q)) results.push(`⏳ Pending: ${p.name} (<code>${p.id}</code>)`);
  });
  (Array.isArray(surveys) ? surveys : []).forEach(s => {
    if ((s.title || '').toLowerCase().includes(q)) results.push(`📊 Survey: ${s.title} (<code>${s.id}</code>)`);
  });

  if (!results.length) return tgSend(`Gak ada hasil buat "${keyword}".`);
  const shown = results.slice(0, 20);
  let text = `<b>Hasil pencarian "${keyword}"</b> (${results.length}${results.length > 20 ? ', ditampilin 20' : ''})\n\n${shown.join('\n')}`;
  await tgSend(text);
}

// --- Backup & restore ---

async function cmdBackup() {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  try {
    requireGithub();
    await tgSend('Lagi bikin backup, tunggu bentar...');

    const snapshot = {};
    for (const [name, key] of Object.entries(BACKUP_KEYS)) {
      snapshot[name] = (await redis.get(key)) ?? null;
    }

    const createdAt = new Date().toISOString();
    const payload = { createdAt, data: snapshot };
    const filename = `backup-${createdAt.replace(/[:.]/g, '-')}.json`;
    const fullPath = `backups/${filename}`;
    const base64 = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64');

    await githubPutFile(fullPath, base64, `chore: backup data via Telegram bot (${createdAt})`);

    await tgSend(
      `Backup berhasil disimpan ✅\n<code>${filename}</code>\n\n` +
      `Buat restore nanti kalau perlu:\n<code>/restore ${filename} KONFIRMASI</code>`
    );
  } catch (e) {
    await tgSend(`Gagal backup: ${e.message}`);
  }
}

async function cmdBackups() {
  try {
    requireGithub();
    const files = await githubListDir('backups');
    const sorted = files
      .filter(f => f.type === 'file' && f.name.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 10);

    if (!sorted.length) return tgSend('Belum ada backup tersimpan. Buat dulu pakai /backup');

    let text = `<b>Backup Tersedia</b> (10 terbaru)\n\n`;
    for (const f of sorted) text += `• <code>${f.name}</code>\n`;
    text += '\nRestore: <code>/restore nama_file.json KONFIRMASI</code>';
    await tgSend(text);
  } catch (e) {
    await tgSend(`Gagal ambil daftar backup: ${e.message}`);
  }
}

async function cmdRestore(filename, confirmWord) {
  if (!filename) return tgSend('Format: /restore nama_file.json KONFIRMASI\nLihat nama file lewat /backups');
  if (confirmWord !== 'KONFIRMASI') {
    return tgSend(
      `⚠️ Ini bakal MENIMPA semua data yang lagi aktif (models, survey, pending, dst) ` +
      `dengan isi backup itu. Gak bisa di-undo kecuali backup ulang.\n\n` +
      `Kalau yakin, ulangi persis:\n<code>/restore ${filename} KONFIRMASI</code>`
    );
  }
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  try {
    requireGithub();
    const path = filename.startsWith('backups/') ? filename : `backups/${filename}`;
    const file = await githubGetFileRaw(path);
    if (!file) return tgSend(`File backup "${filename}" gak ketemu. Cek /backups buat nama yang bener.`);

    const payload = JSON.parse(file.content);
    const snapshot = payload.data || {};

    let restored = 0;
    for (const [name, key] of Object.entries(BACKUP_KEYS)) {
      if (snapshot[name] !== undefined && snapshot[name] !== null) {
        await redis.set(key, snapshot[name]);
        restored++;
      }
    }

    await tgSend(
      `Restore selesai ✅\nDari backup: <code>${filename}</code> (dibuat ${payload.createdAt || '-'})\n` +
      `${restored} koleksi data ditimpa ke kondisi backup itu.`
    );
  } catch (e) {
    await tgSend(`Gagal restore: ${e.message}`);
  }
}

// --- Broadcast ---

async function cmdBroadcast(text) {
  if (!text) return tgSend('Format: /broadcast pesan_kamu');
  if (!BROADCAST_CHAT_ID) {
    return tgSend(
      'Belum ada tujuan broadcast. Set env var TELEGRAM_BROADCAST_CHAT_ID di Vercel ' +
      '(chat_id channel/grup Folofi — bot harus jadi admin di sana dulu), redeploy, baru coba lagi.'
    );
  }
  try {
    await tgSendTo(BROADCAST_CHAT_ID, text);
    await tgSend('Terkirim ke channel/grup broadcast. ✅');
  } catch (e) {
    await tgSend(`Gagal broadcast: ${e.message}`);
  }
}

// ================= ROUTER =================

async function processUpdate(update) {
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
    case '/find':
      await cmdFind(args.join(' '));
      break;
    case '/backup':
      await cmdBackup();
      break;
    case '/backups':
      await cmdBackups();
      break;
    case '/restore':
      await cmdRestore(args[0], args[1]);
      break;
    case '/broadcast':
      await cmdBroadcast(text.slice(cmdRaw.length).trim());
      break;
    default:
      await tgSend('Perintah gak dikenal. Ketik /help buat lihat daftar perintah.');
  }
}

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

  // PENTING: proses SAMPAI SELESAI dulu (await), baru kirim response di paling
  // akhir. Lihat catatan panjang di atas kenapa ini gak boleh dibalik lagi.
  try {
    await processUpdate(req.body);
  } catch (e) {
    console.error('Webhook error:', e);
    try { await tgSend(`Error: ${e.message}`); } catch {}
  }

  return res.status(200).json({ ok: true });
}
