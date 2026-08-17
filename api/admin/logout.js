// api/admin/logout.js
// Buat admin undangan: hapus sesi dari Redis + kosongin cookie di browser.
// Buat owner (yang login pakai token, disimpen di sessionStorage bukan
// cookie): gak ada cookie yang perlu dihapus, panel.html tinggal
// sessionStorage.removeItem() sendiri di sisi client — endpoint ini tetap
// aman dipanggil (no-op kalau gak ada cookie sesi).

import { redis, SESSION_PREFIX, SESSION_COOKIE_NAME, buildClearSessionCookie, parseCookies } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (sessionId && redis) {
    try { await redis.del(SESSION_PREFIX + sessionId); } catch {}
  }

  res.setHeader('Set-Cookie', buildClearSessionCookie());
  return res.status(200).json({ ok: true });
}
