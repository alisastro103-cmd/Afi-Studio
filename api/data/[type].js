// api/data/[type].js
// Satu endpoint buat semua koleksi data (models, videos, banner, marquee, member, ranking).
//
// GET  /api/data/:type   -> publik, dipakai halaman web utama buat nampilin data.
// POST /api/data/:type   -> khusus admin panel, wajib header "x-admin-token".
//
// Sumber data utama: Upstash Redis (key-value, 1 key = 1 koleksi, isinya JSON apa adanya).
// Kalau Redis belum ada isinya (belum di-seed) atau lagi down, GET akan fallback
// baca file JSON statis yang masih ada di repo (Models/models.json, videos.json, dst)
// supaya web utama TETAP JALAN walau database belum disiapkan / lagi bermasalah.

import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

// Daftar koleksi yang valid. Tambah baris baru di sini kalau nanti ada section baru.
const TYPES = {
  models:     { redisKey: 'afi-studio:data:models',     file: 'Models/models.json' },
  videos:     { redisKey: 'afi-studio:data:videos',     file: 'videos.json' },
  banner:     { redisKey: 'afi-studio:data:banner',     file: 'banner.json' },
  marquee:    { redisKey: 'afi-studio:data:marquee',    file: 'marquee.json' },
  member:     { redisKey: 'afi-studio:data:member',     file: 'member-Afi-Studio/member.json' },
  ranking:    { redisKey: 'afi-studio:data:ranking',    file: 'ranking/ranking.json' },
  categories: { redisKey: 'afi-studio:data:categories', file: 'categories.json' },
  appcategories: { redisKey: 'afi-studio:data:appcategories', file: 'app-categories.json' },
  settings:   { redisKey: 'afi-studio:data:settings',   file: 'settings.json' },
};

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

function readFallbackFile(relativeFile) {
  try {
    const fullPath = path.join(process.cwd(), relativeFile);
    return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  } catch (e) {
    console.error(`Gagal baca fallback file ${relativeFile}:`, e.message);
    return null;
  }
}

export default async function handler(req, res) {
  const { type } = req.query;
  const meta = TYPES[type];

  if (!meta) {
    return res.status(404).json({ error: `Tipe data "${type}" tidak dikenal.` });
  }

  // ============== GET (publik, dipakai web utama) ==============
  if (req.method === 'GET') {
    if (redis) {
      try {
        const cached = await redis.get(meta.redisKey);
        if (cached !== null && cached !== undefined) {
          res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
          return res.status(200).json(cached);
        }
      } catch (e) {
        console.error(`Redis GET gagal untuk "${type}", fallback ke file JSON:`, e.message);
      }
    }
    const fallback = readFallbackFile(meta.file);
    if (fallback !== null) {
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      return res.status(200).json(fallback);
    }
    return res.status(500).json({ error: 'Data tidak tersedia: Redis kosong dan file cadangan tidak ditemukan.' });
  }

  // ============== POST (khusus admin panel) ==============
  if (req.method === 'POST') {
    if (!process.env.ADMIN_TOKEN) {
      return res.status(500).json({ error: 'Server belum dikonfigurasi: ADMIN_TOKEN kosong.' });
    }
    const token = req.headers['x-admin-token'];
    if (!token || token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Token admin salah atau belum login.' });
    }
    if (!redis) {
      return res.status(500).json({ error: 'Server belum dikonfigurasi: UPSTASH_REDIS_REST_URL/TOKEN kosong.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Body request bukan JSON yang valid.' }); }
    }
    if (body === undefined || body === null) {
      return res.status(400).json({ error: 'Body request kosong.' });
    }

    try {
      await redis.set(meta.redisKey, body);
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error(`Redis SET gagal untuk "${type}":`, e.message);
      return res.status(500).json({ error: 'Gagal menyimpan data ke database.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method tidak diizinkan.' });
}
