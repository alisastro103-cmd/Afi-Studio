// api/models.js
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
    thumb: row.thumb,
    link: row.link,
  };
}

export default async function handler(req, res) {
  let db;
  try {
    db = getDb();
  } catch (envErr) {
    console.error('Database init error:', envErr.message);
    return res.status(500).json({ error: 'Database environment configuration missing' });
  }

  try {
    if (req.method === 'GET') {
      // Menggunakan query string biasa tanpa argumen array kosong jika tidak dibutuhkan
      const result = await db.execute('SELECT id, name, caption, creator, converter, category, thumb, link FROM models ORDER BY id DESC');
      
      if (!result || !result.rows) {
        return res.status(200).json([]);
      }

      const models = result.rows.map(rowToModel);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(models);
    }

    // Semua method di bawah ini butuh login admin
    if (!checkAdmin(req)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (req.method === 'POST') {
      const { name, caption, creator, converter, category, thumb, link } = req.body || {};
      if (!name) return res.status(400).json({ error: 'name wajib diisi' });

      const categoryStr = Array.isArray(category) ? category.join(',') : (category || '');
      const result = await db.execute({
        sql: `INSERT INTO models (name, caption, creator, converter, category, thumb, link)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          String(name), 
          String(caption || ''), 
          String(creator || ''), 
          String(converter || ''), 
          String(categoryStr), 
          String(thumb || ''), 
          String(link || '')
        ],
      });
      return res.status(201).json({ id: result.lastInsertRowid ? Number(result.lastInsertRowid) : null });
    }

    if (req.method === 'PUT') {
      const id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id wajib diisi' });
      const { name, caption, creator, converter, category, thumb, link } = req.body || {};
      const categoryStr = Array.isArray(category) ? category.join(',') : (category || '');

      await db.execute({
        sql: `UPDATE models SET name = ?, caption = ?, creator = ?, converter = ?,
              category = ?, thumb = ?, link = ? WHERE id = ?`,
        args: [
          String(name || ''), 
          String(caption || ''), 
          String(creator || ''), 
          String(converter || ''), 
          String(categoryStr), 
          String(thumb || ''), 
          String(link || ''), 
          id
        ],
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
    console.error('api/models error:', err.message || err);
    return res.status(500).json({ error: 'internal_error', details: err.message });
  }
}
