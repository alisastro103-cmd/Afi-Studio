// api/admin/invite-list.js
// Owner lihat daftar undangan (pending/used/revoked/expired) + daftar sesi admin
// undangan yang lagi/pernah aktif, buat panel "Kelola Admin".

import { isOwnerToken, listInvitesAndSessions } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: ADMIN_TOKEN kosong.' });
  }
  if (!isOwnerToken(req)) {
    return res.status(401).json({ error: 'Cuma owner yang bisa lihat daftar admin.' });
  }

  try {
    const data = await listInvitesAndSessions();
    return res.status(200).json(data);
  } catch (e) {
    console.error('Gagal ambil daftar undangan/sesi admin:', e.message);
    return res.status(500).json({ error: 'Gagal mengambil daftar admin.' });
  }
}
