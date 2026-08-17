// api/admin/invite-create.js
// Owner bikin kode undangan admin panel lewat sini. Kode berlaku 24 jam
// buat DIPAKAI; begitu dipakai (redeem), durasi AKSES yang beneran dikasih
// ke admin baru itu sesuai "durationDays" yang owner pilih di sini
// (null/0 = permanent).

import { redis, INVITE_PREFIX, INVITE_REDEEM_WINDOW_SEC } from '../../lib/admin-auth.js';
import { checkAdminAuth } from '../../lib/admin-auth.js';

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa karakter ambigu (I,O,0,1)
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });
  }

  const auth = await checkAdminAuth(req);
  if (!auth.ok || !auth.isOwner) {
    return res.status(401).json({ error: 'Cuma owner yang bisa bikin kode undangan.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const label = String(body.label || '').trim().slice(0, 60) || 'Admin';
  let durationDays = Number(body.durationDays);
  if (!Number.isFinite(durationDays) || durationDays <= 0) durationDays = null; // permanent

  const code = generateInviteCode();
  const invite = {
    label,
    durationDays,
    createdAt: new Date().toISOString(),
  };

  try {
    await redis.set(INVITE_PREFIX + code, invite, { ex: INVITE_REDEEM_WINDOW_SEC });
  } catch (e) {
    return res.status(500).json({ error: `Gagal bikin kode undangan: ${e.message}` });
  }

  return res.status(200).json({
    ok: true,
    code,
    label,
    durationDays,
    redeemWindowHours: INVITE_REDEEM_WINDOW_SEC / 3600,
  });
}
