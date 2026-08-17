# Cara pakai

Extract lalu TIMPA ke folder yang sama di repo `Afi-Studio-main`. 15 file:

```
vercel.json
lib/admin-auth.js                    (BARU)
api/model-submit.js
api/telegram-webhook.js
api/data/[type].js
api/survey-results.js
api/admin/telegram-file.js
api/admin/invite-create.js           (BARU)
api/admin/invite-redeem.js           (BARU)
api/admin/session-list.js            (BARU)
api/admin/session-revoke.js          (BARU)
api/admin/whoami.js                  (BARU)
api/admin/logout.js                  (BARU)
admin/index.html
admin/panel.html
```

---

## POIN 1 — Upload & Pendaftaran Model ✅

**Bukan bug logic, tapi function-nya kelamaan jalan lalu dimatiin paksa
Vercel** sebelum sempat balikin respons. Plan Hobby cuma kasih 10 detik per
function, dan gak ada `maxDuration` di-set — sementara `model-submit.js`
punya rentetan panggilan network berurutan (rate limit → validasi
thumbnail → reCAPTCHA → 3x panggilan Telegram) yang gampang numpuk lewat 10
detik, apalagi dari koneksi HP. Pas Vercel motong paksa, koneksi ke browser
putus tanpa respons yang bener → itulah "Failed to fetch".

Perbaikan:
1. `vercel.json` — nambahin `maxDuration: 30` buat `model-submit.js`,
   `feedback.js`, `survey-submit.js`
2. Thumbnail & file model dikirim ke Telegram **bareng-bareng**
   (`Promise.allSettled`), bukan gantian nunggu satu-satu
3. Semua panggilan ke Telegram & Google reCAPTCHA sekarang punya timeout
   eksplisit — kalau ada yang lambat, errornya jelas, bukan raw network
   failure

Soal thumbnail dikirim sebagai Photo bukan Document — itu udah bener kok
sebagai Document dari sononya, sempat aku cek ulang kodenya.

---

## POIN 2 — Multi-Admin Website ✅

### A. Admin Telegram dicabut total
`/addadmin`, `/join`, `/admins`, daftar admin di Redis — semua kehapus.
Bot Telegram sekarang cuma bisa dipakai OWNER (chat_id di
`TELEGRAM_CHAT_ID`), titik. Daftar command turun dari 19 → 16.

### B. Sistem invite buat Admin Panel Website (BARU)

**Alurnya:**
1. Owner login pakai token seperti biasa, buka menu baru **"Kelola Admin"**
   di sidebar (cuma muncul buat owner)
2. Isi nama admin + pilih durasi (1 hari / 7 hari / 30 hari / Permanent),
   tekan "Generate Kode Undangan" → keluar kode 8 karakter
3. Kode itu dikirim manual ke admin baru (WhatsApp/Telegram/dll)
4. Admin baru buka `/admin/index.html`, klik **"Punya Kode Undangan?"**,
   masukkan kode → langsung masuk ke panel
5. Aksesnya dikunci ke device itu doang lewat **cookie HTTP-Only** (gak
   kebaca/kecopy dari JavaScript, browser yang otomatis nyertain tiap
   request) — kode sendiri **sekali pakai**, begitu di-redeem langsung
   hangus dari database (pakai `GETDEL` Redis, atomik, gak ada celah kepakai
   2x meski di-double-klik)
6. Kalau durasi abis, cookie-nya otomatis ilang dari browser (Max-Age) DAN
   sesinya juga otomatis kehapus dari Redis (TTL) — begitu itu kejadian,
   panel bakal minta login ulang otomatis di request berikutnya
7. Owner bisa liat semua admin aktif di section yang sama, dan cabut akses
   kapan aja lewat tombol "Cabut" — langsung keputus saat itu juga

**Kejujuran soal keamanan:** cookie HTTP-Only emang gak bisa dibaca lewat
JavaScript biasa (jadi gak bisa "dicopy-paste" gampang kayak token teks),
tapi ini bukan jaminan 100% mutlak — orang yang PUNYA AKSES FISIK ke device
itu & paham banget teknis (buka DevTools browser desktop) SECARA TEORI masih
bisa liat isi cookie. Gak ada sistem otorisasi web manapun yang bener-bener
kebal dari itu selama sesinya masih hidup. Yang penting: gak bisa
dicopy-paste sembarangan kayak token teks biasa, dan owner selalu bisa cabut
akses kapan aja dari panel.

**Endpoint baru yang dipakai:**
- `POST /api/admin/invite-create` — owner bikin kode (butuh token owner)
- `POST /api/admin/invite-redeem` — publik, kode → cookie sesi
- `GET /api/admin/session-list` — owner liat daftar admin aktif
- `POST /api/admin/session-revoke` — owner cabut 1 sesi
- `GET /api/admin/whoami` — dipanggil pas panel dibuka, cek sesi cookie
  masih valid apa nggak (biar gak perlu login ulang tiap buka)
- `POST /api/admin/logout` — hapus cookie + sesi Redis

Endpoint lama (`api/data/[type].js`, `api/survey-results.js`,
`api/admin/telegram-file.js`) sekarang nerima DUA jalur: token owner (`x-admin-token`
header, seperti biasa) ATAU cookie sesi admin undangan — jalur owner
gak berubah sama sekali, murni ditambahin jalur baru.

**Gak ada env var baru yang perlu ditambahin** — semuanya jalan pakai
`ADMIN_TOKEN` dan Upstash Redis yang udah ada.

---

## Setelah upload

1. `git add . && git commit -m "..." && git push`
   (kalau ditolak: `git pull --rebase origin main` dulu, baru push lagi)
2. Tunggu Vercel deploy
3. **Test poin 1**: coba daftar model beneran (link mode & upload mode),
   pastiin gak ada lagi "Failed to fetch"
4. **Test poin 2**:
   - Buka `/admin/panel.html`, cek menu "Kelola Admin" muncul di sidebar
   - Generate 1 kode test, buka tab **Incognito/browser lain**, redeem
     kode itu di `/admin/index.html` → pastiin langsung masuk ke panel
   - Cek di "Kelola Admin" (browser owner), admin barusan muncul di daftar
   - Coba cabut aksesnya, terus di tab incognito tadi refresh/klik apa aja
     → harus kelempar balik ke login
5. Ketik command apapun ke bot Telegram, cek `/` — harusnya 16 command aja
   (broadcast & admin Telegram udah gak ada)
