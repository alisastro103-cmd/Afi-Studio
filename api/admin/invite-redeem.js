// api/admin/invite-redeem.js
// Dipanggil dari halaman login admin (index.html) waktu orang yang diundang
// nempelin kode/buka link undangan. Endpoint ini publik (belum login), makanya
// WAJIB di-rate-limit biar gak dipakai buat nebak-nebak kode secara brute force.
//
// POST body: { code: string, fingerprint: string }
// Sukses -> set-cookie httpOnly sesi admin, dikunci ke fingerprint device ini.

import { Ratelimit } from '@upstash/ratelimit';
import {
  redis, redeemInvite, setSessionCookie, getClientIp, getFingerprint,
} from '../../lib/admin-auth.js';

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 m'),
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
    return res.status(500).json({ error: 'Server belum dikonfigurasi: database kosong.' });
  }

  const clientIp = getClientIp(req) || '127.0.0.1';

  if (ratelimit) {
    try {
      const { success, reset } = await ratelimit.limit(clientIp);
      if (!success) {
        const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfterSec);
        return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' });
      }
    } catch (e) {
      console.error('Rate limit check gagal, request tetap dilanjutkan:', e.message);
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const fingerprint = String(body.fingerprint || getFingerprint(req) || '').slice(0, 128) || null;

  try {
    const result = await redeemInvite({ code: body.code, ip: clientIp, fingerprint });
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    setSessionCookie(res, result.session.id, result.session.expiresAt);
    return res.status(200).json({
      success: true,
      label: result.session.label,
      expiresAt: result.session.expiresAt,
    });
  } catch (e) {
    console.error('Gagal redeem undangan admin:', e.message);
    return res.status(500).json({ error: 'Gagal memproses kode undangan.' });
  }
}
