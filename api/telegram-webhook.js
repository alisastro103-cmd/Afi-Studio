// api/telegram-webhook.js
// Webhook Telegram buat kontrol balik ke database & repo Afi Studio langsung dari chat.
// Beda sama bot yang udah ada (yang cuma KIRIM notifikasi satu arah) — endpoint ini
// yang NERIMA pesan dari Telegram dan menjalankan perintah, LEWAT KETIKAN atau LEWAT
// TOMBOL MENU (inline keyboard).
//
// ================= SETUP (WAJIB dibaca sebelum dipakai) =================
// 1. Environment Variables di Vercel:
//      TELEGRAM_WEBHOOK_SECRET    -> string acak bebas, buat validasi request bener2
//                                     dari Telegram (bukan orang iseng nembak URL).
//      GITHUB_TOKEN               -> Personal Access Token GitHub (scope: repo / contents:write)
//      GITHUB_REPO                -> "username/Afi-Studio" (punya kamu)
//      GITHUB_BRANCH               -> "main" (atau branch default kamu)
//    (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, UPSTASH_*, ADMIN_TOKEN udah ada, dipakai ulang.)
//
// 2. Daftarin webhook ke Telegram (jalankan sekali aja lewat browser/curl, ganti placeholder):
//      https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://afi-studio.vercel.app/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
//
// 3. Chat ke bot kamu sendiri, ketik /menu (atau /help) buat mulai.
//
// ================= MENU & PERCAKAPAN BERTAHAP =================
// Ketik /menu buat munculin tombol-tombol, jadi gak perlu ngetik command manual lagi.
// Beberapa aksi (misal ganti thumbnail utama) butuh info tambahan — bot bakal NANYA
// dulu ("mau pakai link atau upload file?"), nyimpen "state" percakapan itu di Redis
// per chat (key afi-studio:botstate:<chatId>, expire otomatis 10 menit). Selama state
// itu aktif, pesan BEBAS (bukan command) yang kamu kirim dianggap JAWABAN dari
// pertanyaan bot, bukan command baru. Kalau jawabannya gak sesuai yang diminta
// (misal diminta link tapi yang dikirim bukan http/https, atau diminta foto tapi
// yang dikirim teks), bot re-ask lagi, gak langsung dianggap gagal. Ketik /batal
// kapan aja buat keluar dari state itu.
//
// ================= KEAMANAN =================
// - Setiap request divalidasi header "X-Telegram-Bot-Api-Secret-Token" HARUS cocok
//   dengan TELEGRAM_WEBHOOK_SECRET. Kalau gak cocok, request langsung ditolak.
// - Setiap PESAN/TOMBOL divalidasi chat_id pengirim HARUS sama dengan TELEGRAM_CHAT_ID
//   (chat admin yang sudah ada). Orang lain yang chat/pencet tombol bot ini diabaikan.
// - Aksi yang menghapus/menimpa data besar (restore, hapus pending/survey) SELALU
//   lewat langkah konfirmasi tombol [Ya]/[Batal] dulu sebelum benar-benar dieksekusi.
//
// ================= PENTING: KENAPA RESPONSE DIKIRIM DI PALING AKHIR =================
// Semua proses di-`await` SAMPAI SELESAI dulu, baru response 200 ke Telegram dikirim
// di paling akhir handler. Kalau dibalik (response duluan, proses di belakang),
// Vercel/AWS Lambda kadang membekukan container sebelum proses belakangnya kelar —
// efeknya bot kelihatan "diem", baru kebales pas ada invocation berikutnya yang
// "membangunkan" proses lama. JANGAN dibalik lagi.

import { Redis } from '@upstash/redis';
import dns from 'dns/promises';
import net from 'net';
import { AsyncLocalStorage } from 'node:async_hooks';
import sharp from 'sharp';

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
const MODELS_KEY = 'afi-studio:data:models';
const MENU_REGISTERED_KEY = 'afi-studio:botmenu:registered:v3'; // v3 = broadcast dihapus + registrasi jalan tiap update (lihat ensureBotMenuRegistered)
const ADMIN_LIST_KEY = 'afi-studio:data:admins'; // daftar admin TAMBAHAN (di luar owner/TELEGRAM_CHAT_ID)
const INVITE_TTL_SEC = 900; // kode undangan admin berlaku 15 menit
const STATE_TTL_SEC = 600; // state percakapan basi otomatis abis 10 menit

// Ambang batas fitur /cleanup — data lebih tua dari ini dianggap kandidat basi.
const CLEANUP_PENDING_STALE_DAYS = 30; // pendaftaran pending yang nganggur >30 hari
const CLEANUP_SURVEY_STALE_DAYS = 60; // survey yang kadaluarsa >60 hari lalu
const CLEANUP_BACKUP_KEEP = 10; // backup di luar 10 terbaru dianggap kandidat basi

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

// ================= HELPER: KONTEKS PER-REQUEST (buat multi-admin) =================
// Dulu (1 admin doang) semua balasan bot aman di-hardcode ke CHAT_ID (owner),
// karena yang bisa chat cuma dia. Sekarang ada admin tambahan (via undangan),
// balasan HARUS nyampe ke chat yang lagi ngobrol, bukan selalu ke owner.
//
// Dipakai AsyncLocalStorage (bukan variabel module-level biasa) SENGAJA —
// kalau pakai variabel biasa dan Vercel kebetulan lagi eksekusi 2 invocation
// bersamaan di container yang sama (mode "fluid compute"), variabel itu bisa
// ketimpa request lain di tengah proses async, balasan bisa nyasar ke chat
// yang salah. AsyncLocalStorage didesain khusus buat nyimpen konteks per
// request yang aman dipakai bareng kode async, jadi gak ada risiko ketuker.
const requestContext = new AsyncLocalStorage();

function isOwner(chatId) {
  return String(chatId) === String(CHAT_ID);
}

async function isAuthorizedAdmin(chatId) {
  if (isOwner(chatId)) return true;
  if (!redis) return false;
  try {
    const list = (await redis.get(ADMIN_LIST_KEY)) || [];
    const entry = (Array.isArray(list) ? list : []).find(a => String(a.chatId) === String(chatId));
    if (!entry) return false;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() < Date.now()) return false; // masa aktif abis
    return true;
  } catch {
    return false;
  }
}



function stateKey(chatId) {
  return `afi-studio:botstate:${chatId}`;
}

async function getState(chatId) {
  if (!redis) return null;
  try { return await redis.get(stateKey(chatId)); } catch { return null; }
}

async function setState(chatId, state) {
  if (!redis) return;
  try { await redis.set(stateKey(chatId), state, { ex: STATE_TTL_SEC }); } catch {}
}

async function clearState(chatId) {
  if (!redis) return;
  try { await redis.del(stateKey(chatId)); } catch {}
}

// Escape karakter spesial HTML dari data DINAMIS (nama model, judul survey,
// kata kunci pencarian, pesan error dari API luar, dst) sebelum ditempel ke
// pesan yang dikirim pakai parse_mode HTML. Tanpa ini, kalau ada data yang
// kebetulan mengandung &, <, atau > (contoh nama model "Meja & Kursi"),
// Telegram bakal nolak parse pesannya ("can't parse entities") dan
// notifikasinya GAGAL terkirim total — bukan cuma salah tampil.
function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
  const ctx = requestContext.getStore();
  const target = (ctx && ctx.chatId) || CHAT_ID;
  return tgSendTo(target, text, opts);
}

// Buat menu bertombol: coba EDIT pesan yang lagi ditampilin (kalau dipicu dari tombol,
// biar chat gak numpuk pesan baru tiap navigasi). Kalau gagal/gak ada messageId, kirim
// pesan baru aja.
async function tgSendOrEdit(chatId, messageId, text, replyMarkup) {
  if (messageId) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        }),
      });
      const data = await resp.json();
      if (data.ok) return data;
    } catch {
      // fallback ke bawah: kirim pesan baru
    }
  }
  return tgSendTo(chatId, text, { reply_markup: replyMarkup });
}

async function tgAnswerCallback(callbackId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text, show_alert: false }),
    });
  } catch {}
}

async function tgGetFileUrl(fileId) {
  const metaResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const meta = await metaResp.json();
  if (!meta.ok) throw new Error('Gagal ambil info file dari Telegram.');
  return `https://api.telegram.org/file/bot${BOT_TOKEN}/${meta.result.file_path}`;
}

// Daftarin SEMUA command bot ke Telegram (biar lengkap muncul pas ketik "/"
// sekali, dengan deskripsi singkat tiap command) — cukup sekali aja per versi
// daftar ini, ditandain lewat flag di Redis biar gak keulang tiap /menu.
// Kalau nambah/ubah command lagi ke depannya, BUMP versi di MENU_REGISTERED_KEY
// (v1 -> v2 -> dst) biar Telegram nge-refresh daftarnya, karena flag lama
// gak otomatis basi sendiri.
async function ensureBotMenuRegistered() {
  if (!redis) return;
  try {
    const already = await redis.get(MENU_REGISTERED_KEY);
    if (already) return;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'menu', description: 'Buka menu utama (tombol)' },
          { command: 'help', description: 'Daftar semua perintah' },
          { command: 'status', description: 'Ringkasan jumlah data' },
          { command: 'pending', description: 'Pendaftaran model belum diproses' },
          { command: 'delpending', description: 'Hapus 1 pending — format: id' },
          { command: 'clearpending', description: 'Hapus SEMUA pending' },
          { command: 'surveys', description: 'Daftar survey' },
          { command: 'delsurvey', description: 'Hapus 1 survey — format: id' },
          { command: 'setsurveythumb', description: 'Ganti thumbnail survey — format: id url' },
          { command: 'setthumb', description: 'Ganti thumbnail situs (kirim sbg foto)' },
          { command: 'find', description: 'Cari model/pending/survey — format: kata kunci' },
          { command: 'backup', description: 'Simpan snapshot data ke GitHub' },
          { command: 'backups', description: 'Lihat daftar backup tersimpan' },
          { command: 'restore', description: 'Timpa data pakai backup — format: file KONFIRMASI' },
          { command: 'cleanup', description: 'Scan & bersihin data lama (preview dulu)' },
          { command: 'admins', description: 'Lihat daftar admin' },
          { command: 'addadmin', description: '[Owner] Bikin admin baru — format: nama [durasi]' },
          { command: 'join', description: 'Daftar jadi admin — format: kode undangan' },
          { command: 'batal', description: 'Batalin proses tanya-jawab yang lagi jalan' },
        ],
      }),
    });
    await redis.set(MENU_REGISTERED_KEY, '1');
  } catch (e) {
    console.error('Gagal daftar menu bot:', e.message);
  }
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

// ================= HELPER: CEGAH SSRF =================
// Dipakai sebelum server nge-fetch URL yang DIKETIK USER (bukan link dari
// Telegram sendiri) — misal pas ganti thumbnail lewat link. Tanpa ini, orang
// (atau akun admin yang kebobolan) bisa nyuruh server nge-fetch alamat
// internal (169.254.169.254 buat metadata cloud, 127.0.0.1, IP LAN, dst).
// Catatan: ini best-effort (cek IP hasil resolve DNS saat ini), bukan proteksi
// 100% terhadap DNS-rebinding tingkat lanjut — tapi cukup buat nutup celah
// paling umum, dan fitur ini cuma bisa dipicu admin yang udah lolos validasi
// chat_id + webhook secret, jadi risikonya udah rendah dari awal.
function isPrivateOrReservedIp(ip) {
  if (net.isIPv6(ip)) {
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true; // format aneh -> tolak aja
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local, termasuk metadata cloud
  if (a === 0) return true;
  return false;
}

async function assertSafeExternalUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('URL gak valid.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('URL harus http:// atau https://');
  }
  const hostname = parsed.hostname;
  if (hostname === 'localhost') throw new Error('URL nunjuk ke localhost, gak diizinkan.');

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Gagal resolve domain dari URL itu.');
  }
  if (!addresses.length || addresses.some(a => isPrivateOrReservedIp(a.address))) {
    throw new Error('URL nunjuk ke alamat internal/private, gak diizinkan.');
  }
}

async function githubDeleteFile(path, message) {
  const meta = await githubGetFileMeta(path); // butuh sha buat hapus
  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, sha: meta.sha, branch: GITHUB_BRANCH }),
    }
  );
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Gagal hapus ${path} dari GitHub (status ${resp.status}): ${errBody.slice(0, 200)}`);
  }
  return resp.json();
}

function requireGithub() {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new Error('Fitur ini butuh GITHUB_TOKEN dan GITHUB_REPO di-set dulu di Environment Variables Vercel.');
  }
}

// ================= KEYBOARD (TOMBOL) =================

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📊 Status', callback_data: 'menu:status' }, { text: '🔍 Cari', callback_data: 'menu:find' }],
      [{ text: '⏳ Pending Model', callback_data: 'menu:pending' }, { text: '📋 Survey', callback_data: 'menu:surveys' }],
      [{ text: '🖼️ Thumbnail', callback_data: 'menu:thumb' }, { text: '💾 Backup', callback_data: 'menu:backup' }],
      [{ text: '🧹 Cleanup', callback_data: 'cleanup:scan' }],
      [{ text: '👑 Admin', callback_data: 'menu:admins' }],
    ],
  };
}

function thumbMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'Thumbnail Utama (situs)', callback_data: 'thumb:main' }],
      [{ text: 'Thumbnail Survey', callback_data: 'thumb:survey' }],
      [{ text: '⬅️ Kembali', callback_data: 'menu:main' }],
    ],
  };
}

function backupMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '💾 Buat Backup Baru', callback_data: 'backup:create' }],
      [{ text: '📄 Lihat Daftar Backup', callback_data: 'backup:list' }],
      [{ text: '♻️ Restore dari Backup', callback_data: 'backup:restore' }],
      [{ text: '⬅️ Kembali', callback_data: 'menu:main' }],
    ],
  };
}

// ================= HANDLERS PER PERINTAH =================

async function cmdHelp() {
  await tgSend(
    '<b>Perintah Afi Studio Bot</b>\n' +
    'Ketik /menu buat pakai tombol — gak perlu ngetik manual.\n\n' +

    '<b>Data</b>\n' +
    '/status — ringkasan jumlah data\n' +
    '/pending — pendaftaran model belum diproses\n' +
    '/delpending id — hapus 1 pending\n' +
    '/clearpending — hapus semua pending\n' +
    '/surveys — daftar survey\n' +
    '/delsurvey id — hapus 1 survey\n' +
    '/find kata — cari model/pending/survey\n\n' +

    '<b>Thumbnail</b>\n' +
    '/setsurveythumb id url — ganti thumbnail survey\n' +
    'Kirim foto + caption /setthumb — ganti thumbnail situs\n\n' +

    '<b>Backup</b>\n' +
    '/backup — simpan data ke GitHub\n' +
    '/backups — lihat daftar backup\n' +
    '/restore file KONFIRMASI — timpa data pakai backup\n\n' +

    '<b>Lainnya</b>\n' +
    '/cleanup — bersihin data lama\n' +
    '/admins — daftar admin\n' +
    '/addadmin nama [durasi] — bikin admin baru (khusus owner)\n' +
    '/join kode — daftar jadi admin\n' +
    '/batal — batalin proses yang lagi jalan'
  );
}

async function cmdMenu(chatId, messageId) {
  await ensureBotMenuRegistered();
  await tgSendOrEdit(chatId, messageId, '<b>Menu Afi Studio Bot</b>\n\nPilih salah satu:', mainMenuKeyboard());
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
    text += `• <code>${escHtml(item.id)}</code> — ${escHtml(item.name || '-')} (${escHtml(item.role || '-')})\n  ${new Date(item.submittedAt).toLocaleString('id-ID')}\n`;
  }
  text += '\nHapus: <code>/delpending id</code> (atau pakai /menu)';
  await tgSend(text);
}

async function cmdDelPending(id) {
  if (!id) return tgSend('Format: /delpending id_nya\nLihat id lewat /pending');
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(PENDING_KEY)) || [];
  if (!Array.isArray(list)) return tgSend('Data pending kosong/rusak.');
  const filtered = list.filter(item => item.id !== id);
  if (filtered.length === list.length) return tgSend(`Gak ketemu entri dengan id "${escHtml(id)}".`);
  await redis.set(PENDING_KEY, filtered);
  await tgSend(`Terhapus: <code>${escHtml(id)}</code>. Sisa pending: ${filtered.length}.`);
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
    text += `• <code>${escHtml(s.id)}</code> — ${escHtml(s.title || '(tanpa judul)')} ${expired ? '(kadaluarsa)' : ''}\n`;
  }
  text += '\nHapus: <code>/delsurvey id</code>\nGanti thumbnail: <code>/setsurveythumb id url</code> (atau pakai /menu)';
  await tgSend(text);
}

async function cmdDelSurvey(id) {
  if (!id) return tgSend('Format: /delsurvey id_nya\nLihat id lewat /surveys');
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(SURVEYS_KEY)) || [];
  if (!Array.isArray(list)) return tgSend('Data survey kosong/rusak.');
  const filtered = list.filter(s => s.id !== id);
  if (filtered.length === list.length) return tgSend(`Gak ketemu survey dengan id "${escHtml(id)}".`);
  await redis.set(SURVEYS_KEY, filtered);
  await tgSend(`Survey <code>${escHtml(id)}</code> terhapus. Sisa: ${filtered.length}.`);
}

async function cmdSetSurveyThumb(id, url) {
  if (!id || !url) return tgSend('Format: /setsurveythumb id https://url-gambar');
  if (!/^https?:\/\//i.test(url)) return tgSend('URL harus diawali http:// atau https://');
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(SURVEYS_KEY)) || [];
  if (!Array.isArray(list)) return tgSend('Data survey kosong/rusak.');
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return tgSend(`Gak ketemu survey dengan id "${escHtml(id)}".`);
  list[idx] = { ...list[idx], thumbnail: url };
  await redis.set(SURVEYS_KEY, list);
  await tgSend(`Thumbnail survey <code>${id}</code> diganti ke:\n${url}`);
}

// --- Convert thumbnail pendaftaran model ke WebP/AVIF, on-demand ---
// Dipicu tombol yang nempel di pesan dokumen thumbnail (dikirim apa adanya
// oleh model-submit.js). File ASLI diambil ulang dari Telegram (bukan dari
// hasil konversi sebelumnya — biar gak ke-lossy dua kali), dikonversi,
// dikirim balik sebagai DOKUMEN baru (bukan foto, biar formatnya gak
// ke-compress ulang sama Telegram).
async function tgSendDocument(buffer, filename, caption) {
  const ctx = requestContext.getStore();
  const chatId = (ctx && ctx.chatId) || CHAT_ID;
  const blob = new Blob([buffer]);
  const fd = new FormData();
  fd.append('chat_id', chatId);
  fd.append('document', blob, filename);
  if (caption) fd.append('caption', caption);
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: 'POST', body: fd });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.description || 'Gagal kirim dokumen ke Telegram');
  return data;
}

async function cmdConvertPendingThumb(pendingId, format) {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  try {
    const list = (await redis.get(PENDING_KEY)) || [];
    const entry = (Array.isArray(list) ? list : []).find(p => p.id === pendingId);
    if (!entry) return tgSend('Pendaftaran ini udah gak ada di antrian pending (mungkin udah diproses/dihapus).');
    if (!entry.thumb || entry.thumb.type !== 'upload' || !entry.thumb.fileId) {
      return tgSend('Entri ini gak punya file thumbnail ter-upload buat dikonversi (mungkin thumbnail-nya tipe link).');
    }

    await tgSend(`Lagi convert ke ${format.toUpperCase()}, tunggu bentar...`);

    const fileUrl = await tgGetFileUrl(entry.thumb.fileId);
    const imgResp = await fetch(fileUrl);
    if (!imgResp.ok) throw new Error('Gagal download file asli dari Telegram.');
    const original = Buffer.from(await imgResp.arrayBuffer());

    const converted = format === 'avif'
      ? await sharp(original).avif({ quality: 50 }).toBuffer()
      : await sharp(original).webp({ quality: 82 }).toBuffer();

    const baseName = (entry.thumb.filename || entry.name || 'thumbnail').replace(/\.[^./]+$/, '');
    const filename = `${baseName || 'thumbnail'}.${format}`;

    await tgSendDocument(
      converted,
      filename,
      `Thumbnail "${entry.name || pendingId}" — udah dikonversi ke ${format.toUpperCase()}.\nTinggal download & upload ke ibb/postimg.`
    );
  } catch (e) {
    await tgSend(`Gagal convert thumbnail: ${escHtml(e.message)}`);
  }
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
    await githubPutFile('thumbnail.webp', base64, 'chore: update thumbnail via Telegram bot (upload)');
    await tgSend(
      'Thumbnail utama berhasil diganti (commit ke GitHub).\n' +
      'Vercel bakal auto-redeploy — cek lagi dalam ~1-2 menit di link preview WhatsApp/Discord ' +
      '(mungkin perlu di-refresh cache preview-nya).'
    );
  } catch (e) {
    await tgSend(`Gagal ganti thumbnail: ${escHtml(e.message)}`);
  }
}

async function cmdSetThumbFromUrl(url) {
  try {
    requireGithub();
    await assertSafeExternalUrl(url);
    await tgSend('Lagi proses... ambil gambar dari link & commit ke repo.');
    const imgResp = await fetch(url);
    if (!imgResp.ok) throw new Error('Gagal download gambar dari link itu.');
    const buffer = Buffer.from(await imgResp.arrayBuffer());
    const base64 = buffer.toString('base64');
    await githubPutFile('thumbnail.webp', base64, 'chore: update thumbnail via Telegram bot (link)');
    await tgSend(
      'Thumbnail utama berhasil diganti (commit ke GitHub).\n' +
      'Vercel bakal auto-redeploy — cek lagi dalam ~1-2 menit di link preview WhatsApp/Discord.'
    );
  } catch (e) {
    await tgSend(`Gagal ganti thumbnail: ${escHtml(e.message)}`);
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
    if ((m.name || '').toLowerCase().includes(q)) results.push(`📦 Model: ${escHtml(m.name)}`);
  });
  (Array.isArray(pending) ? pending : []).forEach(p => {
    if ((p.name || '').toLowerCase().includes(q)) results.push(`⏳ Pending: ${escHtml(p.name)} (<code>${escHtml(p.id)}</code>)`);
  });
  (Array.isArray(surveys) ? surveys : []).forEach(s => {
    if ((s.title || '').toLowerCase().includes(q)) results.push(`📊 Survey: ${escHtml(s.title)} (<code>${escHtml(s.id)}</code>)`);
  });

  if (!results.length) return tgSend(`Gak ada hasil buat "${escHtml(keyword)}".`);
  const shown = results.slice(0, 20);
  const text = `<b>Hasil pencarian "${escHtml(keyword)}"</b> (${results.length}${results.length > 20 ? ', ditampilin 20' : ''})\n\n${shown.join('\n')}`;
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
      `Buat restore nanti kalau perlu:\n<code>/restore ${filename} KONFIRMASI</code>\n(atau lewat /menu → Backup → Restore)`
    );
  } catch (e) {
    await tgSend(`Gagal backup: ${escHtml(e.message)}`);
  }
}

async function listBackupFiles() {
  requireGithub();
  const files = await githubListDir('backups');
  return files
    .filter(f => f.type === 'file' && f.name.endsWith('.json'))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, 10);
}

async function cmdBackups() {
  try {
    const sorted = await listBackupFiles();
    if (!sorted.length) return tgSend('Belum ada backup tersimpan. Buat dulu pakai /backup');
    let text = `<b>Backup Tersedia</b> (10 terbaru)\n\n`;
    for (const f of sorted) text += `• <code>${f.name}</code>\n`;
    text += '\nRestore: <code>/restore nama_file.json KONFIRMASI</code>';
    await tgSend(text);
  } catch (e) {
    await tgSend(`Gagal ambil daftar backup: ${escHtml(e.message)}`);
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
    await tgSend(`Gagal restore: ${escHtml(e.message)}`);
  }
}


// --- Cleanup data basi ---
// Alur SELALU dua tahap: scan (preview, gak ubah data apapun) -> baru eksekusi
// kalau ditekan konfirmasi. Hasil scan disimpan di state (bukan di-scan ulang
// pas konfirmasi) supaya yang kehapus PERSIS yang ditampilin di preview,
// gak ada data baru yang "ikut kehapus" gara-gara nyangkut kondisi berubah
// di antara waktu scan dan waktu konfirmasi.

async function cmdCleanupScan(chatId, messageId) {
  if (!redis) return tgSendOrEdit(chatId, messageId, 'Redis belum dikonfigurasi di server.', mainMenuKeyboard());

  await tgSendOrEdit(chatId, messageId, 'Lagi scan data lama, tunggu bentar...');

  const now = Date.now();

  const pending = (await redis.get(PENDING_KEY).catch(() => [])) || [];
  const stalePending = (Array.isArray(pending) ? pending : []).filter(p => {
    const t = new Date(p.submittedAt).getTime();
    return !Number.isNaN(t) && (now - t) > CLEANUP_PENDING_STALE_DAYS * 86400000;
  });

  const surveys = (await redis.get(SURVEYS_KEY).catch(() => [])) || [];
  const staleSurveys = (Array.isArray(surveys) ? surveys : []).filter(s => {
    if (!s.expiresAt) return false;
    const t = new Date(s.expiresAt).getTime();
    return !Number.isNaN(t) && (now - t) > CLEANUP_SURVEY_STALE_DAYS * 86400000;
  });

  let extraBackups = [];
  if (GITHUB_TOKEN && GITHUB_REPO) {
    try {
      const all = await githubListDir('backups');
      const sorted = all
        .filter(f => f.type === 'file' && f.name.endsWith('.json'))
        .sort((a, b) => b.name.localeCompare(a.name)); // terbaru duluan
      extraBackups = sorted.slice(CLEANUP_BACKUP_KEEP); // sisanya di luar N terbaru = kandidat basi
    } catch {
      // GitHub gak bisa diakses -> skip bagian backup, jangan gagalin scan yang lain
    }
  }

  const totalFound = stalePending.length + staleSurveys.length + extraBackups.length;
  if (!totalFound) {
    return tgSendOrEdit(chatId, messageId, '✅ Gak ada data basi yang perlu dibersihin sekarang. Semuanya masih relevan.', mainMenuKeyboard());
  }

  // Simpan HASIL scan ini ke state, biar tombol konfirmasi eksekusi persis
  // data yang ditampilin, bukan scan ulang.
  await setState(chatId, {
    action: 'confirm_cleanup',
    pendingIds: stalePending.map(p => p.id),
    surveyIds: staleSurveys.map(s => s.id),
    backupFiles: extraBackups.map(f => f.name),
  });

  let text = `<b>Hasil Scan Cleanup</b>\n\n`;
  if (stalePending.length) {
    text += `⏳ <b>${stalePending.length} pendaftaran pending</b> (nganggur &gt;${CLEANUP_PENDING_STALE_DAYS} hari):\n`;
    text += stalePending.slice(0, 5).map(p => `  • ${escHtml(p.name || p.id)}`).join('\n');
    if (stalePending.length > 5) text += `\n  ...dan ${stalePending.length - 5} lagi`;
    text += '\n\n';
  }
  if (staleSurveys.length) {
    text += `📋 <b>${staleSurveys.length} survey</b> (kadaluarsa &gt;${CLEANUP_SURVEY_STALE_DAYS} hari):\n`;
    text += staleSurveys.slice(0, 5).map(s => `  • ${escHtml(s.title || s.id)}`).join('\n');
    if (staleSurveys.length > 5) text += `\n  ...dan ${staleSurveys.length - 5} lagi`;
    text += '\n\n';
  }
  if (extraBackups.length) {
    text += `💾 <b>${extraBackups.length} backup lama</b> (di luar ${CLEANUP_BACKUP_KEEP} terbaru):\n`;
    text += extraBackups.slice(0, 5).map(f => `  • ${f.name}`).join('\n');
    if (extraBackups.length > 5) text += `\n  ...dan ${extraBackups.length - 5} lagi`;
    text += '\n\n';
  }
  text += `Total <b>${totalFound}</b> item bakal dihapus permanen. Lanjut?`;

  await tgSendOrEdit(chatId, messageId, text, {
    inline_keyboard: [
      [{ text: '✅ Ya, hapus semua ini', callback_data: 'cleanup:confirm' }, { text: '❌ Batal', callback_data: 'cleanup:cancel' }],
      [{ text: '⬅️ Kembali', callback_data: 'menu:main' }],
    ],
  });
}

async function cmdCleanupExecute(chatId) {
  const state = await getState(chatId);
  await clearState(chatId);

  if (!state || state.action !== 'confirm_cleanup') {
    await tgSend('Gak ada hasil scan yang lagi nunggu konfirmasi (mungkin udah basi/10 menit lewat). Coba /cleanup lagi.');
    return;
  }

  let removedPending = 0;
  let removedSurveys = 0;
  let removedBackups = 0;
  const errors = [];

  if (redis && state.pendingIds && state.pendingIds.length) {
    try {
      const list = (await redis.get(PENDING_KEY)) || [];
      const arr = Array.isArray(list) ? list : [];
      const filtered = arr.filter(p => !state.pendingIds.includes(p.id));
      removedPending = arr.length - filtered.length;
      await redis.set(PENDING_KEY, filtered);
    } catch (e) {
      errors.push(`pending: ${escHtml(e.message)}`);
    }
  }

  if (redis && state.surveyIds && state.surveyIds.length) {
    try {
      const list = (await redis.get(SURVEYS_KEY)) || [];
      const arr = Array.isArray(list) ? list : [];
      const filtered = arr.filter(s => !state.surveyIds.includes(s.id));
      removedSurveys = arr.length - filtered.length;
      await redis.set(SURVEYS_KEY, filtered);
    } catch (e) {
      errors.push(`survey: ${escHtml(e.message)}`);
    }
  }

  if (state.backupFiles && state.backupFiles.length) {
    for (const filename of state.backupFiles) {
      try {
        await githubDeleteFile(`backups/${filename}`, `chore: cleanup backup lama via Telegram bot (${filename})`);
        removedBackups++;
      } catch (e) {
        errors.push(`backup ${escHtml(filename)}: ${escHtml(e.message)}`);
      }
    }
  }

  let text = `<b>Cleanup selesai</b> 🧹\n\n`;
  text += `⏳ Pending dihapus: ${removedPending}\n`;
  text += `📋 Survey dihapus: ${removedSurveys}\n`;
  text += `💾 Backup dihapus: ${removedBackups}\n`;
  if (errors.length) {
    text += `\n⚠️ Ada yang gagal:\n${errors.slice(0, 5).map(e => `• ${e}`).join('\n')}`;
  }
  await tgSend(text);
}

// --- Multi-admin: undangan berkode + masa aktif (expired otomatis) ---
// Cuma OWNER (chat_id di TELEGRAM_CHAT_ID) yang bisa bikin/hapus admin.
// Admin tambahan bisa permanent atau punya masa aktif; begitu lewat
// expiresAt, otomatis kehilang akses (dicek tiap kali dia pakai command),
// TANPA perlu owner hapus manual — tapi datanya tetap ada di daftar sampai
// dihapus manual (atau nanti ketangkep /cleanup di update berikutnya).

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa karakter ambigu (I,O,0,1)
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Parse format durasi simpel: "7d" (hari) atau "24h" (jam).
// return: undefined = format salah, null = permanent (gak ada input), string ISO = expiresAt
function parseDurationToExpiry(str) {
  if (!str) return null;
  const m = /^(\d+)(d|h)$/i.exec(str.trim());
  if (!m) return undefined;
  const num = parseInt(m[1], 10);
  const ms = m[2].toLowerCase() === 'd' ? num * 86400000 : num * 3600000;
  return new Date(Date.now() + ms).toISOString();
}

async function cmdAddAdmin(name, durationStr) {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  if (!name) return tgSend('Format: /addadmin nama_admin [durasi]\nContoh: <code>/addadmin Rian 7d</code> (7 hari) atau <code>/addadmin Rian 24h</code> (24 jam).\nTanpa durasi = permanent.');

  const expiresAt = parseDurationToExpiry(durationStr);
  if (expiresAt === undefined) {
    return tgSend('Format durasi salah. Contoh valid: <code>7d</code> (7 hari) atau <code>24h</code> (24 jam). Kosongin kalau mau permanent.');
  }

  const code = generateInviteCode();
  try {
    await redis.set(`afi-studio:admininvite:${code}`, { name, expiresAt, createdAt: new Date().toISOString() }, { ex: INVITE_TTL_SEC });
  } catch (e) {
    return tgSend(`Gagal bikin kode undangan: ${escHtml(e.message)}`);
  }

  await tgSend(
    `Kode undangan buat <b>${escHtml(name)}</b>: <code>${code}</code>\n` +
    `Berlaku 15 menit sebelum hangus.\n` +
    `${expiresAt ? `Akses admin-nya expired otomatis: ${new Date(expiresAt).toLocaleString('id-ID')}.` : 'Akses admin-nya permanent (gak ada batas waktu).'}\n\n` +
    `Suruh dia buka bot ini, terus kirim:\n<code>/join ${code}</code>`
  );
}

async function cmdJoin(chatId, codeRaw) {
  if (!codeRaw) return tgSend('Format: /join KODE_UNDANGAN\n(minta kode undangannya ke admin Afi Studio dulu)');
  if (!redis) return tgSend('Server belum siap, coba lagi nanti.');

  const already = await isAuthorizedAdmin(chatId);
  if (already) return tgSend('Kamu udah jadi admin di sini. Ketik /menu buat mulai.');

  const code = codeRaw.trim().toUpperCase();
  const inviteKey = `afi-studio:admininvite:${code}`;
  let invite;
  try {
    invite = await redis.get(inviteKey);
  } catch {
    return tgSend('Gagal cek kode undangan, coba lagi.');
  }
  if (!invite) return tgSend('Kode undangan gak valid atau udah kadaluarsa (berlaku 15 menit). Minta kode baru.');

  try { await redis.del(inviteKey); } catch {} // sekali pakai

  try {
    const list = (await redis.get(ADMIN_LIST_KEY)) || [];
    const arr = Array.isArray(list) ? list : [];
    arr.push({
      chatId: String(chatId),
      name: invite.name || 'Admin',
      addedAt: new Date().toISOString(),
      expiresAt: invite.expiresAt || null,
    });
    await redis.set(ADMIN_LIST_KEY, arr);
  } catch (e) {
    return tgSend(`Kode valid, tapi gagal simpen ke daftar admin: ${escHtml(e.message)}. Coba lagi.`);
  }

  await tgSend(`Selamat datang, <b>${escHtml(invite.name || 'Admin')}</b>! Kamu sekarang admin Afi Studio bot. Ketik /menu buat mulai.`);

  const expiryNote = invite.expiresAt ? `expired ${new Date(invite.expiresAt).toLocaleString('id-ID')}` : 'permanent';
  try {
    await tgSendTo(CHAT_ID, `✅ Admin baru bergabung: <b>${escHtml(invite.name || 'Admin')}</b> (${expiryNote})`);
  } catch {}
}

async function cmdRemoveAdmin(targetChatId) {
  if (!redis) return tgSend('Redis belum dikonfigurasi di server.');
  const list = (await redis.get(ADMIN_LIST_KEY).catch(() => [])) || [];
  const arr = Array.isArray(list) ? list : [];
  const filtered = arr.filter(a => String(a.chatId) !== String(targetChatId));
  if (filtered.length === arr.length) return tgSend('Admin itu udah gak ada di daftar (mungkin baru aja dihapus).');
  await redis.set(ADMIN_LIST_KEY, filtered);
  await tgSend('Admin berhasil dihapus dari daftar. Akses dia ke bot langsung kecabut.');
}

async function cmdAdminsMenu(chatId, messageId) {
  if (!redis) return tgSendOrEdit(chatId, messageId, 'Redis belum dikonfigurasi di server.', mainMenuKeyboard());
  const list = (await redis.get(ADMIN_LIST_KEY).catch(() => [])) || [];
  const arr = Array.isArray(list) ? list : [];
  const now = Date.now();

  let text = `<b>Daftar Admin</b>\n\n👑 Owner — permanent\n`;
  for (const a of arr) {
    const expired = a.expiresAt && new Date(a.expiresAt).getTime() < now;
    const status = !a.expiresAt ? 'permanent' : expired ? '⛔ expired' : `aktif sampai ${new Date(a.expiresAt).toLocaleDateString('id-ID')}`;
    text += `• ${escHtml(a.name || a.chatId)} — ${status}\n`;
  }
  if (!arr.length) text += '\n(belum ada admin tambahan)';

  const rows = [];
  if (isOwner(chatId)) {
    text += `\n\nTambah admin baru:\n<code>/addadmin nama [7d]</code>`;
    for (const a of arr) {
      rows.push([{ text: `🗑 ${(a.name || a.chatId).slice(0, 40)}`, callback_data: `removeadmin:${a.chatId}` }]);
    }
  }
  rows.push([{ text: '⬅️ Kembali', callback_data: 'menu:main' }]);
  await tgSendOrEdit(chatId, messageId, text, { inline_keyboard: rows });
}

// ================= MENU: LIST DENGAN TOMBOL HAPUS =================

async function sendPendingMenu(chatId, messageId) {
  if (!redis) return tgSendOrEdit(chatId, messageId, 'Redis belum dikonfigurasi di server.', mainMenuKeyboard());
  const list = (await redis.get(PENDING_KEY)) || [];
  if (!Array.isArray(list) || !list.length) {
    return tgSendOrEdit(chatId, messageId, 'Gak ada pendaftaran model yang pending. 🎉', mainMenuKeyboard());
  }
  const top = list.slice(-8).reverse();
  const rows = top.map(item => [{ text: `🗑 ${(item.name || item.id).slice(0, 50)}`, callback_data: `delpending:${item.id}` }]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'menu:main' }]);
  await tgSendOrEdit(chatId, messageId, `<b>Pendaftaran Pending</b> (${list.length} total, 8 terbaru)\nTap buat hapus:`, { inline_keyboard: rows });
}

async function sendSurveysMenu(chatId, messageId) {
  if (!redis) return tgSendOrEdit(chatId, messageId, 'Redis belum dikonfigurasi di server.', mainMenuKeyboard());
  const list = (await redis.get(SURVEYS_KEY)) || [];
  if (!Array.isArray(list) || !list.length) {
    return tgSendOrEdit(chatId, messageId, 'Belum ada survey.', mainMenuKeyboard());
  }
  const rows = list.slice(0, 8).map(s => [{ text: `🗑 ${(s.title || s.id).slice(0, 50)}`, callback_data: `delsurvey:${s.id}` }]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'menu:main' }]);
  await tgSendOrEdit(chatId, messageId, `<b>Daftar Survey</b> (${list.length})\nTap buat hapus:`, { inline_keyboard: rows });
}

async function sendBackupPickList(chatId, messageId, forRestore) {
  try {
    const sorted = await listBackupFiles();
    if (!sorted.length) return tgSendOrEdit(chatId, messageId, 'Belum ada backup. Bikin dulu lewat tombol "Buat Backup Baru".', backupMenuKeyboard());

    if (forRestore) {
      const rows = sorted.map(f => [{ text: f.name, callback_data: `restore_pick:${f.name}` }]);
      rows.push([{ text: '⬅️ Kembali', callback_data: 'menu:backup' }]);
      await tgSendOrEdit(chatId, messageId, 'Pilih backup yang mau di-restore:', { inline_keyboard: rows });
    } else {
      const text = `<b>Backup Tersedia</b> (10 terbaru)\n\n${sorted.map(f => `• <code>${f.name}</code>`).join('\n')}`;
      await tgSendOrEdit(chatId, messageId, text, backupMenuKeyboard());
    }
  } catch (e) {
    await tgSendOrEdit(chatId, messageId, `Gagal ambil daftar backup: ${escHtml(e.message)}`, backupMenuKeyboard());
  }
}

// ================= HANDLER: BALASAN BEBAS SAAT ADA STATE AKTIF =================
// Ini yang bikin bot "nanya lagi kalau jawabannya kurang jelas" — tiap cabang HANYA
// clearState() kalau jawabannya udah valid dan diproses; kalau enggak, state
// dibiarin aktif terus supaya pesan berikutnya masih dianggap jawaban buat
// pertanyaan yang sama.

async function handleStateReply(chatId, message, state) {
  const text = (message.text || '').trim();

  if (state.action === 'awaiting_thumb_link') {
    if (!/^https?:\/\//i.test(text)) {
      await tgSend('Link-nya kurang valid nih, harus diawali http:// atau https://. Coba kirim lagi, atau ketik /batal buat berhenti.');
      return; // state tetap aktif, nanya lagi
    }
    await clearState(chatId);
    if (state.target === 'main') {
      await cmdSetThumbFromUrl(text);
    } else if (state.target === 'survey' && state.surveyId) {
      await cmdSetSurveyThumb(state.surveyId, text);
    }
    return;
  }

  if (state.action === 'awaiting_thumb_photo') {
    // Kalau nyampe sini berarti yang dikirim BUKAN foto (foto ditangani terpisah
    // sebelum fungsi ini dipanggil).
    await tgSend('Itu bukan foto ya. Kirim FOTO-nya langsung (bukan sebagai dokumen/file, bukan teks), atau ketik /batal buat berhenti.');
    return; // state tetap aktif
  }

  if (state.action === 'awaiting_find_keyword') {
    if (!text) {
      await tgSend('Kata kuncinya kosong, coba ketik lagi, atau /batal buat berhenti.');
      return;
    }
    await clearState(chatId);
    await cmdFind(text);
    return;
  }

  // State gak dikenal (harusnya gak kejadian) -> bersihin biar gak nyangkut
  await clearState(chatId);
}

// ================= HANDLER: TOMBOL (callback_query) =================

async function processCallback(cq) {
  const chatId = cq.message && cq.message.chat && cq.message.chat.id;
  const messageId = cq.message && cq.message.message_id;
  const data = cq.data || '';

  if (!chatId || !(await isAuthorizedAdmin(chatId))) {
    await tgAnswerCallback(cq.id, 'Bukan buat kamu.');
    return;
  }

  await tgAnswerCallback(cq.id); // hilangin loading spinner di tombolnya

  if (data === 'menu:main') { await clearState(chatId); return cmdMenu(chatId, messageId); }
  if (data === 'menu:status') return cmdStatus();
  if (data === 'menu:find') {
    await setState(chatId, { action: 'awaiting_find_keyword' });
    return tgSendOrEdit(chatId, messageId, 'Ketik kata kunci yang mau dicari:');
  }
  if (data === 'menu:pending') return sendPendingMenu(chatId, messageId);
  if (data === 'menu:surveys') return sendSurveysMenu(chatId, messageId);
  if (data === 'menu:thumb') return tgSendOrEdit(chatId, messageId, 'Mau ganti thumbnail yang mana?', thumbMenuKeyboard());
  if (data === 'menu:backup') return tgSendOrEdit(chatId, messageId, 'Menu backup &amp; restore:', backupMenuKeyboard());

  if (data === 'thumb:main') {
    try {
      requireGithub();
    } catch (e) {
      return tgSendOrEdit(chatId, messageId, e.message, thumbMenuKeyboard());
    }
    return tgSendOrEdit(chatId, messageId, 'Thumbnail utama situs mau diganti pakai apa?', {
      inline_keyboard: [
        [{ text: '🔗 Link gambar', callback_data: 'thumbmain:link' }, { text: '📤 Upload foto', callback_data: 'thumbmain:file' }],
        [{ text: '⬅️ Kembali', callback_data: 'menu:thumb' }],
      ],
    });
  }
  if (data === 'thumbmain:link') {
    await setState(chatId, { action: 'awaiting_thumb_link', target: 'main' });
    return tgSendOrEdit(chatId, messageId, 'Oke, kirim link gambar-nya (harus diawali http:// atau https://).');
  }
  if (data === 'thumbmain:file') {
    await setState(chatId, { action: 'awaiting_thumb_photo', target: 'main' });
    return tgSendOrEdit(chatId, messageId, 'Oke, kirim FOTO-nya langsung ya (bukan dikirim sebagai dokumen/file).');
  }
  if (data === 'thumb:survey') {
    if (!redis) return tgSendOrEdit(chatId, messageId, 'Redis belum dikonfigurasi.', thumbMenuKeyboard());
    const surveys = (await redis.get(SURVEYS_KEY).catch(() => [])) || [];
    const active = (Array.isArray(surveys) ? surveys : []).filter(s => !s.expiresAt || new Date(s.expiresAt) > new Date());
    if (!active.length) return tgSendOrEdit(chatId, messageId, 'Belum ada survey aktif.', thumbMenuKeyboard());
    const rows = active.slice(0, 10).map(s => [{ text: (s.title || s.id).slice(0, 50), callback_data: `survthumb:${s.id}` }]);
    rows.push([{ text: '⬅️ Kembali', callback_data: 'menu:thumb' }]);
    return tgSendOrEdit(chatId, messageId, 'Survey mana yang mau diganti thumbnail-nya?', { inline_keyboard: rows });
  }
  if (data.startsWith('survthumb:')) {
    const surveyId = data.slice('survthumb:'.length);
    await setState(chatId, { action: 'awaiting_thumb_link', target: 'survey', surveyId });
    return tgSendOrEdit(chatId, messageId, `Oke, kirim link thumbnail buat survey <code>${surveyId}</code> (harus http:// atau https://).`);
  }

  if (data === 'backup:create') { await cmdBackup(); return; }
  if (data === 'backup:list') return sendBackupPickList(chatId, messageId, false);
  if (data === 'backup:restore') return sendBackupPickList(chatId, messageId, true);
  if (data.startsWith('restore_pick:')) {
    const filename = data.slice('restore_pick:'.length);
    return tgSendOrEdit(
      chatId, messageId,
      `⚠️ Yakin mau timpa SEMUA data live pakai backup <code>${filename}</code>? Gak bisa di-undo.`,
      { inline_keyboard: [[{ text: '✅ Ya, timpa', callback_data: `restore_confirm:${filename}` }, { text: '❌ Batal', callback_data: 'menu:backup' }]] }
    );
  }
  if (data.startsWith('restore_confirm:')) {
    const filename = data.slice('restore_confirm:'.length);
    await cmdRestore(filename, 'KONFIRMASI');
    return;
  }

  if (data.startsWith('delpending_confirm:')) {
    const id = data.slice('delpending_confirm:'.length);
    await cmdDelPending(id);
    return;
  }
  if (data.startsWith('delpending:')) {
    const id = data.slice('delpending:'.length);
    return tgSendOrEdit(
      chatId, messageId, `Hapus entri pending <code>${id}</code>?`,
      { inline_keyboard: [[{ text: '✅ Ya, hapus', callback_data: `delpending_confirm:${id}` }, { text: '❌ Batal', callback_data: 'menu:pending' }]] }
    );
  }

  if (data.startsWith('delsurvey_confirm:')) {
    const id = data.slice('delsurvey_confirm:'.length);
    await cmdDelSurvey(id);
    return;
  }
  if (data.startsWith('delsurvey:')) {
    const id = data.slice('delsurvey:'.length);
    return tgSendOrEdit(
      chatId, messageId, `Hapus survey <code>${id}</code>?`,
      { inline_keyboard: [[{ text: '✅ Ya, hapus', callback_data: `delsurvey_confirm:${id}` }, { text: '❌ Batal', callback_data: 'menu:surveys' }]] }
    );
  }

  if (data === 'cleanup:scan') return cmdCleanupScan(chatId, messageId);
  if (data === 'cleanup:confirm') { await cmdCleanupExecute(chatId); return; }
  if (data === 'cleanup:cancel') {
    await clearState(chatId);
    return tgSendOrEdit(chatId, messageId, 'Cleanup dibatalin, gak ada yang dihapus.', mainMenuKeyboard());
  }

  if (data === 'menu:admins') return cmdAdminsMenu(chatId, messageId);
  if (data.startsWith('removeadmin_confirm:')) {
    if (!isOwner(chatId)) { await tgSend('Cuma owner yang bisa hapus admin.'); return; }
    const target = data.slice('removeadmin_confirm:'.length);
    await cmdRemoveAdmin(target);
    return;
  }
  if (data.startsWith('removeadmin:')) {
    if (!isOwner(chatId)) { await tgSend('Cuma owner yang bisa hapus admin.'); return; }
    const target = data.slice('removeadmin:'.length);
    return tgSendOrEdit(
      chatId, messageId, 'Hapus admin ini dari daftar? Akses dia ke bot langsung kecabut.',
      { inline_keyboard: [[{ text: '✅ Ya, hapus', callback_data: `removeadmin_confirm:${target}` }, { text: '❌ Batal', callback_data: 'menu:admins' }]] }
    );
  }

  if (data.startsWith('convertthumb:webp:')) {
    await cmdConvertPendingThumb(data.slice('convertthumb:webp:'.length), 'webp');
    return;
  }
  if (data.startsWith('convertthumb:avif:')) {
    await cmdConvertPendingThumb(data.slice('convertthumb:avif:'.length), 'avif');
    return;
  }

  await tgSend('Tombol gak dikenal (mungkin basi). Coba /menu lagi.');
}

// ================= ROUTER UTAMA =================

async function processUpdate(update) {
  const cq = update && update.callback_query;
  const message = !cq ? (update && update.message) : null;

  const chatId = cq ? (cq.message && cq.message.chat && cq.message.chat.id) : (message && message.chat && message.chat.id);
  if (!chatId) return;

  // Dulu daftar command cuma ke-register pas user ketik /menu — kalau orang
  // pertama kali coba bot pakai command lain duluan (misal /help), daftar
  // command "/" di Telegram gak lengkap sampai dia sempet /menu. Sekarang
  // dicek di SETIAP update (murah kok, cuma baca 1 flag di Redis kalau udah
  // pernah kedaftar — panggilan ke Telegram API cuma kejadian sekali seumur
  // hidup per versi daftar command).
  await ensureBotMenuRegistered();

  // Semua penanganan di bawah ini dijalanin di dalam "konteks" chat ini, biar
  // tgSend() otomatis balas ke chat yang bener (lihat catatan di requestContext).
  await requestContext.run({ chatId }, async () => {
    if (cq) {
      await processCallback(cq);
      return;
    }

    // /join HARUS bisa dipanggil orang yang BELUM jadi admin (itu tujuannya),
    // jadi dicek duluan, sebelum gerbang otorisasi di bawah.
    const rawTextEarly = (message.text || '').trim();
    if (/^\/join(\s|$)/i.test(rawTextEarly)) {
      const codeArg = rawTextEarly.split(/\s+/)[1];
      await cmdJoin(chatId, codeArg);
      return;
    }

    // Cuma layani admin yang udah terdaftar (owner ATAU admin undangan yang
    // masih aktif). Orang lain diabaikan diam-diam, sama kayak sebelumnya.
    if (!(await isAuthorizedAdmin(chatId))) return;

    // Kasus lama: foto dikirim langsung dengan caption /setthumb (tetap didukung,
    // jalan independen dari sistem state, biar kebiasaan lama tetap bisa dipakai).
    if (message.photo && message.caption && message.caption.trim().toLowerCase().startsWith('/setthumb')) {
      await clearState(chatId);
      const largest = message.photo[message.photo.length - 1];
      await cmdSetThumbFromPhoto(largest.file_id);
      return;
    }

    const rawText = rawTextEarly;
    const isCommand = rawText.startsWith('/');

    // ---- Kalau BUKAN command, cek dulu apa lagi ada state percakapan aktif ----
    if (!isCommand) {
      const state = await getState(chatId);
      if (state) {
        if (message.photo && state.action === 'awaiting_thumb_photo') {
          await clearState(chatId);
          const largest = message.photo[message.photo.length - 1];
          if (state.target === 'main') await cmdSetThumbFromPhoto(largest.file_id);
          return;
        }
        await handleStateReply(chatId, message, state);
        return;
      }
      // gak ada state aktif dan bukan command -> gak ada yang perlu dilakukan
      if (message.photo) {
        await tgSend('Foto diterima, tapi bot lagi gak nunggu upload apapun. Ketik /menu buat mulai.');
      }
      return;
    }

    // ---- Command (diketik manual) ----
    const [cmdRaw, ...args] = rawText.split(/\s+/);
    const cmd = cmdRaw.toLowerCase().replace(/@.*$/, ''); // buang @botname kalau ada

    switch (cmd) {
      case '/start':
      case '/help':
        await cmdHelp();
        break;
      case '/menu':
        await clearState(chatId);
        await cmdMenu(chatId, null);
        break;
      case '/batal':
        await clearState(chatId);
        await tgSend('Oke, dibatalin. Ketik /menu buat mulai lagi.');
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
        await tgSend('Kirim FOTO-nya langsung (bukan cuma teks), dengan caption /setthumb — atau pakai /menu → Thumbnail.');
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
      case '/cleanup':
        await clearState(chatId);
        await cmdCleanupScan(chatId, null);
        break;
      case '/addadmin':
        if (!isOwner(chatId)) {
          await tgSend('Cuma owner yang bisa nambahin admin.');
          break;
        }
        await cmdAddAdmin(args[0], args[1]);
        break;
      case '/admins':
        await cmdAdminsMenu(chatId, null);
        break;
      case '/join':
        // Jarang kesampaian sini (udah ditangkep duluan di atas), tapi tetep
        // ditangani biar konsisten kalau admin yang UDAH terdaftar iseng /join lagi.
        await cmdJoin(chatId, args[0]);
        break;
      default:
        await tgSend('Perintah gak dikenal. Ketik /menu buat lihat tombol, atau /help buat daftar perintah.');
    }
  });
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
    try { await tgSend(`Error: ${escHtml(e.message)}`); } catch {}
  }

  return res.status(200).json({ ok: true });
}
