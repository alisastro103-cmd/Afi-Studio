import fs from 'fs';

let url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (url && url.startsWith('libsql://')) {
  url = url.replace('libsql://', 'https://');
}

if (!url || !authToken) {
  console.error("❌ Error: TURSO_DATABASE_URL atau TURSO_AUTH_TOKEN belum terpasang di Termux.");
  process.exit(1);
}

async function cekSkema() {
  try {
    console.log("⏳ Menghubungi Turso untuk mengecek kolom tabel members...");
    const res = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{ type: "execute", stmt: { sql: "PRAGMA table_info(members);" } }]
      })
    });

    if (!res.ok) {
      throw new Error(`Turso Error: ${await res.text()}`);
    }

    const data = await res.json();
    const rows = data.results?.[0]?.response?.result?.rows;

    if (!rows || rows.length === 0) {
      console.log("❌ Tabel 'members' tidak ditemukan atau kosong.");
      return;
    }

    console.log("\n📋 KOLOM ASLI TABEL MEMBERS DI TURSO SEKARANG:");
    console.log("--------------------------------------------");
    rows.forEach(row => {
      // row[1] adalah nama kolom, row[2] adalah tipe data
      console.log(`🔹 Nama Kolom: ${row[1].value} (${row[2].value})`);
    });
    console.log("--------------------------------------------");

  } catch (err) {
    console.error("❌ Gagal mengambil skema:", err.message);
  }
}

cekSkema();
