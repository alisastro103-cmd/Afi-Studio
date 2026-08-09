// api/admin/telegram-file.js
// Dipakai admin panel buat nampilin thumbnail yang diupload user lewat bot
// Telegram (bukan link). Bot token WAJIB tetap di server — endpoint ini
// yang fetch filenya dari Telegram, lalu diteruskan (proxy) ke browser
// admin. Gambar TIDAK disimpan permanen di mana pun, cuma lewat doang.
//
// Dilindungi header x-admin-token (sama seperti api/data/[type].js POST),
// jadi hanya admin yang login yang bisa akses.

const MIME_MAP = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN || !process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi.' });
  }

  const token = req.headers['x-admin-token'];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token admin salah atau belum login.' });
  }

  const { fileId } = req.query;
  if (!fileId) {
    return res.status(400).json({ error: 'fileId wajib diisi.' });
  }

  try {
    const metaResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const meta = await metaResp.json();
    if (!meta.ok) {
      return res.status(404).json({ error: 'File tidak ditemukan di Telegram (mungkin kadaluarsa).' });
    }

    const filePath = meta.result.file_path;
    const fileResp = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    if (!fileResp.ok) {
      return res.status(502).json({ error: 'Gagal ambil file dari Telegram.' });
    }

    const arrayBuffer = await fileResp.arrayBuffer();
    const ext = (filePath.split('.').pop() || '').toLowerCase();

    res.setHeader('Content-Type', MIME_MAP[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (e) {
    console.error('Gagal proxy file Telegram:', e.message);
    return res.status(500).json({ error: 'Gagal memuat gambar.' });
  }
}
