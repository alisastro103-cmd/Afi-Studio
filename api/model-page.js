// api/model-page.js
// Merender halaman /model/?id=... secara dinamis di server, supaya bot preview link
// (WhatsApp, Discord, dll — yang gak menjalankan JavaScript) tetap bisa baca judul,
// deskripsi, DAN thumbnail model yang benar dari tag <meta property="og:*">.
//
// File ini SATU-SATUNYA yang boleh diakses lewat /model dan /model/ (lihat rewrites di
// vercel.json) — HTML aslinya disimpan sebagai template statis di model/template.html
// (bukan index.html) supaya gak "menang" duluan lawan rewrite di filesystem Vercel.
//
// ID model: karena data model gak punya field "id" sendiri, dipakai model.link (URL
// download) yang sudah unik per model -- sama seperti modelFavId() di favorites.js buat
// fitur favorit. Jadi ?id= di sini isinya link download yang di-encode.

import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

const SITE_URL = 'https://afi-studio.vercel.app';
const DEFAULT_TITLE = 'Model 3D - Afi Studio';
const DEFAULT_DESC = 'Ratusan aset Minecraft gratis — rig, 3D model, texture, dan lebih banyak lagi dari komunitas Afi Studio.';
const DEFAULT_IMAGE = `${SITE_URL}/thumbnail.webp`;

// Crawler preview WhatsApp/Discord/Telegram cuma ngerti format gambar "lama"
// (jpg/jpeg/png/webp/gif) buat og:image -- .avif SERING gagal dirender jadi
// thumbnail (baik gambarnya gak muncul sama sekali maupun cuma nge-skip diam2),
// walau linknya sendiri valid dan kebuka normal di browser. Makanya thumb yang
// formatnya avif (atau format aneh lain) sengaja gak dipakai buat og:image --
// fallback ke DEFAULT_IMAGE alih-alih nampilin gambar yang berpotensi gagal.
const OG_SAFE_IMAGE_EXT = /\.(jpe?g|png|webp|gif)(\?.*)?$/i;

function isOgSafeImage(url) {
  return typeof url === 'string' && OG_SAFE_IMAGE_EXT.test(url.trim());
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function loadModels() {
  if (redis) {
    try {
      const list = await redis.get('afi-studio:data:models');
      if (Array.isArray(list)) return list;
    } catch (e) {
      console.error('Gagal ambil data model dari Redis, coba fallback file:', e.message);
    }
  }
  // Fallback: file statis di repo, sama seperti api/data/[type].js -- supaya halaman
  // share model ini tetap jalan walau Redis lagi down atau belum disiapkan.
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'Models', 'models.json'), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Gagal baca fallback Models/models.json:', e.message);
    return [];
  }
}

export default async function handler(req, res) {
  const id = req.query && req.query.id;
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESC;
  let ogImage = DEFAULT_IMAGE;
  let ogUrl = `${SITE_URL}/model/`;

  if (id) {
    try {
      const models = await loadModels();
      const model = models.find(m => m.link === id);
      if (model) {
        title = `${model.name} - Afi Studio`;
        description = model.caption && model.caption.trim() ? model.caption : DEFAULT_DESC;
        ogUrl = `${SITE_URL}/model/?id=${encodeURIComponent(id)}`;
        if (model.thumb && isOgSafeImage(model.thumb)) {
          ogImage = model.thumb;
        } else if (model.thumb && String(model.thumb).trim()) {
          // Ada thumb tapi formatnya gak aman buat preview link (mis. .avif) --
          // tetap pakai DEFAULT_IMAGE (bukan dibiarkan kosong) supaya preview
          // WhatsApp/Discord tetap nampilin sesuatu, dan dicatat di log server
          // biar ketauan model mana yang thumbnail-nya perlu diganti ke
          // jpg/png/webp lewat Admin Panel.
          console.warn(`Thumb model "${model.name}" formatnya gak didukung buat og:image (${model.thumb}), pakai DEFAULT_IMAGE.`);
        }
      } else {
        title = 'Model Tidak Ditemukan - Afi Studio';
      }
    } catch (e) {
      console.error('Gagal ambil data model buat meta tag:', e.message);
    }
  }

  let template;
  try {
    template = fs.readFileSync(path.join(process.cwd(), 'model', 'template.html'), 'utf8');
  } catch (e) {
    console.error('Gagal baca template model:', e.message);
    return res.status(500).send('Gagal memuat halaman model.');
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
