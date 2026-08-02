# Panduan Lengkap Afi Studio (Konteks Internal)

> Dokumen ini BUKAN untuk ditampilkan di repo publik — ini catatan konteks buat kamu (atau AI assistant lain) biar gak perlu mikir ulang dari nol tiap kali balik ke proyek ini untuk nambah fitur/UI baru. Kalau butuh detail teknis per file, baca `README.md`. Kalau butuh detail format field JSON, baca `data.schema.md`.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app)

---

## 1. Ini Proyek Apa?

Afi Studio adalah website komunitas untuk berbagi aset Minecraft — model 3D, rig karakter, map, furniture — biar orang lain bisa lihat dan download. Ada juga halaman kenalan member komunitas, video tutorial, papan ranking event render, dan form feedback.

**Status arsitektur saat ini: web utama + admin panel + database (Redis) + serverless API.** Ini bukan lagi situs "murni statis tanpa database" seperti versi lama proyek ini — sekarang ada panel admin di `/admin` yang bisa CRUD semua data lewat browser (tanpa perlu edit file JSON manual/git push tiap kali update konten), datanya tersimpan di Upstash Redis lewat serverless function di Vercel.

> Catatan sejarah singkat: proyek ini pernah dua kali gonta-ganti arsitektur — sempat murni JSON manual (tanpa DB), sempat dicoba migrasi ke Turso lalu di-revert total, dan **sekarang** settle di kombinasi Redis + admin panel + fallback JSON. File JSON (`Models/models.json`, dst) tetap ada di repo, tapi sekarang fungsinya cuma **seed awal & fallback darurat**, bukan sumber data utama lagi.

## 2. Istilah-Istilah Penting

| Istilah | Penjelasan gampangnya |
|---|---|
| **Repo / Repository** | "Folder proyek" ini, disimpan di GitHub biar ada riwayat perubahannya |
| **GitHub** | Tempat nyimpen kode proyek |
| **Vercel** | Tempat website ini "tinggal" di internet, sekaligus tempat serverless function jalan. Tiap `git push`, Vercel otomatis deploy ulang |
| **Serverless Function** | Kode kecil (di folder `api/`) yang jalan otomatis di server Vercel cuma pas ada request — dipakai buat `api/data/[type].js`, `api/admin/verify.js`, `api/feedback.js` |
| **Upstash Redis** | Database key-value yang dipakai proyek ini. 1 key = 1 koleksi data (mis. `afi-studio:data:models` isinya seluruh array model dalam bentuk JSON) |
| **JSON** | Format file teks buat nyimpen data terstruktur. Sekarang cuma dipakai sebagai *seed*/fallback, bukan sumber utama |
| **Fallback** | Kalau Redis kosong (belum di-seed) atau lagi down, endpoint `GET /api/data/:type` otomatis baca file JSON di repo supaya web tetap jalan |
| **Admin Token** | Password tunggal (disimpan di Environment Variable `ADMIN_TOKEN` di Vercel) buat login `/admin`. Bukan sistem akun per-user |
| **PWA (Progressive Web App)** | Website yang bisa di-"install" ke HP, halaman utama tetap bisa dibuka meski offline (lewat Service Worker) |
| **Service Worker (`sw.js`)** | Script yang cache halaman root supaya bisa dibuka offline. Setiap kali daftar aset yang di-cache berubah, `CACHE_NAME` di dalamnya wajib dinaikkan versinya, kalau tidak browser pengunjung akan nyangkut di versi cache lama |
| **Termux** | Aplikasi terminal Android, dipakai Randy buat `git` (add/commit/push/pull --rebase) dari HP tanpa laptop |
| **Validasi** | Proses ngecek format JSON sebelum dipakai/di-push, biar situs tidak error |

## 3. Peta Halaman

| Alamat | Isinya | Butuh login? |
|---|---|---|
| `/` | Beranda — banner, marquee, sample model & video, navigasi | Tidak |
| `/Models/` | Katalog model — filter kategori (dari koleksi `categories`) + filter aplikasi tujuan (dari koleksi `appcategories`, chip: Viontri/Prisma3D/Blender/Mine-Imator/C4D/Other) + pencarian | Tidak |
| `/tutorial/` | Video & tutorial YouTube — pencarian, badge "Baru", penanda populer (localStorage per-device) | Tidak |
| `/member-Afi-Studio/` | Daftar member per generasi | Tidak |
| `/ranking/` | Top 3 + Top 10 karya render, lightbox | Tidak |
| `/event/` | Aturan & konten event render (HUT RI, dsb) | Tidak |
| `/bantuan/` | FAQ | Tidak |
| `/feedback/` | Form kritik & saran → Telegram tim | Tidak |
| `/admin/` | Panel kelola semua data di atas (kecuali Feedback yang cuma info, riwayat aslinya di Telegram) | **Ya, token admin** |

## 4. Dari Mana Datanya? (Alur Data Sekarang)

Semua koleksi data lewat satu endpoint dinamis: `api/data/[type].js`, dengan tipe yang valid: `models`, `videos`, `banner`, `marquee`, `member`, `ranking`, `categories`, `appcategories`, `settings`, `event`.

```
Halaman publik           →  GET /api/data/:type
                          →  coba baca Redis dulu (key afi-studio:data:<type>)
                          →  kalau Redis kosong/error → baca file JSON fallback di repo
                          →  balikin JSON ke browser (dengan Cache-Control, biasanya ~30 detik)

Admin panel (/admin)     →  POST /api/data/:type  (wajib header x-admin-token)
                          →  server cek token ke ADMIN_TOKEN
                          →  kalau cocok → tulis langsung ke Redis
                          →  kalau salah/tidak ada → 401, tidak ada yang berubah
```

Artinya: **cara resmi update konten sekarang adalah lewat admin panel**, bukan edit file JSON + push. Edit file JSON langsung di repo cuma efektif kalau Redis untuk koleksi itu belum pernah di-seed, atau untuk keperluan reset/recovery (lihat bagian 9).

## 5. Fitur yang Sudah Ada

**Web publik:**
- Katalog model dengan filter kategori otomatis (ikut apa yang didefinisikan admin) + filter aplikasi tujuan + pencarian
- Video & tutorial dengan badge "Baru" otomatis dan penanda populer per-device
- Halaman member per generasi, grup baru otomatis muncul kalau ada `gen_id` baru
- Ranking render Top 3 + Top 10 dengan lightbox (caption width dihitung dari ukuran asli gambar)
- Tema gelap/terang (ikut sistem HP otomatis, bisa toggle manual)
- PWA — bisa di-install ke homescreen, halaman utama tetap terbuka semi-offline
- SEO dasar (sitemap, robots.txt)
- Cache diatur lewat `vercel.json` (aset statis lama, data JSON pendek) + `Cache-Control` per koleksi di `api/data/[type].js`

**Admin panel (`/admin`):**
- Login token tunggal, sesi tersimpan di `sessionStorage` (hilang saat tab ditutup)
- CRUD penuh untuk: Models, Kategori Model, Kategori Aplikasi, Videos, Banner, Marquee, Member, Ranking, Event
- Kategori terpusat: kategori yang diedit di tab Kategori otomatis nyambung ke form Model, filter chip publik, dan homepage — tidak perlu update manual di banyak tempat
- Toggle Pengaturan: buka/tutup jalur pendaftaran Model 3D & Member (dibaca `config.js` di semua halaman publik lewat `/api/data/settings`)
- Dua mode tampilan data: Tabel (kolom bisa di-resize manual, lebar juga auto-menyesuaikan isi terpanjang) dan Kotak/kartu grid
- Interaksi mobile-friendly: tap = edit, tahan/klik-kanan = menu popup Edit/Hapus (bukan drag-to-reorder, karena gesture drag sering meleset di Android)
- Rollback otomatis di UI kalau simpan ke server gagal, supaya tampilan admin tidak pernah beda dari data asli di Redis

### Belum Dikerjakan (Ide ke Depan)
- Search/filter di halaman Member
- Sorting (model terbaru/terlama, member alfabet)
- Counter download / like dari pengunjung (secara teknis sekarang sudah ada database, jadi ini lebih mudah diimplementasi dibanding versi lama proyek yang murni statis)
- Fitur Favorit (nandain model/video favorit tanpa login, tersimpan lokal `localStorage`) — masih ide, belum diputuskan cakupannya (Model saja/Video saja/dua-duanya)
- Riwayat/log siapa yang login admin & kapan (sekarang admin cuma token tunggal tanpa audit trail)
- Halaman riwayat Feedback di dalam admin panel (sekarang feedback cuma masuk ke Telegram, tidak tersimpan/terlihat di panel)

## 6. Kalau Ada yang Error

- **Halaman publik nampilin data kosong:** cek langsung `afi-studio.vercel.app/api/data/models` (ganti `models` sesuai koleksi) di browser — kalau ini juga kosong/error, cek Redis (env var `UPSTASH_REDIS_REST_URL`/`TOKEN` di Vercel) dan pastikan file fallback JSON-nya masih valid (`python3 validate_data.py` atau `python3 -m json.tool <file>.json`)
- **Perubahan di admin panel tidak muncul di web publik:** tunggu ~30 detik (cache `GET /api/data/:type`), kalau masih belum muncul cek console/network di HP (kalau bisa) atau minta orang lain coba refresh paksa
- **Login admin gagal terus:** pastikan `ADMIN_TOKEN` sudah di-set di Environment Variables Vercel dan sudah redeploy setelah nambah/ubah env var
- **Simpan data di admin panel gagal (toast merah):** biasanya `UPSTASH_REDIS_REST_URL`/`TOKEN` belum di-set atau Redis lagi down — perubahan di layar otomatis batal, aman untuk dicoba ulang
- **Ikon Lucide baru tidak muncul di admin panel:** `admin/icons/lucide-local.js` (dan `icons/lucide-local.js` untuk web publik) adalah bundel yang **di-trim manual**, bukan package npm penuh — ikon yang belum ada di file itu harus ditambahkan manual sebelum dipakai
- **Update di `sw.js` (CORE_ASSETS) tidak kepakai pengunjung lama:** naikkan `CACHE_NAME` (mis. `v6` → `v7`), kalau tidak Service Worker lama tetap dipakai browser pengunjung
- **Tampilan halaman berantakan / style hilang setelah nambah class Tailwind baru:** pastikan file halaman itu ada di daftar `content` pada `tailwind.config.js` (root untuk web publik, `admin/tailwind.config.js` untuk admin panel), lalu build ulang `output.css` masing-masing
- **Kolom tabel admin susah di-resize / lari sendiri saat ditarik di HP:** area tarik (`.col-resizer`) sudah pakai `touch-action:none` + pointer capture + kunci scroll horizontal wrap selama drag — kalau masih ada masalah serupa di elemen draggable lain, pola perbaikannya sama: `setPointerCapture` di `pointerdown`, matikan scroll container selama drag, baru dikembalikan di `pointerup`/`pointercancel`

## 7. Kebiasaan/Preferensi Kerja Randy (buat AI assistant berikutnya)

- **Patch bertarget, jangan nyenggol fungsi lain.** Randy sangat sensitif soal regresi — kalau minta perbaikan 1 hal, jangan ikut "merapikan" bagian lain yang tidak diminta.
- **Konfirmasi dulu sebelum eksekusi perubahan besar**, terutama yang menyentuh banyak file atau berpotensi mengubah tampilan/perilaku yang sudah jalan.
- Randy kerja dari **Android** pakai Termux (git) + aplikasi editor HTML — **tidak bisa pakai DevTools browser**, jadi debugging harus dijelaskan lewat gejala yang terlihat/dites langsung di HP, bukan asumsi "buka console".
- Setelah selesai perbaikan multi-file, Randy biasanya minta **file di-zip ulang** untuk didownload, bukan ditempel satu-satu.
- Hemat token/analisis: kerjakan sesuai yang diminta, jangan mengerjakan banyak hal sekaligus tanpa diminta.
- Kalau ada kemungkinan gesture/interaksi Android bermasalah (drag, resize, tahan/long-press), curigai dulu konflik dengan native scroll/gesture browser — pola solusinya biasanya `touch-action:none` + `setPointerCapture` + kunci scroll container sementara selama drag berlangsung (lihat bagian 6, kasus resize kolom tabel).

## 8. Environment Variables yang Dipakai (di Vercel)

| Variable | Untuk apa |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Koneksi ke database Redis (dipakai `api/data/[type].js` dan rate-limit di `api/feedback.js`) |
| `ADMIN_TOKEN` | Password tunggal login `/admin` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Tujuan pesan form Feedback |
| `RECAPTCHA_SECRET_KEY` | Verifikasi reCAPTCHA di form Feedback |

Detail cara setup awal ada di `SETUP-ADMIN-DATABASE.md`.

## 9. Seed / Reset / Backup Data

- `node scripts/seed-redis.mjs` — push isi file JSON di repo ke Redis (dipakai waktu setup awal atau kalau mau reset koleksi tertentu balik ke data seed)
- `node scripts/export-redis.mjs` — tarik isi Redis saat ini balik jadi file JSON (backup, atau supaya file di repo ikut sinkron dengan data terbaru hasil edit lewat admin panel)
- Metode env var yang terbukti jalan di Termux: `vercel env pull` lalu `set -o allexport` sebelum load file `.env` (metode `xargs` pernah gagal karena karakter spesial di isi env value)

---
© 2026 Afi Studio — dokumen ini dibuat biar tidak perlu mikir ulang dari nol tiap kali balik ke proyek ini.
