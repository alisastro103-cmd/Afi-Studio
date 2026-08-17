// api/admin/session-check.js
// Dipanggil pas halaman admin (index.html/panel.html) pertama kali dibuka, DAN
// di-poll berkala sama panel.html selama admin lagi kerja, biar kalau sesi
// undangannya expired/di-revoke owner, dia otomatis ke-logout (bukan nunggu dia
// coba nyimpen data baru gitu baru ketauan).
//
// Owner (x-admin-token valid) selalu ok:true, gak ada expiresAt (gak expire).
// Admin undangan (cookie sesi) ok:true selama belum expired/revoked/pindah device.

import { requireAdmin } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth.ok) {
    return res.status(200).json({ ok: false, error: auth.error });
  }

  if (auth.isOwner) {
    return res.status(200).json({ ok: true, isOwner: true });
  }

  return res.status(200).json({
    ok: true,
    isOwner: false,
    label: auth.session.label,
    expiresAt: auth.session.expiresAt,
  });
}
