// scripts/migrate-to-turso.js
// Jalankan sekali di Termux setelah TURSO_DATABASE_URL & TURSO_AUTH_TOKEN
// sudah di-set, buat mindahin isi models.json + member.json yang lama
// ke database Turso. Aman dijalankan berkali-kali (tidak bikin duplikat
// selama tabel masih kosong saat pertama kali dijalankan).
//
// Cara pakai:
//   export TURSO_DATABASE_URL="libsql://xxxx.turso.io"
//   export TURSO_AUTH_TOKEN="xxxx"
//   node scripts/migrate-to-turso.js

import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error('TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN wajib di-set sebagai environment variable dulu.');
  process.exit(1);
}

const db = createClient({ url, authToken });

async function ensureSchema() {
  const schemaSql = fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf-8');
  const statements = schemaSql.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
  console.log('✓ Skema tabel siap.');
}

async function migrateModels() {
  const filePath = path.join(root, 'Models/models.json');
  if (!fs.existsSync(filePath)) {
    console.log('⚠ Models/models.json tidak ditemukan, lewati.');
    return;
  }
  const models = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const existing = await db.execute('SELECT COUNT(*) as c FROM models');
  if (Number(existing.rows[0].c) > 0) {
    console.log('⚠ Tabel models sudah berisi data, migrasi models.json dilewati (biar tidak dobel).');
    return;
  }

  for (const m of models) {
    const category = Array.isArray(m.category) ? m.category.join(',') : (m.category || '');
    await db.execute({
      sql: `INSERT INTO models (name, caption, creator, converter, category, thumb, link)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [m.name || '', m.caption || '', m.creator || '', m.converter || '', category, m.thumb || '', m.link || ''],
    });
  }
  console.log(`✓ ${models.length} model dipindahkan ke database.`);
}

async function migrateMembers() {
  const filePath = path.join(root, 'member-Afi-Studio/member.json');
  if (!fs.existsSync(filePath)) {
    console.log('⚠ member-Afi-Studio/member.json tidak ditemukan, lewati.');
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const existing = await db.execute('SELECT COUNT(*) as c FROM members');
  if (Number(existing.rows[0].c) > 0) {
    console.log('⚠ Tabel members sudah berisi data, migrasi member.json dilewati (biar tidak dobel).');
    return;
  }

  let total = 0;
  // data berbentuk { "gen-1": [...], "gen-2": [...] }
  for (const groupKey of Object.keys(data)) {
    const groupMembers = data[groupKey];
    if (!Array.isArray(groupMembers)) continue;
    for (const m of groupMembers) {
      await db.execute({
        sql: `INSERT INTO members (gen_id, nama, foto, spesialis, identitas, generasi, socials)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          groupKey, // "gen-1", "gen-2", "gen-3", "orang-random", dst — dipertahankan persis dari key JSON asli
          m.nama || '',
          m.foto || '',
          m.spesialis || '',
          m.identitas || '',
          m.generasi || '',
          JSON.stringify(m.socials || {}),
        ],
      });
      total++;
    }
  }
  console.log(`✓ ${total} member dipindahkan ke database.`);
}

(async () => {
  await ensureSchema();
  await migrateModels();
  await migrateMembers();
  console.log('Migrasi selesai.');
})();
