// api/admin/invite-redeem.js
// Publik (gak butuh token) — kode undangan itu sendiri YANG jadi otorisasi.
// Sengaja pakai GETDEL (bukan GET lalu DEL terpisah) biar atomik: kalau ada
// 2 request masuk bersamaan pakai kode yang sama, cuma SATU yang berhasil
// dapet datanya, request kedua bakal dapet null → "kode gak valid" — beneran
// sekali pakai, gak ada celah race condition.

import crypto from 'crypto';
import { redis, INVITE_PREFIX, SESSION_PREFIX, buildSessionCookie } from '../../lib/admin-auth.js';
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, '10 m'),
      analytics: true,
      prefix: 'afi-studio:inviteredeem',
    })
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });
  }

  // Rate limit per IP — kode 8 karakter itu ruang kemungkinannya gede, tapi
  // tetep dibatasin biar gak ada yang nyoba brute-force nebak kode.
  const clientIp = req.headers['x-forwarded-for'] || '127.0.0.1';
  if (ratelimit) {
    try {
      const { success } = await ratelimit.limit(clientIp);
      if (!success) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
    } catch {}
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const codeRaw = String(body.code || '').trim().toUpperCase();
  if (!codeRaw) return res.status(400).json({ error: 'Kode undangan wajib diisi.' });

  let invite;
  try {
    invite = await redis.getdel(INVITE_PREFIX + codeRaw);
  } catch (e) {
    return res.status(500).json({ error: `Gagal cek kode: ${e.message}` });
  }
  if (!invite) {
    return res.status(400).json({ error: 'Kode gak valid, udah kepakai, atau udah kadaluarsa (berlaku 24 jam).' });
  }

  const sessionId = crypto.randomBytes(32).toString('hex');
  const durationSec = invite.durationDays ? invite.durationDays * 86400 : null; // null = permanent
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
