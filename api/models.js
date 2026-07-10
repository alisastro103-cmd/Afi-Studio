// api/models.js
// Endpoint CRUD untuk konten Models. Mengganti Models/models.json statis.
//
// GET    /api/models          -> ambil semua model (publik, dipakai halaman Models)
// POST   /api/models          -> tambah model baru (butuh header Authorization admin)
// PUT    /api/models?id=123   -> update model (butuh header Authorization admin)
// DELETE /api/models?id=123   -> hapus model (butuh header Authorization admin)

import { getDb } from '../lib/db.js';

function checkAdmin(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  return token && token === process.env.ADMIN_PASSWORD;
}

function rowToModel(row) {
  return {
    id: row.id,
    name: row.name,
    caption: row.caption,
    creator: row.creator,
    converter: row.converter,
    category: row.category ? row.category.split(',').map(c => c.trim()).filter(Boolean) : [],
    app_target: row.app_target || '',
    thumb: row.thumb,
    link: row.link,
  };
}

export default async function handler(req, res) {
  const db = getDb();

  try {
    if (req.method === 'GET') {
      const result = await db.execute('SELECT * FROM models ORDER BY id DESC');
      const models = result.rows.map(rowToModel);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(models);
    }

    // Semua method di bawah ini butuh login admin
    if (!checkAdmin(req)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (req.method === 'POST') {
      const { name, caption, creator, converter, category, app_target, thumb, link } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name wajib diisi' });

      const categoryStr = Array.isArray(category) ? category.join(',') : (category || '');
      const result = await db.execute({
        sql: `INSERT INTO models (name, caption, creator, converter, category, app_target, thumb, link)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [name, caption || '', creator || '', converter || '', categoryStr, app_target || '', thumb || '', link || ''],
      });
      return res.status(201).json({ id: Number(result.lastInsertRowid) });
    }

    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id wajib diisi' });
      const { name, caption, creator, converter, category, app_target, thumb, link } = req.body || {};
      const categoryStr = Array.isArray(category) ? category.join(',') : (category || '');

      await db.execute({
        sql: `UPDATE models SET name = ?, caption = ?, creator = ?, converter = ?,
              category = ?, app_target = ?, thumb = ?, link = ? WHERE id = ?`,
        args: [name, caption || '', creator || '', converter || '', categoryStr, app_target || '', thumb || '', link || '', id],
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id wajib diisi' });
      await db.execute({ sql: 'DELETE FROM models WHERE id = ?', args: [id] });
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    console.error('api/models error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
