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
//
// Database akun (Redis) SENGAJA terpisah dari database utama situs (models,
// banner, survey, dll) -- pakai instance Upstash yang beda (env var
// ACCOUNTS_REDIS_REST_URL/TOKEN), biar data akun user gak nyampur sama data
// konten situs.

import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const accountsRedis = (process.env.ACCOUNTS_REDIS_REST_URL && process.env.ACCOUNTS_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.ACCOUNTS_REDIS_REST_URL, token: process.env.ACCOUNTS_REDIS_REST_TOKEN })
  : null;

export const SESSION_COOKIE = 'afi_account_session';
const STATE_COOKIE = 'afi_oauth_state';
const SESSION_PREFIX = 'afi-accounts:session:';
const USER_PREFIX = 'afi-accounts:user:'; // key = Google "sub" (ID akun Google, permanen & unik)
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // sesi login bertahan 30 hari

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

  return res.status(200).json({
    ok: true,
    user: { name: user.name, email: user.email, picture: user.picture, username: user.username, bio: user.bio, googleId: user.googleId },
  });
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
};

export default async function handler(req, res) {
  const action = req.query.action;
  const fn = ACTIONS[action];
  if (!fn) return res.status(400).json({ error: `Action gak dikenal: ${action || '(kosong)'}` });
  return fn(req, res);
}
