// api/profile-page.js
//
// Merender halaman /@username secara dinamis di server, supaya bot preview
// link (WhatsApp, Discord, dll -- yang gak menjalankan JavaScript) tetap bisa
// baca nama, bio, DAN foto profil yang benar dari tag <meta property="og:*">.
//
// Sama persis pola-nya kayak api/model-page.js: HTML aslinya disimpan sebagai
// template statis di profile-view/template.html (bukan index.html) supaya
// gak "menang" duluan lawan rewrite di filesystem Vercel. Isi halaman yang
// keliatan (avatar, bio, model, dst) tetap dirender client-side lewat
// /api/auth?action=public-profile -- file ini CUMA ngurusin meta tag SEO.

import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

const accountsRedis = (process.env.ACCOUNTS_REDIS_REST_URL && process.env.ACCOUNTS_REDIS_REST_TOKEN)
  ? new Redis({ url: process.env.ACCOUNTS_REDIS_REST_URL, token: process.env.ACCOUNTS_REDIS_REST_TOKEN })
  : null;

const USER_PREFIX = 'afi-accounts:user:';
const USERNAME_PREFIX = 'afi-accounts:username:';

const SITE_URL = 'https://afi-studio.vercel.app';
const DEFAULT_DESC = 'Lihat profil member Afi Studio -- komunitas kecil buat sharing model, rig, dan aset 3D.';
const DEFAULT_IMAGE = `${SITE_URL}/thumbnail.webp`;

// Sama kayak model-page.js: crawler preview WA/Discord/Telegram cuma ngerti
// format gambar "lama" (jpg/jpeg/png/webp/gif) buat og:image.
const OG_SAFE_IMAGE_EXT = /\.(jpe?g|png|webp|gif)(\?.*)?$/i;
function isOgSafeImage(url) {
  return typeof url === 'string' && OG_SAFE_IMAGE_EXT.test(url.trim());
}
function ogImageUrlFor(photo) {
  const trimmed = photo ? String(photo).trim() : '';
  if (!trimmed) return null;
  if (isOgSafeImage(trimmed)) return trimmed;
  return `${SITE_URL}/api/og-image?src=${encodeURIComponent(trimmed)}`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export default async function handler(req, res) {
  const usernameRaw = req.query && req.query.username;
  const username = String(usernameRaw || '').trim().toLowerCase();

  let title = 'Profil Member - Afi Studio';
  let description = DEFAULT_DESC;
  let ogImage = DEFAULT_IMAGE;
  const ogUrl = `${SITE_URL}/@${encodeURIComponent(username)}`;

  if (username && accountsRedis) {
    try {
      const ownerId = await accountsRedis.get(USERNAME_PREFIX + username);
      const user = ownerId ? await accountsRedis.get(USER_PREFIX + ownerId) : null;
      if (user && user.nickname) {
        title = `${user.nickname} (@${user.username}) - Afi Studio`;
        description = user.bio && user.bio.trim() ? user.bio : DEFAULT_DESC;
        const photo = user.avatarUrl || user.picture;
        if (photo) ogImage = ogImageUrlFor(photo) || DEFAULT_IMAGE;
      } else {
        title = 'Profil Tidak Ditemukan - Afi Studio';
      }
    } catch (e) {
      console.error('Gagal ambil data profil buat meta tag:', e.message);
    }
  }

  let template;
  try {
    template = fs.readFileSync(path.join(process.cwd(), 'profile-view', 'template.html'), 'utf8');
  } catch (e) {
    console.error('Gagal baca template profil:', e.message);
    return res.status(500).send('Gagal memuat halaman profil.');
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
