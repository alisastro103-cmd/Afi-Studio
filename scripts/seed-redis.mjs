// scripts/seed-redis.mjs
//
// Jalanin SEKALI aja buat mindahin data JSON yang sudah ada (Models/models.json,
// videos.json, dst) ke Upstash Redis, supaya database punya isi awal yang sama
// persis kayak yang sekarang tayang di web.
//
// Cara pakai di Termux:
//   1. export UPSTASH_REDIS_REST_URL="isi-dari-dashboard-upstash"
//   2. export UPSTASH_REDIS_REST_TOKEN="isi-dari-dashboard-upstash"
//   3. node scripts/seed-redis.mjs
//
// Aman dijalankan berkali-kali (akan menimpa isi Redis dengan isi file JSON
// terbaru) — tapi hati-hati: kalau kamu sudah edit data lewat admin panel,
// jangan jalanin ulang script ini, karena editanmu di Redis bakal ketimpa
// balik sama isi file JSON lokal yang lama.

import fs from 'fs';
import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('❌ UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN belum di-export. Set dulu env var-nya sebelum jalanin script ini.');
  process.exit(1);
}

const redis = Redis.fromEnv();

const SOURCES = {
  'afi-studio:data:models':  'Models/models.json',
  'afi-studio:data:videos':  'videos.json',
  'afi-studio:data:banner':  'banner.json',
  'afi-studio:data:marquee': 'marquee.json',
  'afi-studio:data:member':  'member-Afi-Studio/member.json',
  'afi-studio:data:ranking': 'ranking/ranking.json',
  'afi-studio:data:categories': 'categories.json',
};

async function main() {
  for (const [redisKey, file] of Object.entries(SOURCES)) {
    if (!fs.existsSync(file)) {
      console.warn(`⚠️  Lewati ${redisKey}: file ${file} tidak ditemukan.`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    await redis.set(redisKey, data);
    const count = Array.isArray(data) ? `${data.length} item` : `${Object.keys(data).length} entri`;
    console.log(`✅ ${redisKey} <- ${file} (${count})`);
  }
  console.log('\nSelesai. Semua data awal sudah masuk ke Redis.');
}

main().catch(err => {
  console.error('❌ Gagal seeding:', err);
  process.exit(1);
});
