// lib/admin-auth.js
//
// Otorisasi buat semua endpoint admin panel. ADA DUA JALUR yang sah:
//
//   1. OWNER — header "x-admin-token" cocok sama ADMIN_TOKEN (env var).
//      Ini kredensial master, permanent, gak pernah expired, gak berubah
//      dari desain lama. Dipakai buat login token langsung di panel.
//
//   2. ADMIN UNDANGAN — cookie HTTP-Only "afi_admin_session" yang nunjuk
//      ke sesi valid & belum expired di Redis. Sesi ini dibikin lewat
//      /api/admin/invite-redeem, sekali pakai, terikat ke 1 browser/device
//      (gak bisa dibaca/dicopy dari JavaScript sisi client karena HttpOnly).
//
// Endpoint admin manapun tinggal panggil checkAdminAuth(req) dan cek
// hasil.ok — gak perlu tau detail cookie/session di baliknya.

import { Redis } from '@upstash/redis';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

export const SESSION_COOKIE_NAME = 'afi_admin_session';
const SESSION_PREFIX = 'afi-studio:adminsession:';
const INVITE_PREFIX = 'afi-studio:admininvite:';

// Kode undangan berlaku maksimal 24 jam buat DIPAKAI (bukan durasi akses
// setelah dipakai — itu diatur owner sendiri pas bikin kode). 24 jam dikasih
// biar ada waktu buat share link ke admin baru lewat WhatsApp/Telegram dll,
// gak harus langsung dipakai detik itu juga kayak kode bot yang cuma 15 menit.
export const INVITE_REDEEM_WINDOW_SEC = 24 * 60 * 60;

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

// Return salah satu:
//   { ok: true, isOwner: true }
//   { ok: true, isOwner: false, session: { id, label, createdAt, expiresAt } }
//   { ok: false }
export async function checkAdminAuth(req) {
  const headerToken = req.headers['x-admin-token'];
  if (process.env.ADMIN_TOKEN && headerToken && headerToken === process.env.ADMIN_TOKEN) {
    return { ok: true, isOwner: true };
  }

  if (!redis) return { ok: false };

  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return { ok: false };

  try {
    const session = await redis.get(SESSION_PREFIX + sessionId);
    if (!session) return { ok: false };
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      redis.del(SESSION_PREFIX + sessionId).catch(() => {});
      return { ok: false };
    }
    return { ok: true, isOwner: false, session: { ...session, id: sessionId } };
  } catch {
    return { ok: false };
  }
}

// Bikin Set-Cookie header buat sesi baru. maxAgeSec null = "permanent"
// (dikasih umur cookie 10 tahun, karena cookie emang gak bisa beneran
// gak-pernah-expired, tapi 10 tahun praktis sama aja).
export function buildSessionCookie(sessionId, maxAgeSec) {
  const effectiveMaxAge = maxAgeSec == null ? 10 * 365 * 24 * 60 * 60 : maxAgeSec;
  return `${SESSION_COOKIE_NAME}=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${effectiveMaxAge}`;
}

// Set-Cookie buat logout (ngosongin cookie langsung di browser)
export function buildClearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export { parseCookies, redis, SESSION_PREFIX, INVITE_PREFIX };
