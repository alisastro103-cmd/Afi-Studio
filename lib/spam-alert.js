// lib/spam-alert.js
// Helper kecil buat ngirim notif ke Telegram admin kalau rate limit di salah
// satu form publik (feedback, daftar model, survey) kena — itu indikasi ada
// yang spam/nge-bot form tersebut.
//
// Dipakai fire-and-forget (gak di-await sampe selesai) di titik "return 429"
// masing-masing endpoint, supaya gak nambah latency ke response user.
//
// Ada cooldown 10 menit per (endpoint + IP) lewat Redis SET...NX, biar admin
// gak dibanjirin notif kalau 1 IP nyerang berkali-kali dalam waktu singkat —
// cukup dikasih tau sekali per 10 menit per sumber.

export async function alertRateLimitHit(redis, endpointLabel, ip) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return;

  try {
    if (redis) {
      const cooldownKey = `afi-studio:alertcooldown:${endpointLabel}:${ip}`;
      // nx: true -> cuma "set" kalau key belum ada. ex: 600 -> auto-hapus abis 10 menit.
      const wasSet = await redis.set(cooldownKey, '1', { nx: true, ex: 600 });
      if (!wasSet) return; // udah pernah alert buat kombinasi ini baru-baru ini, skip
    }

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        parse_mode: 'HTML',
        text:
          `⚠️ <b>Rate limit kena</b>\n\n` +
          `Endpoint: <code>${endpointLabel}</code>\n` +
          `IP: <code>${ip}</code>\n\n` +
          `Kemungkinan spam/bot lagi nyerang form ini. Kalau notif ini muncul terus-terusan ` +
          `dalam waktu berdekatan (beda IP juga), pertimbangin turunin limit reCAPTCHA atau ` +
          `blokir IP-nya manual.`,
      }),
    });
  } catch (e) {
    // Jangan sampai kegagalan kirim alert bikin request utama ikut gagal.
    console.error('Gagal kirim alert spam ke Telegram:', e.message);
  }
}
