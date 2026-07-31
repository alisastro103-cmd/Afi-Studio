import { Redis } from '@upstash/redis';
import fs from 'fs/promises';

const redis = Redis.fromEnv();

const keys = [
  { key: 'afi-studio:data:models', file: 'Models/models.json' },
  { key: 'afi-studio:data:videos', file: 'videos.json' },
  { key: 'afi-studio:data:banner', file: 'banner.json' },
  { key: 'afi-studio:data:marquee', file: 'marquee.json' },
  { key: 'afi-studio:data:member', file: 'member-Afi-Studio/member.json' },
  { key: 'afi-studio:data:ranking', file: 'ranking/ranking.json' },
];

async function main() {
  console.log('Mengambil data dari Redis...');
  for (const item of keys) {
    const data = await redis.get(item.key);
    if (data) {
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      await fs.writeFile(item.file, content, 'utf-8');
      console.log(`✅ Berhasil backup dari Redis ke ${item.file}`);
    } else {
      console.log(`⚠️ Data untuk ${item.key} kosong di Redis.`);
    }
  }
  console.log('\nSelesai! Semua file JSON di lokal sudah ter-update dengan data dari Redis.');
}

main().catch(console.error);
