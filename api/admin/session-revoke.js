// api/admin/session-revoke.js
// Owner "tendang" 1 admin undangan yang lagi aktif (misal HP-nya hilang, atau
// dia udah gak perlu akses lagi sebelum masa berlakunya abis sendiri).
// POST body: { sessionId: string }

import { isOwnerToken, revokeSession } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: ADMIN_TOKEN kosong.' });
  }
  if (!isOwnerToken(req)) {
    return res.status(401).json({ error: 'Cuma owner yang bisa mencabut akses admin.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const sessionId = String((body && body.sessionId) || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'sessionId wajib diisi.' });

  try {
    const ok = await revokeSession(sessionId);
    if (!ok) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Gagal cabut sesi admin:', e.message);
    return res.status(500).json({ error: 'Gagal mencabut akses admin.' });
  }
}
