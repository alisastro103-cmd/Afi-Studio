// api/og-image.js
// Proxy kecil: /api/og-image?src=<url thumbnail asli>
//
// Kenapa perlu: crawler preview link WhatsApp/Discord/Telegram cuma ngerti
// format gambar "lama" (jpg/png/webp/gif) buat og:image -- format kayak
// .avif SERING gagal dirender jadi thumbnail preview walau linknya sendiri
// valid & kebuka normal di browser biasa (lihat juga OG_SAFE_IMAGE_EXT di
// api/model-page.js).
//
// Daripada thumbnail model dibuang begitu aja tiap kali admin (gak sengaja)
// upload/pilih gambar dengan format kayak gitu -- endpoint ini nge-fetch
// gambar aslinya, convert ke webp pakai sharp (udah jadi dependency, dipake
// juga di api/telegram-webhook.js), terus dikirim balik dengan Content-Type
// yang bener. api/model-page.js tinggal pasang og:image ke sini kalau format
// thumb aslinya gak aman, jadi thumbnail ASLI tetep kepake, bukan diganti ke
// gambar default Afi Studio.
//
// Dibatasi cuma buat gambar (Content-Type harus image/*) dan ukuran wajar,
// plus guard SSRF yang sama kayak endpoint lain yang nge-fetch URL dari data
// admin (lib/safe-fetch.js).

import sharp from 'sharp';
import { assertSafeExternalUrl } from '../lib/safe-fetch.js';

const MAX_SOURCE_BYTES = 8 * 1024 * 1024; // 8MB, thumbnail model gak akan sebesar ini
const FETCH_TIMEOUT_MS = 8000;

export default async function handler(req, res) {
  const src = req.query && req.query.src;
  if (!src || typeof src !== 'string') {
    res.status(400).send('Parameter "src" wajib diisi.');
    return;
  }

  try {
    await assertSafeExternalUrl(src);
  } catch (e) {
    res.status(400).send(`URL sumber gak valid: ${e.message}`);
    return;
  }

  let resp;
  try {
    resp = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    res.status(502).send('Gagal mengambil gambar sumber.');
    return;
  }
  if (!resp.ok) {
    res.status(502).send(`Gambar sumber gagal diambil (status ${resp.status}).`);
    return;
  }

  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    res.status(415).send('URL sumber bukan gambar.');
    return;
  }

  const contentLength = Number(resp.headers.get('content-length') || 0);
  if (contentLength && contentLength > MAX_SOURCE_BYTES) {
    res.status(413).send('Gambar sumber kegedean.');
    return;
  }

  let buffer;
  try {
    const arrBuf = await resp.arrayBuffer();
    if (arrBuf.byteLength > MAX_SOURCE_BYTES) {
      res.status(413).send('Gambar sumber kegedean.');
      return;
    }
    buffer = Buffer.from(arrBuf);
  } catch (e) {
    res.status(502).send('Gagal membaca gambar sumber.');
    return;
  }

  let webp;
  try {
    webp = await sharp(buffer).webp({ quality: 82 }).toBuffer();
  } catch (e) {
    console.error('Gagal convert gambar ke webp buat og:image:', e.message);
    res.status(422).send('Gagal memproses gambar.');
    return;
  }

  // Cache lumayan lama -- thumbnail model jarang berubah, dan kalaupun
  // berubah, ganti-ganti thumbnail biasanya juga ganti URL sumbernya (upload
  // baru), jadi cache key (query "src") ikut beda otomatis.
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
  res.status(200).send(webp);
}
