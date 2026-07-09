// api/admin-login.js
// Endpoint sederhana buat cek password admin. Kalau cocok, password itu
// sendiri dipakai sebagai "token" Bearer di request-request berikutnya
// (disimpan di localStorage browser admin panel).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD belum di-set di Environment Variables' });
  }

  if (password && password === expected) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'password salah' });
}
