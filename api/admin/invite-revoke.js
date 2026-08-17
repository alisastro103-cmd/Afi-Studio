// api/admin/invite-revoke.js
// Owner cabut 1 kode undangan yang belum kepake, supaya link yang udah kesebar
// (misal salah kirim) gak bisa dipakai lagi.
// POST body: { code: string }

import { isOwnerToken, revokeInvite } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: ADMIN_TOKEN kosong.' });
  }
  if (!isOwnerToken(req)) {
    return res.status(401).json({ error: 'Cuma owner yang bisa mencabut undangan.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const code = String((body && body.code) || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Kode wajib diisi.' });

  try {
    const ok = await revokeInvite(code);
    if (!ok) return res.status(404).json({ error: 'Undangan tidak ditemukan atau sudah tidak pending.' });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('Gagal cabut undangan:', e.message);
    return res.status(500).json({ error: 'Gagal mencabut undangan.' });
  }
}
