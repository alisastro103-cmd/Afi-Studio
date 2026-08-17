// api/admin/logout.js
// Dipanggil tombol "Keluar" di panel. Buat admin undangan: sesi di Redis
// ditandain revoked (jadi cookie lama gak bisa dipakai lagi walau ke-copy)
// dan cookie-nya dihapus di browser. Buat owner (token doang, gak ada cookie)
// ini praktis no-op di server — logout owner cukup hapus token di sessionStorage
// sisi client, tapi tetap aman dipanggil.

import { parseCookies, SESSION_COOKIE_NAME, revokeSession, clearSessionCookie, redis } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (sessionId && redis) {
    try { await revokeSession(sessionId); } catch (e) { console.error('Gagal revoke sesi saat logout:', e.message); }
  }
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}
