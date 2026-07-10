// lib/db.js
// Koneksi ke database Turso (libSQL). Instance dibuat sekali di module
// scope supaya dipakai ulang antar-invocation selama function masih
// "warm" (sama seperti pola Ratelimit di api/feedback.js).
//
// Environment variable yang dibutuhkan (isi di Vercel > Settings > Environment Variables):
//   TURSO_DATABASE_URL   -> contoh: libsql://nama-db-username.turso.io
//   TURSO_AUTH_TOKEN     -> token dari `turso db tokens create nama-db`

import { createClient } from '@libsql/client';

let client = null;

export function getDb() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      'TURSO_DATABASE_URL atau TURSO_AUTH_TOKEN belum di-set di Environment Variables.'
    );
  }

  client = createClient({ url, authToken });
  return client;
}
