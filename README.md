# Afi Studio

Website komunitas berbagi aset Minecraft (model 3D, rig, map, furniture) buatan komunitas Afi Studio. Frontend statis (HTML/CSS/JS vanilla) + admin panel + backend serverless (Vercel Functions) + database Upstash Redis, dengan file JSON di repo sebagai fallback kalau Redis kosong/down.

🔗 **Live:** [afi-studio.vercel.app](https://afi-studio.vercel.app)
📘 Penjelasan versi santai/non-teknis + konteks pengembangan ke depan ada di **`PANDUAN-PROYEK.md`**. Dokumen ini fokus ke sisi teknis untuk siapapun yang mau ubah kode.

---

## 1. Cara Kerja (Mekanisme)

Tiap halaman publik (`/`, `/Models/`, `/tutorial/`, dst) adalah file HTML mandiri yang saat dibuka browser langsung `fetch()` endpoint `GET /api/data/:type`, lalu render kartu/list-nya lewat JavaScript vanilla (tanpa framework, tanpa build step untuk JS aplikasi — hanya Tailwind yang di-build).

```
Browser buka /Models/  →  Models/script.js fetch("/api/data/models")
                       →  api/data/[type].js baca Upstash Redis (key afi-studio:data:models)
                       →  kalau Redis kosong/down → fallback baca Models/models.json di repo
                       →  data di-render jadi kartu HTML di client
                       →  filter kategori & pencarian jalan di client (tidak ada request tambahan)
```

Admin panel (`/admin`) adalah UI terpisah untuk CRUD semua koleksi data lewat `POST /api/data/:type`, dilindungi token (`x-admin-token`), yang langsung menulis ke Redis. File JSON di repo (`Models/models.json`, `videos.json`, dll) **tidak lagi jadi sumber data utama** — statusnya sekarang cadangan/seed awal saja.

Bagian yang manggil serverless function:
- `api/feedback.js` — form Feedback → Telegram (rate-limit pakai Redis + reCAPTCHA)
- `api/admin/verify.js` — cek token login admin
- `api/data/[type].js` — GET publik (semua halaman) + POST khusus admin (baca/tulis Redis)

## 2. Peta Halaman & Peran File-nya

| Halaman | File utama | Sumber data | Catatan |
|---|---|---|---|
| `/` (Beranda) | `index.html` (HTML+CSS+JS inline) | `/api/data/models`, `/api/data/videos`, `/api/data/banner`, `/api/data/marquee` | Nav, banner slider, marquee, carousel video, footer |
| `/Models/` | `Models/index.html` + `Models/script.js` | `/api/data/models`, `/api/data/categories`, `/api/data/appcategories` | Kategori & filter aplikasi tujuan (Viontri/Prisma3D/Blender/Mine-Imator/C4D/Other) diambil otomatis dari koleksi `categories`/`appcategories`, bukan hardcode |
| `/tutorial/` | `tutorial/index.html` + `tutorial/script.js` | `/api/data/videos` | Pencarian judul, badge "Baru" (14 hari), penanda populer (`localStorage`, per-device) |
| `/member-Afi-Studio/` | `member-Afi-Studio/index.html` + `script.js` | `/api/data/member` | Grup generasi (`gen-1`/`gen-2`/`gen-3`/`orang-random`) otomatis dari `gen_id` |
| `/ranking/` | `ranking/index.html` | `/api/data/ranking` | Top 3 + Top 10, lightbox dengan caption width dihitung dari `naturalWidth`/`naturalHeight` gambar |
| `/event/` | `event/index.html` | `/api/data/event` (lewat panel Event di admin) | Aturan & konten event render |
| `/bantuan/` | `bantuan/index.html` | — | FAQ statis |
| `/feedback/` | `feedback/index.html` + `api/feedback.js` | — | Kirim pesan ke Telegram, pakai reCAPTCHA + rate-limit |
| `/admin/` | `admin/index.html` (login) + `admin/panel.html` (panel) | Semua endpoint `/api/data/:type` (GET+POST) | Lihat bagian 5 |

## 3. File/Source Penting

| File | Peran |
|---|---|
| `api/data/[type].js` | Satu endpoint dinamis untuk semua koleksi (`models`, `videos`, `banner`, `marquee`, `member`, `ranking`, `categories`, `appcategories`, `settings`). GET publik (cache singkat), POST khusus admin (tulis ke Redis). Fallback otomatis ke file JSON kalau Redis kosong/down |
| `api/admin/verify.js` | Cocokkan header `x-admin-token` dengan env `ADMIN_TOKEN`, tanpa nyimpen state apapun |
| `api/feedback.js` | Kirim form feedback ke Telegram, pakai rate-limit Upstash + reCAPTCHA |
| `admin/panel.html` | Seluruh UI & logic admin panel (CRUD tiap koleksi, drag-reorder disederhanakan jadi tap=edit/tahan=menu, resize kolom tabel, dsb) — satu file besar, vanilla JS |
| `admin/icons/lucide-local.js`, `icons/lucide-local.js` | Bundel ikon Lucide yang **di-trim manual** (bukan npm package penuh) — nambah ikon baru harus ditambahkan manual ke file ini |
| `categories.json`, `app-categories.json` | Seed awal untuk koleksi `categories`/`appcategories` di Redis — dikelola lewat tab "Kategori" di admin panel, otomatis dipropagasi ke form Model, filter chip publik, dan homepage |
| `Models/models.json`, `member-Afi-Studio/member.json`, `videos.json`, `banner.json`, `marquee.json`, `ranking/ranking.json`, `settings.json` | Seed awal / fallback tiap koleksi kalau Redis belum di-seed atau down |
| `data.schema.md` | Dokumentasi field wajib tiap koleksi data — baca dulu sebelum ubah struktur |
| `validate_data.py` | Cek format `videos.json`/`models.json` sebelum push (`python3 validate_data.py`) |
| `config.js` | Fetch `/api/data/settings` untuk tahu status buka/tutup jalur pendaftaran Model 3D & Member (diatur dari tab Pengaturan di admin panel), dengan nilai default sebagai fallback offline |
| `theme-toggle.js` | Logic tema gelap/terang + persist pilihan user |
| `sw.js` + `manifest.json` | Service worker & config PWA — hanya halaman root (`/`) yang di-cache untuk mode offline. **Penting:** tiap kali `CORE_ASSETS` di `sw.js` diubah, naikkan `CACHE_NAME` (mis. `afi-studio-root-v6` → `v7`) supaya browser pengunjung ambil cache baru, bukan versi lama yang nyangkut |
| `src/input.css` → `dist/output.css` (root & `admin/`) | Source Tailwind → hasil compile. Jalankan `npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify` tiap habis nambah class Tailwind baru |
| `tailwind.config.js` (root & `admin/`) | Daftar file yang di-scan Tailwind. **Pastikan semua halaman yang memakai `dist/output.css` masuk `content`**, kalau tidak, class yang cuma dipakai di halaman itu ke-purge dan hilang |
| `fonts/fonts.css`, `admin/fonts/fonts.css` | Font self-hosted (Outfit, DM Sans, Dancing Script) — tidak ada request ke Google Fonts CDN |
| `vercel.json` | `functions.includeFiles` (daftar file JSON fallback yang wajib ikut ke-bundle ke serverless function) + aturan `Cache-Control` per jenis file |
| `scripts/seed-redis.mjs` | Push isi file JSON di repo ke Redis (seed awal / reset data) |
| `scripts/export-redis.mjs` | Tarik isi Redis balik jadi file JSON (backup / sinkronisasi ulang ke repo) |

## 4. Struktur Direktori

```
Afi-Studio-main/
├── index.html                     ← Beranda
├── config.js                      ← Sync status jalur pendaftaran dari /api/data/settings
├── theme-toggle.js                ← Toggle tema gelap/terang
├── data.schema.md                 ← Dokumentasi format data JSON
├── validate_data.py               ← Validator videos.json & models.json
├── vercel.json                    ← includeFiles fallback + aturan cache header
├── tailwind.config.js, src/input.css, dist/output.css   ← Tailwind (web utama)
├── manifest.json, sw.js           ← Konfigurasi PWA & offline cache (versi di CACHE_NAME)
├── categories.json, app-categories.json, settings.json, banner.json, marquee.json  ← Seed/fallback koleksi
├── robots.txt, sitemap.xml        ← SEO dasar
├── api/
│   ├── data/[type].js             ← Endpoint dinamis GET/POST semua koleksi (Redis + fallback JSON)
│   ├── admin/verify.js            ← Cek token login admin
│   └── feedback.js                ← Serverless function → Telegram
├── admin/
│   ├── index.html                 ← Halaman login token admin
│   ├── panel.html                 ← UI & logic panel admin (CRUD semua koleksi)
│   ├── icons/lucide-local.js      ← Bundel ikon Lucide (trim manual)
│   ├── fonts/, dist/output.css, tailwind.config.js, src/input.css   ← Tailwind & font khusus admin
├── Models/
│   ├── index.html, script.js
│   └── models.json                ← Seed/fallback data model
├── tutorial/
│   ├── index.html, script.js
├── member-Afi-Studio/
│   ├── index.html, script.js
│   ├── member.json                ← Seed/fallback data member
│   └── profile/                   ← Foto profil (WebP)
├── ranking/
│   ├── index.html
│   └── ranking.json               ← Seed/fallback data ranking
├── event/       (halaman event)
├── bantuan/     (FAQ, statis)
├── feedback/
│   └── index.html
├── scripts/
│   ├── seed-redis.mjs             ← Push JSON repo → Redis
│   └── export-redis.mjs           ← Tarik Redis → JSON
├── fonts/                         ← Font self-hosted web utama (.woff2)
└── icons/                         ← Ikon self-hosted web utama (Lucide lokal)
```

## 5. Admin Panel (`/admin`)

- **Login:** `/admin` (redirect ke `admin/index.html`) minta token, dicek lewat `POST /api/admin/verify` (header `x-admin-token`, dicocokkan ke env `ADMIN_TOKEN`). Token valid disimpan di `sessionStorage`, hilang begitu tab ditutup. `admin/panel.html` menolak render kalau tidak ada token valid di session — jadi buka `panel.html` langsung tanpa login tetap terlempar balik ke layar login.
- **Tab yang tersedia:** Dashboard, Models, Kategori (Kategori Model + Kategori Aplikasi, dua tabel terpisah), Videos, Banner, Marquee, Member, Ranking, Event, Feedback (read-only info, riwayat asli ada di Telegram), Pengaturan (toggle jalur pendaftaran Model 3D & Member).
- **Dua mode tampilan:** Tabel (bisa di-resize antar kolom lewat tarik di pinggir header) dan Kotak/kartu (grid, mirip tampilan asli di web publik). Tersimpan di `localStorage` (`afi-view`).
- **Interaksi baris/kartu:** tap = buka form edit, tahan (long-press) atau klik-kanan = munculkan menu popup (Edit/Hapus). Model gesture ini sengaja disederhanakan dari drag-to-reorder karena gesture drag sering meleset di Android.
- **Simpan data:** tiap create/update/delete langsung `POST /api/data/:type` ke Redis. Kalau gagal (network/putus), perubahan di layar otomatis di-rollback dan muncul toast merah — supaya UI admin tidak pernah beda dari data di server.
- **Kategori terpusat:** kategori yang didefinisikan di tab Kategori otomatis dipakai ulang di dropdown form Model, filter chip publik `/Models/`, dan bagian kategori di homepage — tidak perlu edit di banyak tempat lagi.

## 6. Cara Nambah/Update Konten

**Lewat admin panel (cara utama sekarang):** login ke `/admin`, buka tab koleksi terkait, tambah/edit/hapus lewat form. Perubahan langsung ke Redis dan tampil di web utama dalam ~30 detik (mengikuti cache `GET /api/data/:type`).

**Lewat file JSON (khusus seed awal / recovery):**
1. Edit file JSON yang relevan (`Models/models.json`, `member-Afi-Studio/member.json`, `videos.json`, dst).
2. Validasi dulu: `python3 validate_data.py` (models/videos) atau `python3 -m json.tool <file>.json` (koleksi lain).
3. `git add -A && git commit -m "pesan"` lalu `git push`.
4. File ini cuma jadi **fallback** — kalau Redis sudah ada isinya, perubahan di file JSON **tidak otomatis** masuk ke Redis. Jalankan `node scripts/seed-redis.mjs` (atau update manual lewat admin panel) kalau mau isi Redis-nya ikut berubah.

Detail wajib per field ada di `data.schema.md`.

## 7. Menjalankan Secara Lokal

```bash
git clone https://github.com/username/Afi-Studio-main.git
cd Afi-Studio-main
npm install
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
npx tailwindcss -i ./admin/src/input.css -o ./admin/dist/output.css --minify
```

Untuk tes API (`/api/data/:type`, `/api/admin/verify`, `/api/feedback`) dan admin panel yang benar-benar tersambung Redis, wajib pakai Vercel CLI (server Python biasa tidak menjalankan serverless function):
```bash
npm install -g vercel
vercel dev
```
Vercel CLI otomatis membaca Environment Variables dari `vercel env pull` / dashboard project.

## 8. Keamanan

- Kredensial (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RECAPTCHA_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_TOKEN`) disimpan sebagai Environment Variable di Vercel — **jangan pernah** ditulis langsung di kode atau di-commit.
- `.gitignore` mencegah `node_modules/`, `.env`, `.vercel` ter-commit — jangan dihapus.
- Autentikasi admin cuma **satu token statis** (bukan sistem user/password per akun) — token dicek di server (`api/admin/verify.js` dan tiap `POST /api/data/:type`), bukan cuma dicek di sisi browser, jadi tidak bisa dibypass dengan edit JS di client.
- Token admin disimpan di `sessionStorage` (bukan `localStorage`) — otomatis hilang begitu tab/browser ditutup, mengurangi risiko token nyangkut di device bersama.
- Endpoint `GET /api/data/:type` publik (tanpa token) by design karena memang dipakai halaman publik — jangan taruh data sensitif di koleksi ini.
- Endpoint `POST /api/data/:type` wajib header `x-admin-token` yang cocok `ADMIN_TOKEN`, kalau tidak ada/salah selalu balas 401 — jangan longgarkan pengecekan ini.
- `validate_data.py` boleh ada di mana saja di root, **kecuali di dalam `api/`** — Vercel otomatis menjalankan apapun di `api/` sebagai serverless function, file Python di situ bisa bikin deploy gagal.
- Form Feedback dilindungi reCAPTCHA + rate-limit berbasis Redis, mencegah spam ke Telegram.

## 9. Kontribusi & Lisensi

Ada model/rig/map buatan sendiri untuk dibagikan, atau nemu bug? Hubungi tim lewat halaman **Feedback** di situs, atau media sosial di halaman Member. Hak cipta tiap aset ada di masing-masing kreator/converter yang tercantum di setiap item.

---
© 2026 Afi Studio
