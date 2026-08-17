// api/admin/session-list.js
// Owner liat daftar admin undangan yang lagi aktif (sesi belum expired),
// buat dicabut manual kalau perlu. Karena kita gak nyimpen daftar sessionId
// terpusat (biar gak ada 1 titik nyimpen semua rahasia), dipakein Redis SCAN
// buat nemuin semua key "afi-studio:adminsession:*" — cukup ringan karena
// jumlah admin biasanya kecil (bukan ribuan).

import { redis, SESSION_PREFIX, checkAdminAuth } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: database belum tersambung.' });
  }

  const auth = await checkAdminAuth(req);
  if (!auth.ok || !auth.isOwner) {
    return res.status(401).json({ error: 'Cuma owner yang bisa liat daftar admin.' });
  }

  try {
    const sessions = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: `${SESSION_PREFIX}*`, count: 100 });
      cursor = nextCursor;
      if (keys.length) {
        const values = await Promise.all(keys.map((k) => redis.get(k)));
        keys.forEach((k, i) => {
          const v = values[i];
          if (v) sessions.push({ id: k.slice(SESSION_PREFIX.length), ...v });
        });
      }
    } while (cursor !== '0');

    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ ok: true, sessions });
  } catch (e) {
    return res.status(500).json({ error: `Gagal ambil daftar admin: ${e.message}` });
  }
}
