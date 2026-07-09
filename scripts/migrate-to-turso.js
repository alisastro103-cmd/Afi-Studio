// Helper untuk mengirim query SQL langsung ke server Turso lewat HTTP REST API
async function executeTurso(statements) {
  const requests = statements.map(st => {
    if (typeof st === 'string') {
      return { 
        type: "execute", 
        stmt: { q: st } 
      };
    }
    return { 
      type: "execute", 
      stmt: { q: st.sql, params: st.args } 
    };
  });

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
  
  // Cek apakah ada error di dalam pipeline eksekusi database
  if (data.results && data.results[0] && data.results[0].error) {
    throw new Error(`SQL Error: ${data.results[0].error.message}`);
  }
  
  // Format output agar mirip dengan struktur library asli yang dipakai script lama
  const target = data.results?.[0]?.response?.result;
  if (target && target.rows && target.rows.length > 0) {
    const rows = target.rows.map(row => {
      const obj = {};
      target.cols.forEach((col, idx) => {
        // Ambil nilai asli dari object data Turso ( Turso membungkus nilai dalam { type: '...', value: '...' } )
        obj[col.name] = row[idx] && typeof row[idx] === 'object' ? row[idx].value : row[idx];
      });
      return obj;
    });
    return { rows };
  }
  return { rows: [] };
}
