// api/admin/session-revoke.js
// Owner cabut akses 1 admin undangan kapan aja — begitu di-revoke, request
// berikutnya dari admin itu langsung ke-401 (sesi udah gak ada di Redis),
// mereka otomatis kelempar balik ke layar login pas panel-nya reload/fetch.

import { redis, SESSION_PREFIX, checkAdminAuth } from '../../lib/admin-auth.js';

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
    return res.status(401).json({ error: 'Cuma owner yang bisa cabut akses admin.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const sessionId = String((body || {}).sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'sessionId wajib diisi.' });

  try {
    await redis.del(SESSION_PREFIX + sessionId);
  } catch (e) {
    return res.status(500).json({ error: `Gagal cabut akses: ${e.message}` });
  }

  return res.status(200).json({ ok: true });
}
