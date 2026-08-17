// api/admin/whoami.js
// Dipanggil pas admin/panel.html pertama kali dibuka, buat cek apa udah ada
// sesi yang valid (cookie admin undangan) TANPA perlu owner ketik ulang
// token tiap buka panel. Kalau cookie-nya udah expired/gak ada, ini bakal
// balikin ok:false, dan panel nampilin layar login lagi (baik login pakai
// token owner ATAU redeem kode undangan baru).

import { checkAdminAuth } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  const auth = await checkAdminAuth(req);
  if (!auth.ok) return res.status(200).json({ ok: false });

  if (auth.isOwner) return res.status(200).json({ ok: true, isOwner: true, label: 'Owner' });
  return res.status(200).json({ ok: true, isOwner: false, label: auth.session.label, expiresAt: auth.session.expiresAt });
}
