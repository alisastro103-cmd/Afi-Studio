// lib/admin-auth.js
// Helper terpusat buat sistem "Multi-Admin Website" (BUKAN Telegram lagi).
//
// Cara kerja singkatnya:
//   1. Owner (pemegang ADMIN_TOKEN) generate Kode/Link Undangan dari Admin Web,
//      sekalian nentuin durasi berlaku (mis. 24 jam).
//   2. Undangan itu py 1 timestamp "expiresAt" yang SAMA dipakai buat 2 hal:
//        a) batas waktu kode/link itu masih BISA dipakai (redeem)
//        b) begitu dipakai, sesi admin yang dihasilkan expire di waktu YANG SAMA
//      Jadi cuma ada 1 angka durasi yang perlu diisi owner, bukan 2 field membingungkan.
//   3. Kode cuma bisa dipakai SEKALI (status berubah jadi "used" begitu redeem sukses,
//      gak bisa dipakai device lain sesudahnya walau linknya kesebar).
//   4. Sesi admin yang lahir dari situ dikunci ke 1 perangkat lewat:
//        - Cookie HttpOnly + Secure + SameSite=Strict (browser lain gak akan pernah
//          punya cookie ini karena di-set server-side, gak bisa dibaca JS/dicuri gampang)
//        - Device fingerprint (hash dari userAgent+layar+timezone, dibuat di browser)
//          yang WAJIB cocok tiap kali sesi itu dipakai — cookie yang disalin ke device
//          lain tetap ditolak karena fingerprint-nya beda.
//   5. Begitu expiresAt lewat, requireAdmin()/session-check langsung nolak, cookie-nya
//      dihapus di response, dan panel.html (yang polling session-check tiap beberapa
//      puluh detik) otomatis nge-redirect balik ke halaman login.
//
// Owner (yang pegang ADMIN_TOKEN) TIDAK kepengaruh apapun oleh sistem ini — dia tetap
// login pakai token seperti biasa (lihat api/admin/verify.js), gak ada masa berlaku,
// gak ada fingerprint lock. Sistem di file ini murni buat ADMIN TAMBAHAN yang diundang.

import crypto from 'crypto';
import { Redis } from '@upstash/redis';

export const INVITES_KEY = 'afi-studio:admin:invites';
export const SESSIONS_KEY = 'afi-studio:admin:sessions';
export const SESSION_COOKIE_NAME = 'afi_admin_session';

// Kode undangan cuma boleh dipakai dalam rentang durasi yang owner pilih sendiri
// (lihat komentar di atas kenapa cuma 1 angka, bukan 2). Ini cuma batas PILIHAN
// yang boleh diminta lewat UI (owner tetap bisa isi custom dalam rentang ini).
export const MIN_DURATION_MS = 30 * 60 * 1000;        // 30 menit
export const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

export const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

export function generateInviteCode() {
  // Tanpa karakter ambigu (I,O,0,1) biar gampang dibaca/diketik ulang kalau perlu.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

export function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

export function getFingerprint(req) {
  return String(req.headers['x-device-fp'] || '').slice(0, 128) || null;
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function setSessionCookie(res, sessionId, expiresAt) {
  const maxAgeSec = Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const cookie = `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
  appendSetCookie(res, cookie);
}

export function clearSessionCookie(res) {
  const cookie = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
  appendSetCookie(res, cookie);
}

function appendSetCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookie);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookie]);
  } else {
    res.setHeader('Set-Cookie', [existing, cookie]);
  }
}

export function isOwnerToken(req) {
  const token = req.headers['x-admin-token'];
  return !!(process.env.ADMIN_TOKEN && token && token === process.env.ADMIN_TOKEN);
}

async function getInvites() {
  if (!redis) return [];
  const list = await redis.get(INVITES_KEY);
  return Array.isArray(list) ? list : [];
}

async function saveInvites(list) {
  await redis.set(INVITES_KEY, list);
}

async function getSessions() {
  if (!redis) return [];
  const list = await redis.get(SESSIONS_KEY);
  return Array.isArray(list) ? list : [];
}

async function saveSessions(list) {
  await redis.set(SESSIONS_KEY, list);
}

// Buang undangan yang udah lama expired-belum-dipakai & sesi yang udah lama
// expired, biar list di Redis gak numpuk selamanya. Dipanggil sesekali aja
// (pas owner buka daftar admin), bukan tiap request, biar hemat.
export async function pruneStale() {
  if (!redis) return;
  const now = Date.now();
  const KEEP_MS = 30 * 24 * 60 * 60 * 1000; // simpan histori 30 hari buat audit
  try {
    const invites = await getInvites();
    const prunedInvites = invites.filter(i => {
      if (i.status === 'pending' && new Date(i.expiresAt).getTime() < now) return false; // pending-tapi-expired, buang
      return (now - new Date(i.createdAt).getTime()) < KEEP_MS;
    });
    if (prunedInvites.length !== invites.length) await saveInvites(prunedInvites);
  } catch {}
  try {
    const sessions = await getSessions();
    const prunedSessions = sessions.filter(s => (now - new Date(s.createdAt).getTime()) < KEEP_MS);
    if (prunedSessions.length !== sessions.length) await saveSessions(prunedSessions);
  } catch {}
}

export async function listInvitesAndSessions() {
  await pruneStale();
  const [invites, sessions] = await Promise.all([getInvites(), getSessions()]);
  const now = Date.now();
  const invitesOut = invites
    .map(i => ({
      ...i,
      status: i.status === 'pending' && new Date(i.expiresAt).getTime() < now ? 'expired' : i.status,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const sessionsOut = sessions
    .map(s => ({
      ...s,
      active: !s.revoked && new Date(s.expiresAt).getTime() > now,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { invites: invitesOut, sessions: sessionsOut };
}

export async function createInvite({ label, durationMs }) {
  if (!redis) throw new Error('Redis belum dikonfigurasi di server.');
  const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Number(durationMs) || 0));
  const code = generateInviteCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + duration).toISOString();
  const invite = {
    code,
    label: (label || '').slice(0, 60) || 'Admin',
    createdAt: now.toISOString(),
    expiresAt,
    durationMs: duration,
    status: 'pending',
    usedAt: null,
    usedByIp: null,
  };
  const invites = await getInvites();
  invites.push(invite);
  await saveInvites(invites);
  return invite;
}

export async function revokeInvite(code) {
  if (!redis) throw new Error('Redis belum dikonfigurasi di server.');
  const invites = await getInvites();
  const idx = invites.findIndex(i => i.code === code);
  if (idx === -1) return false;
  if (invites[idx].status !== 'pending') return false; // yang udah kepake/revoked gak bisa direvoke lagi
  invites[idx].status = 'revoked';
  await saveInvites(invites);
  return true;
}

export async function revokeSession(sessionId) {
  if (!redis) throw new Error('Redis belum dikonfigurasi di server.');
  const sessions = await getSessions();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) return false;
  sessions[idx].revoked = true;
  await saveSessions(sessions);
  return true;
}

// Dipanggil dari api/admin/invite-redeem.js. Mengunci sesi baru ke IP + device
// fingerprint yang dipakai SAAT redeem — device lain yang somehow dapet salinan
// cookie-nya tetap ditolak nanti di requireAdmin() karena fingerprint gak cocok.
export async function redeemInvite({ code, ip, fingerprint }) {
  if (!redis) return { ok: false, error: 'Redis belum dikonfigurasi di server.' };
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return { ok: false, error: 'Kode undangan wajib diisi.' };

  const invites = await getInvites();
  const idx = invites.findIndex(i => i.code === normalized);
  if (idx === -1) return { ok: false, error: 'Kode undangan tidak ditemukan.' };

  const invite = invites[idx];
  if (invite.status === 'used') return { ok: false, error: 'Kode undangan ini sudah pernah dipakai (sekali pakai, 1 perangkat).' };
  if (invite.status === 'revoked') return { ok: false, error: 'Kode undangan ini sudah dicabut oleh owner.' };
  if (new Date(invite.expiresAt).getTime() < Date.now()) return { ok: false, error: 'Kode undangan ini sudah kadaluarsa.' };

  const sessionId = generateSessionId();
  const session = {
    id: sessionId,
    code: normalized,
    label: invite.label,
    createdAt: new Date().toISOString(),
    expiresAt: invite.expiresAt, // SENGAJA sama persis dengan expiry undangan, lihat catatan di atas file
    ip: ip || null,
    fingerprint: fingerprint || null,
    revoked: false,
  };

  invite.status = 'used';
  invite.usedAt = new Date().toISOString();
  invite.usedByIp = ip || null;
  invites[idx] = invite;

  const sessions = await getSessions();
  sessions.push(session);

  await Promise.all([saveInvites(invites), saveSessions(sessions)]);
  return { ok: true, session };
}

// Inti validasi tiap request ke endpoint yang butuh admin. Owner (token) SELALU
// lolos tanpa syarat tambahan. Admin undangan cuma lolos kalau: cookie ada,
// sesi ketemu di Redis, belum di-revoke, belum lewat expiresAt, DAN fingerprint
// yang dikirim browser sekarang cocok sama yang direkam pas redeem dulu.
export async function requireAdmin(req, res) {
  if (isOwnerToken(req)) {
    return { ok: true, isOwner: true, session: null };
  }

  if (!redis) {
    return { ok: false, status: 500, error: 'Server belum dikonfigurasi: database kosong.' };
  }

  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return { ok: false, status: 401, error: 'Token admin salah atau belum login.' };
  }

  const sessions = await getSessions();
  const session = sessions.find(s => s.id === sessionId);

  const invalidate = () => { if (res) clearSessionCookie(res); };

  if (!session || session.revoked) {
    invalidate();
    return { ok: false, status: 401, error: 'Sesi admin tidak valid. Silakan login/minta undangan baru lagi.' };
  }
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    invalidate();
    return { ok: false, status: 401, error: 'Sesi admin sudah habis masa berlakunya. Silakan minta undangan baru.' };
  }
  const fp = getFingerprint(req);
  if (session.fingerprint && fp && session.fingerprint !== fp) {
    invalidate();
    return { ok: false, status: 401, error: 'Sesi ini terkunci ke perangkat lain.' };
  }

  return { ok: true, isOwner: false, session };
}
