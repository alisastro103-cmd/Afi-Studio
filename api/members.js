// api/members.js
// Endpoint CRUD untuk konten Member. Mengganti member-Afi-Studio/member.json statis.
//
// GET    /api/members          -> ambil semua member (publik)
// POST   /api/members          -> tambah member baru (butuh header Authorization admin)
// PUT    /api/members?id=123   -> update member (butuh header Authorization admin)
// DELETE /api/members?id=123   -> hapus member (butuh header Authorization admin)

import { getDb } from '../lib/db.js';

function checkAdmin(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  return token && token === process.env.ADMIN_PASSWORD;
}

function rowToMember(row) {
  let socials = {};
  try {
    socials = row.socials ? JSON.parse(row.socials) : {};
  } catch {
    socials = {};
  }
  return {
    id: row.id,
    gen_id: row.gen_id,
    nama: row.nama,
    foto: row.foto,
    spesialis: row.spesialis,
    identitas: row.identitas,
    generasi: row.generasi,
    socials,
  };
}

export default async function handler(req, res) {
  const db = getDb();

  try {
    if (req.method === 'GET') {
      const result = await db.execute('SELECT * FROM members ORDER BY gen_id ASC, id ASC');
      const members = result.rows.map(rowToMember);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(members);
    }

    if (!checkAdmin(req)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (req.method === 'POST') {
      const { gen_id, nama, foto, spesialis, identitas, generasi, socials } = req.body || {};
      if (!nama) return res.status(400).json({ error: 'nama wajib diisi' });
      if (!gen_id) return res.status(400).json({ error: 'gen_id wajib diisi (contoh: gen-1)' });

      const result = await db.execute({
        sql: `INSERT INTO members (gen_id, nama, foto, spesialis, identitas, generasi, socials)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [gen_id, nama, foto || '', spesialis || '', identitas || '', generasi || '', JSON.stringify(socials || {})],
      });
      return res.status(201).json({ id: Number(result.lastInsertRowid) });
    }

    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id wajib diisi' });
      const { gen_id, nama, foto, spesialis, identitas, generasi, socials } = req.body || {};

      await db.execute({
        sql: `UPDATE members SET gen_id = ?, nama = ?, foto = ?, spesialis = ?, identitas = ?,
              generasi = ?, socials = ? WHERE id = ?`,
        args: [gen_id, nama, foto || '', spesialis || '', identitas || '', generasi || '', JSON.stringify(socials || {}), id],
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id wajib diisi' });
      await db.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [id] });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('api/members error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
