// api/admin/verify.js
// Dipakai layar login admin panel buat ngecek token yang diketik itu benar
// atau salah, tanpa perlu nyimpen apapun. Cukup cocokkan sama ADMIN_TOKEN
// di Environment Variables Vercel.

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: ADMIN_TOKEN kosong.' });
  }

  const token = req.headers['x-admin-token'];
  if (token && token === process.env.ADMIN_TOKEN) {
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Token salah.' });
}
