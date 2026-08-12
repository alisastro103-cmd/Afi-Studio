// api/survey-thumbnail.js
// Thumbnail survey yang diupload lewat panel admin disimpan sebagai data: URI (base64) di
// dalam data survey (sama seperti gambar pertanyaan). Itu cukup buat ditampilkan langsung
// lewat <img> di halaman survey/panel admin (JS jalan, browser bisa baca data: URI).
//
// Tapi bot preview link (WhatsApp, Discord, dll) yang mengambil og:image / twitter:image TIDAK
// menjalankan JavaScript dan TIDAK bisa memuat data: URI dari meta tag — mereka butuh URL
// http(s) beneran buat di-fetch. Endpoint ini men-decode data: URI tadi dari Redis dan
// men-serve isinya sebagai response gambar biasa lewat URL, supaya og:image tetap valid.
//
// Kalau thumbnail-nya diisi lewat opsi "Link Gambar" di admin, endpoint ini gak dipakai —
// api/survey-page.js langsung pakai link tersebut sebagai og:image.

import { Redis } from '@upstash/redis';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const DATA_URI_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

export default async function handler(req, res) {
  const id = req.query && req.query.id;
  if (!id || !redis) {
    return res.status(404).send('Not found');
  }

  try {
    const surveys = await redis.get('afi-studio:data:surveys');
    const survey = Array.isArray(surveys) ? surveys.find(s => s.id === id) : null;
    const thumb = survey && survey.thumbnail;

    if (!thumb || typeof thumb !== 'string') {
      return res.status(404).send('Not found');
    }

    const match = DATA_URI_RE.exec(thumb.trim());
    if (!match) {
      return res.status(404).send('Not found');
    }

    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600');
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('Gagal ambil thumbnail survey:', e.message);
    return res.status(500).send('Error');
  }
}
