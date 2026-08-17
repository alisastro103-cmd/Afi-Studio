// api/admin/auth.js
//
// SEMUA endpoint otorisasi admin panel digabung jadi SATU file di sini
// (dibedain lewat ?action=... di URL), bukan 1 file per endpoint kayak
// sebelumnya. Alasannya bukan soal rapi-rapian kode, tapi murni batas
// teknis: plan Vercel Hobby cuma boleh maksimal 12 serverless function per
// deployment (tiap file .js di dalam api/ dihitung 1 function). Sebelum
// digabung gini, ada 7 file kecil-kecil di sini yang masing-masing makan 1
// jatah function sendiri — abis digabung, jatahnya jadi 1 doang.
//
// Cara pakainya dari sisi frontend: kirim query string ?action=nama_aksi
// ke /api/admin/auth, method & body-nya sama persis kayak pas masih
// terpisah dulu.
//
//   POST /api/admin/auth?action=verify          — cek token owner (layar login)
//   POST /api/admin/auth?action=invite-create    — owner bikin kode undangan
//   POST /api/admin/auth?action=invite-redeem    — publik, tukar kode jadi sesi
//   GET  /api/admin/auth?action=whoami            — cek sesi aktif (owner ATAU cookie)
//   GET  /api/admin/auth?action=session-list      — owner liat daftar admin aktif
//   POST /api/admin/auth?action=session-revoke    — owner cabut 1 sesi admin
//   POST /api/admin/auth?action=logout            — hapus sesi + cookie

import crypto from 'crypto';
import { Ratelimit } from '@upstash/ratelimit';
import {
  redis, INVITE_PREFIX, SESSION_PREFIX, INVITE_REDEEM_WINDOW_SEC,
  buildSessionCookie, buildClearSessionCookie, parseCookies,
  SESSION_COOKIE_NAME, checkAdminAuth,
} from '../../lib/admin-auth.js';

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa karakter ambigu (I,O,0,1)
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function parseJsonBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body || {};
}

const inviteRedeemRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, '10 m'),
      analytics: true,
      prefix: 'afi-studio:inviteredeem',
    })
  : null;

/* ---------------- action: verify (login token owner) ---------------- */
async function actionVerify(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  if (!process.env.ADMIN_TOKEN) return res.status(500).json({ error: 'Server belum dikonfigurasi: ADMIN_TOKEN kosong.' });
  const token = req.headers['x-admin-token'];
  if (token && token === process.env.ADMIN_TOKEN) return res.status(200).json({ ok: true });
  return res.status(401).json({ ok: false, error: 'Token salah.' });
}

/* ---------------- action: invite-create (owner only) ---------------- */
async function actionInviteCreate(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  if (!redis) return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });

  const auth = await checkAdminAuth(req);
  if (!auth.ok || !auth.isOwner) return res.status(401).json({ error: 'Cuma owner yang bisa bikin kode undangan.' });

  const body = await parseJsonBody(req);
  const label = String(body.label || '').trim().slice(0, 60) || 'Admin';
  let durationMinutes = Number(body.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) durationMinutes = null; // permanent

  const code = generateInviteCode();
  const invite = { label, durationMinutes, createdAt: new Date().toISOString() };

  try {
    await redis.set(INVITE_PREFIX + code, invite, { ex: INVITE_REDEEM_WINDOW_SEC });
  } catch (e) {
    return res.status(500).json({ error: `Gagal bikin kode undangan: ${e.message}` });
  }
  return res.status(200).json({ ok: true, code, label, durationMinutes, redeemWindowHours: INVITE_REDEEM_WINDOW_SEC / 3600 });
}

/* ---------------- action: invite-redeem (publik) ---------------- */
async function actionInviteRedeem(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  if (!redis) return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });

  const clientIp = req.headers['x-forwarded-for'] || '127.0.0.1';
  if (inviteRedeemRatelimit) {
    try {
      const { success } = await inviteRedeemRatelimit.limit(clientIp);
      if (!success) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    } catch {}
  }

  const body = await parseJsonBody(req);
  const codeRaw = String(body.code || '').trim().toUpperCase();
  if (!codeRaw) return res.status(400).json({ error: 'Kode undangan wajib diisi.' });

  let invite;
  try {
    // GETDEL atomik — sekali pakai beneran, gak ada celah race condition.
    invite = await redis.getdel(INVITE_PREFIX + codeRaw);
  } catch (e) {
    return res.status(500).json({ error: `Gagal cek kode: ${e.message}` });
  }
  if (!invite) return res.status(400).json({ error: 'Kode gak valid, udah kepakai, atau udah kadaluarsa (berlaku 24 jam).' });

  const sessionId = crypto.randomBytes(32).toString('hex');
  const durationSec = invite.durationMinutes ? invite.durationMinutes * 60 : null; // null = permanent
  const expiresAt = durationSec ? new Date(Date.now() + durationSec * 1000).toISOString() : null;
  const session = {
    label: invite.label || 'Admin',
    createdAt: new Date().toISOString(),
    expiresAt,
    userAgent: (req.headers['user-agent'] || '').slice(0, 200),
  };

  try {
    const setOpts = durationSec ? { ex: durationSec } : {};
    await redis.set(SESSION_PREFIX + sessionId, session, setOpts);
  } catch (e) {
    return res.status(500).json({ error: `Gagal bikin sesi: ${e.message}` });
  }

  res.setHeader('Set-Cookie', buildSessionCookie(sessionId, durationSec));
  return res.status(200).json({ ok: true, label: session.label, expiresAt });
}

/* ---------------- action: whoami ---------------- */
async function actionWhoami(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', ['GET']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  const auth = await checkAdminAuth(req);
  if (!auth.ok) return res.status(200).json({ ok: false });
  if (auth.isOwner) return res.status(200).json({ ok: true, isOwner: true, label: 'Owner' });
  return res.status(200).json({ ok: true, isOwner: false, label: auth.session.label, expiresAt: auth.session.expiresAt });
}

/* ---------------- action: session-list (owner only) ---------------- */
async function actionSessionList(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', ['GET']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  if (!redis) return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });

  const auth = await checkAdminAuth(req);
  if (!auth.ok || !auth.isOwner) return res.status(401).json({ error: 'Cuma owner yang bisa liat daftar admin.' });

  try {
    const sessions = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: `${SESSION_PREFIX}*`, count: 100 });
      cursor = nextCursor;
      if (keys.length) {
        const values = await Promise.all(keys.map((k) => redis.get(k)));
        keys.forEach((k, i) => { const v = values[i]; if (v) sessions.push({ id: k.slice(SESSION_PREFIX.length), ...v }); });
      }
    } while (cursor !== '0');
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ ok: true, sessions });
  } catch (e) {
    return res.status(500).json({ error: `Gagal ambil daftar admin: ${e.message}` });
  }
}

/* ---------------- action: session-revoke (owner only) ---------------- */
async function actionSessionRevoke(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  if (!redis) return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });

  const auth = await checkAdminAuth(req);
  if (!auth.ok || !auth.isOwner) return res.status(401).json({ error: 'Cuma owner yang bisa cabut akses admin.' });

  const body = await parseJsonBody(req);
  const sessionId = String(body.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'sessionId wajib diisi.' });

  try {
    await redis.del(SESSION_PREFIX + sessionId);
  } catch (e) {
    return res.status(500).json({ error: `Gagal cabut akses: ${e.message}` });
  }
  return res.status(200).json({ ok: true });
}

/* ---------------- action: logout ---------------- */
async function actionLogout(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method tidak diizinkan.' }); }
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (sessionId && redis) {
    try { await redis.del(SESSION_PREFIX + sessionId); } catch {}
  }
  res.setHeader('Set-Cookie', buildClearSessionCookie());
  return res.status(200).json({ ok: true });
}

const ACTIONS = {
  'verify': actionVerify,
  'invite-create': actionInviteCreate,
  'invite-redeem': actionInviteRedeem,
  'whoami': actionWhoami,
  'session-list': actionSessionList,
  'session-revoke': actionSessionRevoke,
  'logout': actionLogout,
};

export default async function handler(req, res) {
  const action = req.query.action;
  const fn = ACTIONS[action];
  if (!fn) return res.status(400).json({ error: `Action gak dikenal: ${action || '(kosong)'}` });
  return fn(req, res);
}
