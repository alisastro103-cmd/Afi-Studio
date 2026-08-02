# Panduan & Konteks Proyek Afi Studio

> **Dokumen ini bukan README untuk GitHub.** Ini catatan konteks internal — buat dibaca ulang (oleh Ali atau AI assistant manapun) sebelum nambah fitur/UI baru, biar tidak perlu mikir ulang dari nol tiap kali balik ke proyek ini. Untuk sisi teknis ringkas + daftar file, baca `README.md`. Untuk format field JSON, baca `data.schema.md`. Untuk langkah setup Redis/env var, baca `SETUP-ADMIN-DATABASE.md`.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app) — 🔒 **Admin:** `/admin`

---

## 1. Proyek Ini Apa?

Afi Studio adalah website komunitas untuk berbagi aset Minecraft — model 3D, rig karakter, map, furniture. Ada juga halaman kenalan member komunitas, video tutorial, papan ranking event render, favorit pribadi, dan form feedback.

**Riwayat arsitektur (penting biar tidak salah asumsi):**
1. Awalnya: pure static site, semua data di file `.json`, edit = `git push`, tanpa admin/database.
2. Sempat dicoba migrasi ke database (Turso) + admin panel — **direvert total**.
3. **Kondisi sekarang:** balik pakai database, tapi versi baru — **Upstash Redis** (bukan Turso) + **admin panel di `/admin`** yang beneran nyimpen data (bukan cuma di memory browser). Web utama baca data lewat `/api/data/:type`, file `.json` di repo jadi fallback/cadangan aja.

Jangan bingung kalau nemu jejak "tanpa database" di riwayat commit lama — itu kondisi sebelum poin 3.

## 2. Istilah-Istilah Penting

| Istilah | Penjelasan gampangnya |
|---|---|
| **Repo / Repository** | "Folder proyek" ini, disimpan di GitHub biar ada riwayat perubahannya |
| **Vercel** | Tempat website ini "tinggal" di internet + tempat jalannya serverless function (`api/`). Tiap `git push`, Vercel auto-deploy |
| **Upstash Redis** | Database key-value yang dipakai. 1 key = 1 koleksi data (models, videos, dst), isinya JSON apa adanya — bukan tabel/relasi seperti SQL |
| **Serverless Function** | Kode kecil di `api/` yang jalan otomatis di server Vercel cuma pas ada request — dipakai buat baca/tulis Redis dan kirim feedback ke Telegram |
| **ADMIN_TOKEN** | Password tunggal (bukan akun banyak orang) buat login `/admin`, disimpan sebagai Environment Variable di Vercel |
| **Fallback file JSON** | Kalau Redis kosong/lagi down, `GET /api/data/:type` otomatis baca file `.json` di repo supaya web tidak mati total |
| **PWA** | Website yang bisa di-"install" ke HP kayak aplikasi. Cuma halaman `/` (Beranda) yang di-cache untuk mode semi-offline |
| **Termux** | Aplikasi terminal Android, dipakai buat `git push` / jalanin script dari HP tanpa laptop |
| **Seed** | `npm run seed` — isi Redis pertama kali dari file `.json` yang ada. Sekali aja, jangan diulang setelah admin panel dipakai |

## 3. Peta Halaman (Lengkap)

| Alamat | Isinya | Data live dari |
|---|---|---|
| `/` | Beranda — pengantar, sample video acak, navigasi ke semua halaman | `/api/data/videos` |
| `/Models/` | Katalog model — filter kategori & aplikasi tujuan, pencarian, banner slider, marquee info | `/api/data/models`, `categories`, `appcategories`, `banner`, `marquee` |
| `/tutorial/` | Semua video & tutorial YouTube — pencarian, badge "Baru", penanda populer | `/api/data/videos` |
| `/member-Afi-Studio/` | Daftar member, dikelompokkan per generasi (`gen_id`) | `/api/data/member` |
| `/ranking/` | Papan Top 3 + Top 10 karya render, lightbox | `/api/data/ranking` |
| `/favorit/` | Video & model yang ditandai favorit pengunjung (per-device) | `/api/data/videos` + `models`, disaring pakai id di `localStorage` |
| `/event/` | Aturan & panduan ikut event render | statis (tidak fetch) |
| `/bantuan/` | FAQ — pertanyaan umum cara pakai situs | statis (tidak fetch) |
| `/feedback/` | Form kritik & saran → Telegram tim | `POST /api/feedback` |
| `/admin/` | Login (`index.html`) + Dashboard CRUD (`panel.html`) — kelola SEMUA koleksi di atas plus Banner, Marquee, Pengaturan | semua `/api/data/:type` (GET+POST) |

## 4. Dari Mana Datanya? (Alur Lengkap)

Tiap koleksi data punya **satu key di Redis** dan **satu file JSON cadangan** di repo — daftarnya didefinisikan di `api/data/[type].js` (objek `TYPES`):

| `type` | Redis key | File cadangan |
|---|---|---|
| `models` | `afi-studio:data:models` | `Models/models.json` |
| `videos` | `afi-studio:data:videos` | `videos.json` |
| `banner` | `afi-studio:data:banner` | `banner.json` |
| `marquee` | `afi-studio:data:marquee` | `marquee.json` |
| `member` | `afi-studio:data:member` | `member-Afi-Studio/member.json` |
| `ranking` | `afi-studio:data:ranking` | `ranking/ranking.json` |
| `categories` | `afi-studio:data:categories` | `categories.json` |
| `appcategories` | `afi-studio:data:appcategories` | `app-categories.json` |
| `settings` | `afi-studio:data:settings` | `settings.json` |

**Alur baca (pengunjung buka halaman):**
```
Halaman fetch("/api/data/models")
  → api/data/[type].js: redis.get("afi-studio:data:models")
  → ada isinya? kirim balik (cache browser 30 detik, categories/appcategories 0 detik biar filter selalu akurat)
  → kosong/Redis error? baca Models/models.json di repo, kirim itu sebagai gantinya
```

**Alur tulis (admin ubah data):**
```
Admin isi form di /admin → panel.html
  → POST /api/data/models, header x-admin-token: <ADMIN_TOKEN>, body: array/objek data baru
  → api/data/[type].js cek token cocok → redis.set("afi-studio:data:models", body)
  → sukses → toast hijau di panel, web utama otomatis kebaca versi baru (~30 detik karena cache)
  → gagal (token salah/Redis down) → toast merah, perubahan di layar admin dibatalkan (rollback tampilan)
```

Nambah konten sekarang **tidak perlu** `git push` — cukup lewat `/admin`. File `.json` manual masih berguna untuk: isi awal (`npm run seed`), backup (`npm run` script export), dan jaring pengaman kalau Redis bermasalah.

## 5. Struktur File & Peran Tiap Bagian

```
Afi-Studio-main/
├── index.html              ← Beranda: HTML+CSS+JS dalam satu file, semua logic (nav, slider, marquee) inline
├── config.js                ← Toggle jalur pendaftaran, nilai diambil dari /api/data/settings (bukan diedit manual)
├── theme-toggle.js          ← Toggle tema gelap/terang, persist ke localStorage 'afi-theme'
├── favorites.js             ← Sistem favorit (localStorage per-device): simpan id video, simpan `link` model sebagai id
├── data.schema.md           ← Dokumentasi field wajib tiap koleksi data
├── validate_data.py         ← Validator format models.json/videos.json
├── vercel.json               ← Aturan Cache-Control per jenis file
├── tailwind.config.js        ← Scan class Tailwind web utama
├── src/input.css → dist/output.css   ← Source & hasil compile Tailwind web utama
├── manifest.json, sw.js      ← Config PWA, cuma cache halaman "/"
├── *.json (root & subfolder)  ← Cadangan/fallback tiap koleksi (lihat tabel §4)
│
├── Models/                   ← Katalog model (index.html + script.js + models.json fallback)
├── tutorial/                  ← Video & tutorial
├── member-Afi-Studio/         ← Daftar member per generasi + folder profile/ (foto)
├── ranking/                    ← Papan ranking render
├── favorit/                    ← Halaman favorit pengunjung
├── event/, bantuan/, feedback/ ← Halaman statis / form
│
├── admin/                      ← ADMIN PANEL (terpisah total dari web utama, folder sendiri biar nama file tidak tabrakan)
│   ├── index.html               ← Layar login: input token → POST /api/admin/verify → simpan ke sessionStorage kalau benar
│   ├── panel.html (paling besar, ~1600 baris) ← Dashboard: sidebar per koleksi, tabel/kartu (bisa switch mode + resize kolom tabel manual), modal tambah/edit/hapus, semua CRUD manggil POST /api/data/:type
│   ├── src/input.css → dist/output.css  ← Tailwind KHUSUS admin (config & build terpisah dari web utama)
│   ├── fonts/, icons/            ← Aset khusus admin (font + ikon Lucide lokal)
│   └── coming_soon.webp
│
├── api/                          ← SEMUA backend (Vercel Serverless Functions)
│   ├── data/[type].js             ← Endpoint generik GET (publik)/POST (admin) untuk 9 koleksi data, baca-tulis Redis + fallback JSON
│   ├── admin/verify.js            ← Cek token login, tidak nyimpen apapun (stateless)
│   └── feedback.js                ← Kirim form feedback ke Telegram (rate-limit Upstash + reCAPTCHA)
│
├── scripts/
│   ├── seed-redis.mjs             ← Isi Redis pertama kali dari file .json yang ada di repo
│   └── export-redis.mjs           ← Kebalikannya: tarik isi Redis sekarang → jadi file .json (backup manual)
│
├── fonts/, icons/                  ← Aset self-hosted web utama (terpisah dari admin/fonts, admin/icons)
└── robots.txt, sitemap.xml          ← SEO dasar
```

## 6. Fungsi Kode Kunci (Detail)

- **`api/data/[type].js`** — jantung backend. Satu file menangani 9 jenis koleksi lewat parameter URL `:type`. `GET` selalu publik (dipakai semua halaman pengunjung); `POST` selalu dicek header `x-admin-token` dulu sebelum boleh `redis.set()`. Kalau `UPSTASH_REDIS_REST_URL`/`TOKEN` belum di-set di environment, `redis` jadi `null` dan otomatis fallback ke file JSON untuk `GET` (tapi `POST` akan gagal dengan pesan error jelas, bukan diam-diam gagal).
- **`admin/panel.html`** — semua UI admin ada di satu file ini (SPA sederhana tanpa router beneran, ganti tampilan lewat `data-view` + JS toggle class). Fitur penting di dalamnya:
  - Mode tampilan **tabel** dan **kotak/kartu**, bisa di-switch, tersimpan di `localStorage 'afi-view'`.
  - **Resize kolom tabel manual** (`initResizableTables`) — user bisa tarik pinggir kolom, lebar tersimpan per-sesi (di-reset kalau data tabelnya di-remount/reload halaman, karena tidak dipersist ke storage). Drag pakai Pointer Events + pointer capture, dan scroll horizontal tabel dimatikan sementara selama drag supaya pegangan kolom benar-benar ikut jari, tidak dibajak jadi gesture scroll layar sentuh.
  - **Reorder data** (naik/turun urutan) lewat tombol di board opsi saat kartu/baris ditahan.
  - Semua form CRUD (Model, Kategori, Video, Banner, Marquee, Member, Ranking, Pengaturan) kirim `POST /api/data/:type` dengan **seluruh isi koleksi** (bukan cuma 1 item) — artinya tiap simpan itu "timpa semua", jadi kalau ada 2 admin edit bersamaan, yang terakhir simpan yang menang (tidak ada penguncian/konflik-detection).
- **`favorites.js`** — dipakai bareng oleh `Models/script.js`, `tutorial/script.js`, dan `/favorit/`. Video pakai id video sebagai penanda; model belum punya field `id` di skema data-nya, jadi dipakai `link` (URL download) sebagai penanda unik — **kalau `link` sebuah model diubah, status favorit pengunjung untuk model itu akan hilang** (poin penting kalau mau redesain skema model nanti).
- **`config.js`** — sekarang cuma "jembatan": nilai default di kode dipakai sekilas sebelum `fetch('/api/data/settings')` selesai / kalau offline, lalu langsung ditimpa hasil dari Redis begitu berhasil.

## 7. Keamanan

- **Autentikasi admin:** token tunggal (`ADMIN_TOKEN`), dicek server-side di dua tempat: `api/admin/verify.js` (saat login) dan `api/data/[type].js` (saat setiap `POST`). Tidak ada sesi/JWT — token mentah dikirim ulang di header `x-admin-token` tiap request tulis.
- **Penyimpanan token di browser:** `sessionStorage`, bukan `localStorage` — otomatis hilang saat tab admin ditutup, jadi tidak nempel permanen di device kalau admin lupa logout.
- **Endpoint publik vs terproteksi:** `GET /api/data/:type` sengaja publik tanpa auth (memang untuk ditampilkan ke semua pengunjung). Hanya `POST` (tulis) yang diproteksi. Kalau ke depan mau ada data admin-only yang tidak boleh publik, itu **butuh endpoint/skema baru** — jangan taruh di koleksi yang sama dengan data publik.
- **Kredensial:** semua secret (`ADMIN_TOKEN`, `UPSTASH_REDIS_REST_URL/TOKEN`, `TELEGRAM_BOT_TOKEN`, `RECAPTCHA_SECRET_KEY`) di Environment Variable Vercel, tidak pernah di kode/repo.
- **Rate-limit & anti-spam:** form Feedback pakai Upstash untuk rate-limit + reCAPTCHA — endpoint `api/data/:type` **tidak** punya rate-limit sendiri (mengandalkan proteksi token admin saja untuk `POST`).
- **Lokasi file Python:** `validate_data.py` wajib di luar folder `api/` — Vercel otomatis coba jalankan apapun di `api/` sebagai serverless function, file Python di situ bisa bikin deploy gagal.
- **`.gitignore`:** jaga `node_modules/`, `.env`, `.vercel` supaya tidak ke-commit.

## 8. Cara Kerja Admin Panel (Untuk Dipahami Sebelum Ubah Fitur)

1. Buka `/admin` → diarahkan ke layar login kalau belum ada token valid di `sessionStorage`.
2. Login sukses → `panel.html` dimuat, sidebar kiri berisi menu: Dashboard, Models, Kategori, Video & Tutorial, Banner, Marquee/Info, Member, Ranking Render, Event, Feedback, Pengaturan.
3. Tiap menu = satu `section-view` yang fetch datanya sendiri dari `/api/data/:type` terkait saat pertama dibuka.
4. Tambah/edit data = buka modal, isi form, simpan → kirim ulang **seluruh array/objek koleksi** (bukan delta) ke `POST /api/data/:type`.
5. Reorder/hapus juga langsung `POST` ulang seluruh koleksi dengan urutan/isi baru.
6. Tabel bisa diganti mode kotak, dan lebar kolom tabel bisa ditarik manual (lihat §6) — berguna kalau kolom deskripsi/teks panjang perlu dilebarkan sementara saat mengecek data.
7. Kalau nambah **jenis data baru** (misal koleksi baru di luar 9 yang ada): daftarkan dulu di `TYPES` (`api/data/[type].js`), baru bikin section + form-nya di `admin/panel.html`. Tanpa didaftarkan di `TYPES`, endpoint akan balas 404 untuk `type` itu.

## 9. Yang Sudah Ada vs Belum

**Sudah:**
- Admin panel penuh (CRUD 9 koleksi data + Pengaturan toggle pendaftaran), tersimpan ke Redis
- Katalog model dengan filter kategori/aplikasi + pencarian
- Video & tutorial dengan badge "Baru" & penanda populer (`localStorage`, per-device)
- Halaman member per generasi (grup baru otomatis muncul dari `gen_id`)
- **Fitur Favorit** — sudah live di `/favorit/` (bukan lagi rencana), `localStorage` per-device
- Papan Ranking Render (Top 3 + Top 10) — sudah ambil data dari `/api/data/ranking`, tapi foto masih placeholder `coming_soon.webp` di beberapa entri
- Tema gelap/terang, PWA (halaman `/` semi-offline), SEO dasar
- Fallback otomatis ke file JSON kalau Redis kosong/down — web tidak akan mati total

**Belum / Ide ke Depan:**
- Search/filter di halaman Member
- Sorting (model terbaru/terlama, member alfabet)
- Isi foto render juara asli di `/ranking/` (ganti `coming_soon.webp`)
- Counter download/like sungguhan dari pengunjung (butuh skema baru di Redis, bukan cuma localStorage)
- Field `id` unik untuk model (saat ini favorit model pakai `link` sebagai id — rapuh kalau link berubah)
- Riwayat/undo perubahan admin panel (saat ini "timpa semua" tanpa versi sebelumnya tersimpan otomatis — cadangan cuma lewat `export-redis.mjs` manual)
- Multi-admin dengan token/peran berbeda (saat ini cuma satu token untuk semua)

## 10. Kalau Ada yang Error

- **Situs nampilin data kosong:** cek `afi-studio.vercel.app/api/data/models` langsung di browser — kalau error, cek Redis (Upstash dashboard) dan fallback file JSON-nya (`python3 validate_data.py`)
- **Perubahan di admin tidak muncul di web:** tunggu ~30 detik (cache), kalau masih belum, cek toast di admin panel — merah berarti simpan gagal (token/Redis)
- **Tidak bisa login admin:** cek `ADMIN_TOKEN` di Vercel Environment Variables sudah ke-set dan sama persis dengan yang diketik
- **Form feedback tidak jalan:** cek `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RECAPTCHA_SECRET_KEY`, `UPSTASH_REDIS_REST_URL/TOKEN` di Vercel
- **Style hilang setelah nambah class Tailwind baru:** pastikan file halaman ada di `content` (`tailwind.config.js` untuk web utama, `admin/tailwind.config.js` untuk admin), lalu compile ulang `output.css` yang sesuai
- **Resize kolom tabel admin tidak ikut jari (khususnya di layar sentuh):** lihat implementasi `initResizableTables` di `admin/panel.html` — sudah diperbaiki pakai Pointer Capture + matikan scroll wadah tabel sementara saat drag; kalau bug serupa muncul lagi di komponen drag lain, pola perbaikannya sama

---
© 2026 Afi Studio — dokumen ini dibuat biar tidak perlu mikir ulang dari nol tiap kali balik ke proyek ini.
