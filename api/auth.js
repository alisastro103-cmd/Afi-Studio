// api/auth.js
//
// Sistem login pakai akun Google. Action-based (?action=...), digabung jadi
// SATU file kayak api/admin/auth.js & api/admin/media.js -- alasan sama:
// jatah serverless function di Vercel Hobby cuma 12.
//
//   GET  /api/auth?action=google-login     -> redirect ke halaman pilih akun Google
//   GET  /api/auth?action=google-callback  -> Google balik ke sini abis user pilih akun
//   GET  /api/auth?action=me               -> cek sesi aktif, balikin profil (atau 401)
//   POST /api/auth?action=logout           -> hapus sesi + cookie
//   GET  /api/auth?action=check-username   -> cek ketersediaan username (buat live-check di form)
//   POST /api/auth?action=complete-profile -> simpan nickname/username/role/sosmed/foto (wizard pendaftaran akun)
//
// Database akun (Redis) SENGAJA terpisah dari database utama situs (models,
// banner, survey, dll) -- pakai instance Upstash yang beda (env var
// ACCOUNTS_REDIS_REST_URL/TOKEN), biar data akun user gak nyampur sama data
// konten situs.

import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import { uploadToPermanent } from '../lib/image-storage.js';

const accountsRedis = (process.env.ACCOUNTS_REDIS_REST_URL && process.env.ACCOUNTS_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.ACCOUNTS_REDIS_REST_URL, token: process.env.ACCOUNTS_REDIS_REST_TOKEN })
  : null;

export const SESSION_COOKIE = 'afi_account_session';
const STATE_COOKIE = 'afi_oauth_state';
const SESSION_PREFIX = 'afi-accounts:session:';
const USER_PREFIX = 'afi-accounts:user:'; // key = Google "sub" (ID akun Google, permanen & unik)
const USERNAME_PREFIX = 'afi-accounts:username:'; // key = username (lowercase) -> Google "sub" pemiliknya
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // sesi login bertahan 30 hari

// 12 peran/skill yang bisa dipilih user pas daftar/edit profil (nyambung ke field
// creator/converter di Models/models.json -- lihat data.schema.md).
export const ROLES = ['Designer', 'Artist', 'Modeler', 'Animator', 'Converter Model', 'Singer', 'Voice Actor', 'Artist 3D', 'Renderer', 'SFX', 'GFX', 'VFX'];

// 8 platform sosmed (nambahin gh/tg dari 6 yang lama -- yt/ig/fb/tk/wa/dc -- biar
// samain sama sketsa onboarding). member-Afi-Studio/member.json masih pake 6 lama,
// perlu disamain kalau mau tampil penuh di situ juga.
const SOCIAL_KEYS = ['yt', 'ig', 'fb', 'tk', 'wa', 'dc', 'gh', 'tg'];

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const SITE_URL = 'https://afi-studio.vercel.app';
const REDIRECT_URI = `${SITE_URL}/api/auth?action=google-callback`;

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

// Cuma izinin redirect balik ke path INTERNAL (diawali "/"), gak boleh ke
// domain luar -- biar parameter ?next= gak disalahgunain buat open-redirect.
function safeNextPath(value) {
  return (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) ? value : '/profil/';
}

// Terima "data:image/webp;base64,AAAA..." ATAU base64 polos -> Buffer.
// (Pola sama kayak decodeBase64Image di api/admin/media.js.)
function decodeBase64Image(dataUrlOrBase64) {
  const match = /^data:.+;base64,(.*)$/.exec(String(dataUrlOrBase64 || ''));
  const raw = match ? match[1] : dataUrlOrBase64;
  return Buffer.from(raw, 'base64');
}

async function parseJsonBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
}

async function getSessionUser(req) {
  if (!accountsRedis) return { error: 'Database akun belum tersambung.', status: 500 };
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return { error: 'Belum login.', status: 401 };
  const session = await accountsRedis.get(SESSION_PREFIX + sessionId);
  if (!session) return { error: 'Sesi tidak valid atau sudah habis, silakan login ulang.', status: 401 };
  const user = await accountsRedis.get(USER_PREFIX + session.googleId);
  if (!user) return { error: 'Akun tidak ditemukan.', status: 401 };
  return { user };
}

function publicUser(u) {
  return {
    googleId: u.googleId,
    name: u.name,
    email: u.email,
    picture: u.picture,
    nickname: u.nickname || null,
    username: u.username || null,
    bio: u.bio || '',
    roles: Array.isArray(u.roles) ? u.roles : [],
    socials: u.socials || {},
    avatarUrl: u.avatarUrl || null,
    bannerUrl: u.bannerUrl || null,
    // "registered" = udah kelar wizard pendaftaran (nickname+username udah diisi).
    // Dipakai profil/index.html buat mutusin nampilin wizard atau kartu akun.
    registered: !!(u.nickname && u.username),
  };
}

/* ---------------- action: check-username ---------------- */
// GET ?username=xxx  -> { available: true/false, reason? }
// Kalau lagi login dan username yang dicek sama persis kayak username DIA
// SENDIRI, tetep dianggap "available" (bukan bentrok sama diri sendiri).
async function actionCheckUsername(req, res) {
  if (!accountsRedis) return res.status(500).json({ error: 'Database akun belum tersambung.' });

  const raw = String(req.query.username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(raw)) {
    return res.status(200).json({ available: false, reason: 'format' });
  }

  const ownerId = await accountsRedis.get(USERNAME_PREFIX + raw);
  if (!ownerId) return res.status(200).json({ available: true });

  // Cek apakah pemiliknya adalah sesi yang lagi login sekarang.
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE];
  const session = sessionId ? await accountsRedis.get(SESSION_PREFIX + sessionId) : null;
  if (session && session.googleId === ownerId) {
    return res.status(200).json({ available: true });
  }
  return res.status(200).json({ available: false, reason: 'taken' });
}

/* ---------------- action: complete-profile ---------------- */
// POST body (JSON): { nickname, username, roles: [...], socials: {yt,ig,fb,tk,wa,dc},
//                      avatarBase64?, bannerBase64? }
// avatarBase64/bannerBase64 opsional -- kalau gak dikirim, foto/banner yang lama
// (atau fallback foto Google / gradient default) tetap dipakai.
async function actionCompleteProfile(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }

  const { user, error, status } = await getSessionUser(req);
  if (error) return res.status(status).json({ error });

  const body = await parseJsonBody(req);

  const nickname = String(body.nickname || '').trim().slice(0, 30);
  if (nickname.length < 2) {
    return res.status(400).json({ error: 'Nickname minimal 2 karakter.' });
  }

  const username = String(body.username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username 3-20 karakter, cuma huruf kecil, angka, dan underscore.' });
  }

  const roles = Array.isArray(body.roles) ? body.roles.filter((r) => ROLES.includes(r)) : [];
  if (roles.length === 0) {
    return res.status(400).json({ error: 'Pilih minimal 1 peran.' });
  }

  const socialsIn = body.socials && typeof body.socials === 'object' ? body.socials : {};
  const socials = {};
  for (const key of SOCIAL_KEYS) {
    const v = String(socialsIn[key] || '').trim();
    // Boleh kosong (opsional). Kalau diisi, wajib http(s) -- bukan buat validasi
    // ketat platformnya, cuma jaga-jaga biar gak kesimpen sampah bukan URL.
    if (v && !/^https?:\/\//i.test(v)) {
      return res.status(400).json({ error: `Link ${key.toUpperCase()} harus diawali http:// atau https://` });
    }
    socials[key] = v;
  }

  // Username WAJIB unik -- cek ulang di server (jangan cuma percaya hasil
  // live-check di form, bisa aja udah kesamber orang lain di antara waktu
  // itu sama waktu submit).
  const existingOwner = await accountsRedis.get(USERNAME_PREFIX + username);
  if (existingOwner && existingOwner !== user.googleId) {
    return res.status(409).json({ error: 'Username itu udah dipakai orang lain, coba yang lain ya.' });
  }

  let avatarUrl = user.avatarUrl || null;
  let bannerUrl = user.bannerUrl || null;

  try {
    if (body.avatarBase64) {
      const buffer = decodeBase64Image(body.avatarBase64);
      // public_id = googleId -> upload berikutnya otomatis NIMPA yang lama,
      // gak numpuk file basi di Cloudinary tiap kali user ganti foto.
      const result = await uploadToPermanent(buffer, 'afi-accounts/avatar', user.googleId);
      avatarUrl = result.url;
    }
    if (body.bannerBase64) {
      const buffer = decodeBase64Image(body.bannerBase64);
      const result = await uploadToPermanent(buffer, 'afi-accounts/banner', user.googleId);
      bannerUrl = result.url;
    }
  } catch (e) {
    console.error('Gagal upload foto profil/banner:', e.message);
    return res.status(500).json({ error: 'Gagal upload gambar. Coba pakai file yang lebih kecil.' });
  }

  // Pindahin index username kalau berubah dari sebelumnya (hapus yang lama
  // dulu supaya slot username lama itu bebas dipakai orang lain lagi).
  if (user.username && user.username !== username) {
    await accountsRedis.del(USERNAME_PREFIX + user.username).catch(() => {});
  }
  await accountsRedis.set(USERNAME_PREFIX + username, user.googleId);

  const updated = {
    ...user,
    nickname,
    username,
    roles,
    socials,
    avatarUrl,
    bannerUrl,
    updatedAt: new Date().toISOString(),
  };
  await accountsRedis.set(USER_PREFIX + user.googleId, updated);

  return res.status(200).json({ ok: true, user: publicUser(updated) });
}

/* ---------------- action: google-login ---------------- */
function actionGoogleLogin(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(500).send('Login Google belum dikonfigurasi di server.');

  const state = crypto.randomBytes(16).toString('hex');
  const next = safeNextPath(req.query.next);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    // "next" ditempel ke state (bukan cookie terpisah) supaya cuma butuh
    // 1 cookie sementara buat validasi CSRF, sesuai sarannya dokumentasi OAuth.
    state: `${state}.${encodeURIComponent(next)}`,
    prompt: 'select_account',
  });

  res.setHeader('Set-Cookie', `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/* ---------------- action: google-callback ---------------- */
async function actionGoogleCallback(req, res) {
  if (!accountsRedis) return res.status(500).send('Database akun belum tersambung.');

  const { code, state: stateParam, error } = req.query;
  if (error) return res.redirect(302, `/profil/?login_error=${encodeURIComponent(error)}`);

  const cookies = parseCookies(req);
  const savedState = cookies[STATE_COOKIE];
  const [state, nextEncoded] = String(stateParam || '').split('.');
  const next = safeNextPath(nextEncoded ? decodeURIComponent(nextEncoded) : '');

  // Cocokin state dari cookie vs dari Google -- kalau beda/hilang, kemungkinan
  // CSRF atau cookie kadaluarsa (user kelamaan mikir di halaman pilih akun).
  if (!savedState || !state || savedState !== state) {
    return res.redirect(302, '/profil/?login_error=state_mismatch');
  }

  try {
    // Tuker "code" jadi access_token
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code || ''),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10000),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) throw new Error(tokenData.error_description || 'Gagal tukar authorization code.');

    // Ambil profil dasar (nama, email, foto) pakai access_token-nya
    const profileResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    const profile = await profileResp.json();
    if (!profileResp.ok || !profile.sub) throw new Error('Gagal ambil profil Google.');

    // Upsert user di database akun. Field yang boleh dikustom user sendiri
    // (username/bio) SENGAJA gak ketimpa data Google tiap kali login ulang --
    // cuma diisi default kalau memang belum pernah diisi (user baru).
    const userKey = USER_PREFIX + profile.sub;
    const existing = await accountsRedis.get(userKey);
    const user = {
      googleId: profile.sub,
      email: profile.email || '',
      name: profile.name || '',
      picture: profile.picture || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
      username: existing?.username || null,
      bio: existing?.bio || '',
    };
    await accountsRedis.set(userKey, user);

    // Bikin sesi baru (token acak, bukan JWT -- gampang di-invalidate kapan
    // aja cukup hapus key-nya di Redis, gak perlu urusan expiry/refresh JWT).
    const sessionId = crypto.randomBytes(24).toString('hex');
    await accountsRedis.set(SESSION_PREFIX + sessionId, { googleId: profile.sub }, { ex: SESSION_TTL_SEC });

    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SEC}`,
      `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    ]);
    res.redirect(302, next);
  } catch (e) {
    console.error('Gagal proses login Google:', e.message);
    res.redirect(302, '/profil/?login_error=server_error');
  }
}

/* ---------------- action: me ---------------- */
async function actionMe(req, res) {
  if (!accountsRedis) return res.status(500).json({ error: 'Database akun belum tersambung.' });

  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return res.status(401).json({ error: 'Belum login.' });

  const session = await accountsRedis.get(SESSION_PREFIX + sessionId);
  if (!session) return res.status(401).json({ error: 'Sesi tidak valid atau sudah habis, silakan login ulang.' });

  const user = await accountsRedis.get(USER_PREFIX + session.googleId);
  if (!user) return res.status(401).json({ error: 'Akun tidak ditemukan.' });

  return res.status(200).json({ ok: true, user: publicUser(user) });
}

/* ---------------- action: logout ---------------- */
async function actionLogout(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }

  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE];
  if (sessionId && accountsRedis) await accountsRedis.del(SESSION_PREFIX + sessionId).catch(() => {});

  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return res.status(200).json({ ok: true });
}

const ACTIONS = {
  'google-login': actionGoogleLogin,
  'google-callback': actionGoogleCallback,
  me: actionMe,
  logout: actionLogout,
  'check-username': actionCheckUsername,
  'complete-profile': actionCompleteProfile,
};

export default async function handler(req, res) {
  const action = req.query.action;
  const fn = ACTIONS[action];
  if (!fn) return res.status(400).json({ error: `Action gak dikenal: ${action || '(kosong)'}` });
  return fn(req, res);
}
