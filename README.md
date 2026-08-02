# Afi Studio

Website komunitas berbagi aset Minecraft (model 3D, rig, map, furniture) buatan komunitas Afi Studio. Frontend statis (HTML/CSS/JS vanilla, tanpa framework/build step untuk JS) yang datanya disimpan di **Upstash Redis** lewat serverless API, dengan **admin panel** (`/admin`) untuk kelola semua konten tanpa perlu edit file/`git push` manual.

🔗 **Live:** [afi-studio.vercel.app](https://afi-studio.vercel.app)
📘 Penjelasan lengkap non-teknis + konteks pengembangan (struktur file, alur kerja tiap fitur, cara pakai admin panel, rencana ke depan) ada di **`PANDUAN-PROYEK.md`**. Dokumen ini fokus ke sisi teknis ringkas untuk siapapun yang mau ubah kode.

---

## 1. Cara Kerja (Mekanisme)

Tiap halaman publik adalah file HTML mandiri yang saat dibuka browser, `fetch()` datanya dari endpoint `GET /api/data/:type`, lalu render kartu/list-nya lewat JavaScript vanilla di client.

```
Browser buka /Models/  →  Models/script.js fetch("/api/data/models")
                       →  api/data/[type].js baca dari Upstash Redis
                       →  (kalau Redis kosong/down) fallback baca Models/models.json di repo
                       →  data di-render jadi kartu HTML di client
                       →  filter kategori & pencarian jalan di client (tidak ada request tambahan)
```

Admin mengelola semua konten lewat `/admin` (panel terpisah, bukan bagian dari web utama):

```
Admin login di /admin (token) →  panel.html kirim POST /api/data/:type (header x-admin-token)
                               →  api/data/[type].js verifikasi token, lalu redis.set(key, body)
                               →  Web utama otomatis kebaca data terbaru (cache pendek 30 detik)
```

Form Feedback juga lewat satu serverless function (`api/feedback.js`) untuk kirim pesan ke Telegram.

Konsekuensinya:
- Nambah/ubah konten sehari-hari = lewat `/admin`, tidak perlu sentuh kode atau `git push`.
- File `.json` di repo (`Models/models.json`, `videos.json`, dll) **tetap dipertahankan** sebagai cadangan darurat kalau Redis kosong/bermasalah — bukan lagi sumber data utama.
- Edit file `.json` manual masih bisa dipakai untuk isi awal (`npm run seed`), tapi setelah admin panel dipakai, editan manual di file JSON **tidak otomatis** masuk ke Redis.

## 2. Peta Halaman & Sumber Data

| Halaman | File utama | Sumber data (live) | Catatan |
|---|---|---|---|
| `/` (Beranda) | `index.html` (HTML+CSS+JS inline) | `GET /api/data/videos` (sample) | Nav, banner slider, marquee, carousel video, footer |
| `/Models/` | `Models/index.html` + `Models/script.js` | `GET /api/data/models`, `categories`, `appcategories`, `marquee`, `banner` | Filter kategori & aplikasi, pencarian, modal detail |
| `/tutorial/` | `tutorial/index.html` + `tutorial/script.js` | `GET /api/data/videos` | Pencarian judul, badge "Baru" (14 hari), video populer (`localStorage`, per-device) |
| `/member-Afi-Studio/` | `member-Afi-Studio/index.html` + `script.js` | `GET /api/data/member` | Grup generasi (`gen-1`/`gen-2`/`gen-3`/`orang-random`) otomatis dari `gen_id` |
| `/ranking/` | `ranking/index.html` | `GET /api/data/ranking` | Top 3 + Top 10, lightbox |
| `/favorit/` | `favorit/index.html` + `script.js` | `GET /api/data/videos` + `models` (disaring pakai id tersimpan) | Video/model yang ditandai favorit, disimpan `localStorage` per-device (`favorites.js`) |
| `/event/` | `event/index.html` | — | Halaman statis, aturan event |
| `/bantuan/` | `bantuan/index.html` | — | FAQ statis |
| `/feedback/` | `feedback/index.html` + `api/feedback.js` | — | Kirim pesan ke Telegram |
| `/admin/` | `admin/index.html` (login) + `admin/panel.html` (dashboard CRUD) | Semua `/api/data/:type` via `GET`+`POST` | Login token, kelola semua koleksi data di atas + Banner, Marquee, Pengaturan |

## 3. API & Backend

| Endpoint | Fungsi |
|---|---|
| `GET /api/data/:type` | Publik. Baca satu koleksi data dari Redis (fallback ke file JSON kalau Redis kosong/down). `type` valid: `models`, `videos`, `banner`, `marquee`, `member`, `ranking`, `categories`, `appcategories`, `settings` |
| `POST /api/data/:type` | Khusus admin. Wajib header `x-admin-token` cocok dengan `ADMIN_TOKEN`. Menimpa seluruh isi koleksi tersebut di Redis dengan body request |
| `POST /api/admin/verify` | Dipakai layar login admin, cek token yang diketik cocok dengan `ADMIN_TOKEN` atau tidak |
| `POST /api/feedback` | Kirim pesan form Feedback ke Telegram (rate-limit Upstash + reCAPTCHA) |

Semua endpoint di atas adalah Vercel Serverless Functions (`api/**/*.js`), jalan otomatis saat deploy, tidak perlu server terpisah.

## 4. File/Source Penting

| File | Peran |
|---|---|
| `api/data/[type].js` | Satu endpoint generik untuk semua koleksi data (GET publik, POST khusus admin) — baca/tulis Upstash Redis, fallback baca file JSON kalau Redis kosong |
| `api/admin/verify.js` | Cek token login admin panel |
| `api/feedback.js` | Kirim form feedback ke Telegram (rate-limit Upstash + reCAPTCHA) |
| `admin/index.html` | Layar login admin — simpan token di `sessionStorage` (bukan `localStorage`, jadi hilang saat tab ditutup) |
| `admin/panel.html` | Dashboard admin: sidebar per koleksi (Models, Kategori, Video, Banner, Marquee, Member, Ranking, Event, Feedback, Pengaturan), tabel/kartu dengan resize kolom, CRUD lewat modal, semua perubahan langsung `POST` ke Redis |
| `scripts/seed-redis.mjs` | Isi awal Redis dari file `.json` yang ada di repo (jalan sekali di awal, lihat `SETUP-ADMIN-DATABASE.md`) |
| `scripts/export-redis.mjs` | Kebalikannya — tarik isi Redis saat ini balik jadi file `.json` (backup manual) |
| `Models/models.json`, `member-Afi-Studio/member.json`, `videos.json`, `banner.json`, `marquee.json`, `ranking/ranking.json`, `categories.json`, `app-categories.json`, `settings.json` | Cadangan/fallback tiap koleksi data — bukan sumber utama lagi, tapi jangan dihapus |
| `data.schema.md` | Dokumentasi field wajib di tiap file JSON — tetap relevan sebagai referensi struktur data |
| `validate_data.py` | Cek format `videos.json`/`models.json` (dipakai sebelum `npm run seed`) |
| `config.js` | Toggle jalur pendaftaran Model 3D & Member — nilainya diambil dari `/api/data/settings` (diatur di menu Pengaturan admin), bukan diedit manual lagi |
| `favorites.js` | Sistem favorit (`localStorage`, per-device) — dipakai oleh `Models/script.js`, `tutorial/script.js`, dan `/favorit/` |
| `theme-toggle.js` | Logic tema gelap/terang + persist pilihan user |
| `sw.js` + `manifest.json` | Service worker & config PWA — hanya halaman root (`/`) yang di-cache untuk mode offline |
| `src/input.css` → `dist/output.css` | Source Tailwind web utama → hasil compile |
| `admin/src/input.css` → `admin/dist/output.css` | Source Tailwind admin panel (terpisah dari web utama) |
| `tailwind.config.js` / `admin/tailwind.config.js` | Daftar file yang di-scan Tailwind (pastikan semua halaman yang pakai `output.css` masing-masing masuk daftar `content`) |
| `fonts/fonts.css` | Font self-hosted (Outfit, DM Sans, Dancing Script) — tidak ada request ke Google Fonts CDN |
| `vercel.json` | Aturan `Cache-Control` per jenis file |

## 5. Struktur Direktori

```
Afi-Studio-main/
├── index.html                     ← Beranda
├── config.js, theme-toggle.js, favorites.js
├── data.schema.md, validate_data.py
├── vercel.json, tailwind.config.js
├── src/input.css → dist/output.css
├── manifest.json, sw.js           ← PWA & offline cache
├── *.json                         ← Cadangan/fallback tiap koleksi data
├── Models/            (index.html, script.js, models.json)
├── tutorial/           (index.html, script.js)
├── member-Afi-Studio/ (index.html, script.js, member.json, profile/)
├── ranking/            (index.html, ranking.json, coming_soon.webp)
├── favorit/            (index.html, script.js)
├── event/, bantuan/, feedback/    (statis / form)
├── admin/
│   ├── index.html                 ← Login (token → sessionStorage)
│   ├── panel.html                 ← Dashboard CRUD semua koleksi
│   ├── src/input.css → dist/output.css   ← Tailwind khusus admin
│   ├── fonts/, icons/             ← Aset khusus admin
├── api/
│   ├── data/[type].js             ← GET/POST semua koleksi (Redis + fallback JSON)
│   ├── admin/verify.js            ← Verifikasi token login
│   └── feedback.js                ← Serverless function → Telegram
├── scripts/
│   ├── seed-redis.mjs             ← Isi awal Redis dari file JSON
│   └── export-redis.mjs           ← Backup Redis → file JSON
├── fonts/, icons/                 ← Font & ikon self-hosted web utama
└── robots.txt, sitemap.xml
```

## 6. Cara Nambah/Update Konten

**Sehari-hari (disarankan):** login `/admin` → pilih menu koleksi → tambah/edit/hapus lewat form → tersimpan otomatis ke Redis, muncul di web dalam ~30 detik.

**Manual (darurat/isi awal saja):**
1. Edit file JSON yang relevan.
2. Validasi: `python3 validate_data.py` (models/videos) atau `python3 -m json.tool <file>.json` (lainnya).
3. `git add -A && git commit -m "pesan" && git push`.
4. Kalau mau editan ini juga masuk Redis (bukan cuma jadi fallback), jalankan ulang `npm run seed` — **hati-hati**, ini menimpa data Redis yang mungkin sudah diubah lewat admin panel.

Detail wajib per field ada di `data.schema.md`.

## 7. Menjalankan Secara Lokal

```bash
git clone https://github.com/username/Afi-Studio-main.git
cd Afi-Studio-main
npm install
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
npx tailwindcss -i ./admin/src/input.css -o ./admin/dist/output.css --minify
python3 -m http.server 8080
```
Buka `http://localhost:8080`. Untuk tes API (`/api/data/*`, `/admin`, form feedback), pakai Vercel CLI:
```bash
npm install -g vercel
vercel dev
```

## 8. Keamanan

- Kredensial (`TELEGRAM_BOT_TOKEN`, `RECAPTCHA_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_TOKEN`) disimpan sebagai Environment Variable di Vercel — **jangan pernah** ditulis langsung di kode.
- Login admin pakai **satu token rahasia** (bukan akun/password banyak orang), dicek server-side di `api/admin/verify.js` dan `api/data/[type].js` (header `x-admin-token`). Token disimpan di `sessionStorage` browser (hilang saat tab ditutup), bukan `localStorage`.
- `POST /api/data/:type` (tulis data) selalu menolak request tanpa header `x-admin-token` yang cocok — `GET` (baca) tetap publik/tanpa autentikasi karena memang untuk ditampilkan ke pengunjung.
- `.gitignore` mencegah `node_modules/`, `.env`, `.vercel` ter-commit — jangan dihapus.
- `validate_data.py` boleh ada di mana saja di root, **kecuali di dalam `api/`** — Vercel otomatis menjalankan apapun di `api/` sebagai serverless function.

## 9. Kontribusi & Lisensi

Ada model/rig/map buatan sendiri untuk dibagikan, atau nemu bug? Hubungi tim lewat halaman **Feedback** di situs, atau media sosial di halaman Member. Hak cipta tiap aset ada di masing-masing kreator/converter yang tercantum di setiap item.

---
© 2026 Afi Studio
