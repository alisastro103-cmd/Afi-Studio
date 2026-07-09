// lib/db.js
// Koneksi ke database Turso via HTTP REST API (fetch).
// Kompatibel 100% dengan lingkungan Vercel Serverless & Termux Android.

let url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (url && url.startsWith('libsql://')) {
  url = url.replace('libsql://', 'https://');
}

export function getDb() {
  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL atau TURSO_AUTH_TOKEN belum di-set di Environment Variables.');
  }

  // Mengembalikan object tiruan yang memiliki method .execute() agar pas dengan kode api/models.js dan api/members.js
  return {
    async execute(st) {
      const requests = [];
      if (typeof st === 'string') {
        requests.push({ type: "execute", stmt: { q: st } });
      } else {
        requests.push({ type: "execute", stmt: { q: st.sql, params: st.args } });
      }

      const res = await fetch(`${url}/v2/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Turso API Error: ${errText}`);
      }

      const data = await res.json();
      
      if (data.results && data.results[0] && data.results[0].error) {
        throw new Error(`SQL Error: ${data.results[0].error.message}`);
      }
      
      const target = data.results?.[0]?.response?.result;
      if (target && target.rows) {
        const rows = target.rows.map(row => {
          const obj = {};
          target.cols.forEach((col, idx) => {
            obj[col.name] = row[idx] && typeof row[idx] === 'object' ? row[idx].value : row[idx];
          });
          return obj;
        });
        return { rows, lastInsertRowid: target.last_insert_rowid };
      }
      return { rows: [], lastInsertRowid: null };
    }
  };
}
