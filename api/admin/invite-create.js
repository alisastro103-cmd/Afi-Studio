// api/admin/invite-create.js
// Owner generate kode/link undangan admin baru dari Admin Web (bukan Telegram lagi).
// POST body: { label?: string, durationMs: number }
// durationMs dibatasi MIN_DURATION_MS..MAX_DURATION_MS di lib/admin-auth.js.

import { isOwnerToken, createInvite } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method tidak diizinkan.' });
  }
  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Server belum dikonfigurasi: ADMIN_TOKEN kosong.' });
  }
  if (!isOwnerToken(req)) {
    return res.status(401).json({ error: 'Cuma owner yang bisa bikin undangan admin.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const durationMs = Number(body.durationMs);
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) {
    return res.status(400).json({ error: 'Durasi wajib diisi.' });
  }

  try {
    const invite = await createInvite({ label: body.label, durationMs });
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const url = `${proto}://${host}/admin/index.html?invite=${invite.code}`;
    return res.status(200).json({ success: true, invite: { ...invite, url } });
  } catch (e) {
    console.error('Gagal bikin undangan admin:', e.message);
    return res.status(500).json({ error: e.message || 'Gagal membuat undangan.' });
  }
}
