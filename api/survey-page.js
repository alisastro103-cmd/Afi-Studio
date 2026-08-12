// api/survey-page.js
// Merender halaman /survey/ (dengan atau tanpa ?id=) secara dinamis di server, supaya bot
// preview link (WhatsApp, Discord, dll — yang gak menjalankan JavaScript) tetap bisa baca
// judul & deskripsi survey yang benar dari tag <meta property="og:*">.
//
// File ini SATU-SATUNYA yang boleh diakses lewat /survey dan /survey/ (lihat rewrites di
// vercel.json) — HTML aslinya disimpan sebagai template statis di survey/template.html
// (bukan index.html) supaya gak "menang" duluan lawan rewrite di filesystem Vercel.

import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const SITE_URL = 'https://afi-studio.vercel.app';
const DEFAULT_TITLE = 'Survey & Polling - Afi Studio';
const DEFAULT_DESC = 'Ikut serta dalam survey dan polling dari komunitas Afi Studio. Lihat daftar survey yang sedang berjalan dan bagikan pendapatmu.';
const DEFAULT_IMAGE = `${SITE_URL}/thumbnail.webp`;

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export default async function handler(req, res) {
  const id = req.query && req.query.id;
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESC;
  let ogImage = DEFAULT_IMAGE;
  let ogUrl = `${SITE_URL}/survey/`;

  if (id && redis) {
    try {
      const surveys = await redis.get('afi-studio:data:surveys');
      const survey = Array.isArray(surveys) ? surveys.find(s => s.id === id) : null;
      if (survey) {
        title = `${survey.title} - Survey Afi Studio`;
        description = survey.description && survey.description.trim() ? survey.description : DEFAULT_DESC;
        ogUrl = `${SITE_URL}/survey/?id=${encodeURIComponent(id)}`;
        // Thumbnail survey: kalau diisi lewat Link, langsung dipakai sebagai og:image.
        // Kalau diisi lewat Upload (disimpan sebagai data: URI di Redis), arahkan ke
        // /api/survey-thumbnail yang men-decode & nge-serve bytes-nya lewat URL asli,
        // karena bot preview (WhatsApp dll) gak bisa baca data: URI di meta tag.
        // Kalau kosong, tetap pakai gambar bawaan (DEFAULT_IMAGE).
        const thumb = survey.thumbnail && String(survey.thumbnail).trim();
        if (thumb) {
          ogImage = thumb.startsWith('data:')
            ? `${SITE_URL}/api/survey-thumbnail?id=${encodeURIComponent(id)}`
            : thumb;
        }
      } else {
        title = 'Link Survey Tidak Valid - Afi Studio';
      }
    } catch (e) {
      console.error('Gagal ambil data survey buat meta tag:', e.message);
    }
  }

  let template;
  try {
    template = fs.readFileSync(path.join(process.cwd(), 'survey', 'template.html'), 'utf8');
  } catch (e) {
    console.error('Gagal baca template survey:', e.message);
    return res.status(500).send('Gagal memuat halaman survey.');
  }

  const html = template
    .split('%%PAGE_TITLE%%').join(escapeHtml(title))
    .split('%%OG_TITLE%%').join(escapeHtml(title))
    .split('%%OG_DESC%%').join(escapeHtml(description))
    .split('%%OG_URL%%').join(escapeHtml(ogUrl))
    .split('%%OG_IMAGE%%').join(escapeHtml(ogImage));

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  return res.status(200).send(html);
}
