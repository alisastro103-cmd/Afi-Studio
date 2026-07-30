# Panduan Sambungin Admin Panel + Database + Web Utama

Ini penjelasan apa yang sudah dibenerin/dibuatin, dan langkah yang masih
perlu **kamu** kerjakan sendiri (isi env var, seed data). Kalau mau minta
tolong Gemini buat eksekusi langkah CLI-nya di Termux, tinggal kasih lihat
file ini ke dia.

## Yang dipakai

- **Database:** Upstash Redis — **sudah punya**, sudah kepakai buat rate
  limit di `api/feedback.js`. Nggak perlu daftar layanan baru, tinggal
  reuse akun Upstash yang sama (atau bikin database Redis baru di project
  Upstash yang sama kalau mau dipisah dari yang buat rate-limit).
- **Backend:** Vercel Serverless Functions (`api/data/[type].js`,
  `api/admin/verify.js`) — jalan otomatis begitu di-deploy ke Vercel,
  nggak perlu server terpisah.
- **Admin panel:** `/admin` — sekarang butuh login token, dan datanya
  kebaca/kesimpen ke Redis lewat API di atas (bukan lagi in-memory doang).

## Apa yang berubah dari sebelumnya

1. **Admin panel dipindah ke folder `/admin`** — biar nggak tabrakan nama
   file (`index.html`, `favicon.png`, `fonts/`, dll) sama web utama.
2. **Admin panel sekarang beneran nyimpen data**, lewat `POST /api/data/:type`,
   bukan cuma di memory browser yang ilang pas refresh.
3. **Skema Member dibenerin** — form admin sekarang punya field Sosial
   Media (YouTube/IG/FB/TikTok/WA/Discord) dan nyimpen Info jadi `Info-1`,
   `Info-2`, dst — sama persis kayak format yang dipakai
   `member-Afi-Studio/member.json` yang asli. Sebelumnya field ini beda
   format dan field sosmed nggak ada sama sekali di form.
4. **Web utama sekarang ambil data dari `/api/data/:type`**, bukan
   langsung baca file `.json` statis. File JSON lama (`Models/models.json`,
   `videos.json`, dll) **tetap dibiarkan ada** di repo — dipakai otomatis
   sebagai cadangan kalau Redis kosong/lagi down, jadi web nggak bakal
   mati total kalau ada masalah di database.
5. **Login admin panel** pakai 1 token rahasia (bukan akun/password
   banyak orang) — cukup buat kamu sendiri yang pegang.

## Langkah yang harus kamu jalanin

### 1. Set Environment Variable di Vercel
Buka **Vercel Dashboard → Project → Settings → Environment Variables**,
tambahin (kalau `UPSTASH_REDIS_REST_URL`/`TOKEN` sudah ada dari sebelumnya,
biarin, cuma tambah yang baru):

| Nama | Isi |
|---|---|
| `UPSTASH_REDIS_REST_URL` | dari dashboard Upstash (mestinya udah ada) |
| `UPSTASH_REDIS_REST_TOKEN` | dari dashboard Upstash (mestinya udah ada) |
| `ADMIN_TOKEN` | **baru** — password panjang buat login `/admin`, bebas kamu tentuin |

Lihat `.env.example` buat daftar lengkap semua env var yang dipakai project ini.

### 2. Seed data awal ke Redis (sekali aja)
Di Termux, dari folder root project:
```bash
export UPSTASH_REDIS_REST_URL="isi dari dashboard Upstash"
export UPSTASH_REDIS_REST_TOKEN="isi dari dashboard Upstash"
npm install
npm run seed
```
Ini bakal mindahin isi `Models/models.json`, `videos.json`, `banner.json`,
`marquee.json`, `member-Afi-Studio/member.json`, `ranking/ranking.json`
ke Redis apa adanya, jadi database mulai dari data yang sekarang udah
tayang — bukan mulai dari kosong.

⚠️ **Jangan jalanin `npm run seed` lagi setelah kamu mulai edit data lewat
admin panel** — soalnya itu bakal nimpa balik data di Redis pakai isi file
JSON lokal yang lama.

### 3. Deploy & Test
```bash
git add .
git commit -m "Sambungin admin panel + database"
git push
```
Setelah Vercel selesai deploy:
- Buka `https://domainkamu.vercel.app/admin` → login pakai `ADMIN_TOKEN`.
- Coba tambah/edit 1 data (misal 1 marquee text) → cek apakah muncul di
  web utama setelah refresh.
- Kalau ada error, buka Vercel → Deployments → Logs, biasanya pesan
  error-nya udah dalam Bahasa Indonesia (aku bikin custom).

## Kalau mau konsultasi ke Gemini
Kasih lihat dia file ini + folder `api/`, `scripts/seed-redis.mjs`, dan
`admin/index.html`. Yang paling penting buat dijelasin ke dia: skema Redis
cuma **6 key**, satu per koleksi data (`afi-studio:data:models`, dst),
isinya JSON apa adanya sama persis kayak isi file `.json` yang lama — jadi
nggak ada tabel/relasi rumit, cukup key-value biasa.
