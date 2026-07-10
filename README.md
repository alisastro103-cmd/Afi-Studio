# Afi Studio

Website berbagi aset Minecraft (model, rig, map, dan furniture) yang dibuat oleh komunitas Afi Studio. Pengunjung bisa menjelajahi, mencari, dan mengunduh berbagai aset siap pakai, serta mengenal member-member yang tergabung di dalamnya.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app)

---

## 1. Ringkasan Sistem

- Static site: HTML + CSS (Tailwind) + JavaScript murni, tanpa framework frontend
- Hosting: Vercel, terhubung langsung ke repo GitHub (auto-deploy tiap push ke `main`)
- Database: **Turso** (SQLite di edge) — menyimpan data Model & Member, diakses lewat serverless function (`api/models.js`, `api/members.js`)
- Admin panel (`/admin`) — kelola data Model & Member (tambah/edit/hapus) lewat form, tanpa perlu edit JSON atau kode manual, dilindungi password (`ADMIN_PASSWORD`)
- Backend lain: `api/feedback.js` (proxy form feedback ke Telegram), `api/admin-login.js` (verifikasi password admin)
- PWA-ready: installable ke homescreen, punya service worker
- `Models/models.json` dan `member-Afi-Studio/member.json` **masih ada di repo sebagai arsip/backup**, tapi sudah tidak dipakai lagi sebagai sumber data live — situs sekarang membaca dari Turso lewat API

---

## 2. Struktur Folder

```
Afi-Studio-main/
├── admin/
│   └── index.html          ← panel kelola data Model & Member
├── api/
│   ├── feedback.js
│   ├── models.js            ← CRUD data Model (baca dari Turso)
│   ├── members.js           ← CRUD data Member (baca dari Turso)
│   └── admin-login.js       ← verifikasi password admin
├── lib/
│   └── db.js                ← koneksi ke database Turso
├── db/
│   ├── schema.sql           ← struktur tabel `models` & `members`
│   └── SETUP.md             ← panduan setup Turso dari nol
├── scripts/
│   └── migrate-to-turso.js  ← migrasi data JSON lama ke Turso (one-time)
├── index.html
├── Models/
│   ├── index.html
│   ├── script.js
│   └── models.json           (arsip/backup, bukan sumber data live lagi)
├── member-Afi-Studio/
│   ├── index.html
│   ├── script.js
│   ├── member.json            (arsip/backup, bukan sumber data live lagi)
│   ├── title.png
│   └── profile/
├── ranking/
│   └── index.html
├── event/
│   └── index.html
├── feedback/
│   └── index.html
├── bantuan/
│   └── index.html
├── fonts/
│   ├── fonts.css
│   ├── Outfit-{400,500,600,700,800}.woff2
│   ├── DMSans-{400,500,600}.woff2
│   ├── DancingScript-700.woff2
│   └── *-OFL-LICENSE.txt
├── icons/
│   └── lucide-local.js
├── src/input.css
├── dist/output.css
├── manifest.json
├── sw.js
├── theme-toggle.js
├── icon.png
├── favicon.png
├── icon-192.png
├── icon-maskable.png
├── Banner1.webp … Banner4.webp
├── thumbnail.webp
├── robots.txt
├── sitemap.xml
├── tailwind.config.js
├── package.json
├── package-lock.json
├── .env.example
└── .gitignore
```

> ⚠️ **Sudah tidak berlaku:** folder `images/` yang disebut di versi README sebelumnya **tidak lagi ada**. Semua thumbnail model sekarang di-hosting eksternal (ibb.co) dan dirujuk lewat field `thumb` di database, bukan file lokal di project.

---

## 3. Penjelasan Tiap Halaman

| Halaman | Isi & Fungsi |
|---|---|
| `index.html` | Landing page — pengantar Afi Studio, navigasi ke semua halaman lain |
| `Models/` | Katalog aset Minecraft — filter kategori & pencarian, tiap kartu model bisa dibuka jadi pop-up detail berisi info converter dan tombol "Download Now" / "Copy Link" |
| `member-Afi-Studio/` | Daftar profil member, dikelompokkan per generasi (`gen-1`, `gen-2`, `gen-3`, `orang-random`), tiap profil ada spesialisasi & link sosial media |
| `ranking/` | Papan peringkat karya render bulanan (Juara 1–3 + Top 10) — struktur UI sudah lengkap, tapi kontennya saat ini masih placeholder "segera hadir" (`coming_soon.webp`) |
| `event/` | **Bukan galeri** — ini halaman peraturan & panduan mengikuti Event Render (larangan konten, software yang diizinkan, standar rasio/resolusi, dll), diakhiri checklist persetujuan sebelum tombol lanjut ke folder submit karya aktif |
| `bantuan/` | Pusat bantuan/FAQ — daftar pertanyaan umum seputar cara pakai semua fitur di Afi Studio |
| `feedback/` | Form kritik & saran — terhubung ke Telegram lewat `api/feedback.js`, support lampiran gambar (maks 1MB), dilindungi reCAPTCHA v2 & rate limiting |
| `admin/` | Panel kelola data Model & Member — login pakai `ADMIN_PASSWORD`, form tambah/edit/hapus, langsung baca-tulis ke database Turso lewat `api/models.js` & `api/members.js` |

Semua halaman (kecuali `index.html`) berbagi komponen yang sama: nav-bar sticky dengan logo `icon.png` dari root, tombol back, dropdown menu pindah halaman, dan toggle tema light/dark.

---

## 4. Peran Setiap Bagian Sistem

### 🎨 Frontend (tampilan, yang dilihat pengunjung)

| File/Folder | Peran | Boleh diubah? |
|---|---|---|
| `*/index.html` (Models, member-Afi-Studio, ranking, event, bantuan, feedback, root) | Markup & style tiap halaman | ✅ Bebas |
| `*/script.js` | Logic: fetch data dari API, render UI, filter, interaksi tombol | ✅ Bebas, hati-hati di bagian `fetch('/api/...')` |
| `admin/index.html` | UI panel admin — form Model & Member, token login di `localStorage` browser | ✅ Bebas, selalu tes ulang CRUD setelah ubah |
| `theme-toggle.js` | Toggle dark/light, simpan preferensi ke `localStorage` | ✅ Bebas |
| `fonts/fonts.css` + `*.woff2` | Font self-hosted (Outfit, DM Sans, Dancing Script) | ✅ Bebas nambah, jangan hapus yang lagi dipakai |
| `icons/lucide-local.js` | Bundle ikon Lucide self-hosted | ✅ Bebas |
| `src/input.css` | Sumber Tailwind (`@tailwind base/components/utilities`) | ✅ Edit di sini |
| `dist/output.css` | Hasil compile Tailwind, dipakai semua halaman | ⚠️ Jangan edit manual — hasil generate dari `src/input.css` |
| `tailwind.config.js` | Config Tailwind (termasuk `content` — daftar file yang di-scan) | ✅ Bebas |
| `manifest.json`, `sw.js` | Metadata PWA & Service Worker (cache offline `index.html`) | ✅ Bebas, hati-hati kalau belum paham PWA |
| `robots.txt` / `sitemap.xml` | Instruksi & daftar URL untuk Google Search | ✅ Bebas, jaga domain tetap konsisten |

### ⚙️ Backend (kode yang jalan di server Vercel)

| File | Peran | Boleh diubah? |
|---|---|---|
| `api/models.js` | CRUD data Model — `GET` publik, `POST`/`PUT`/`DELETE` butuh header `Authorization: Bearer <ADMIN_PASSWORD>` | ✅ Boleh, tapi harus ngerti dulu — salah dikit `/api/models` bisa down |
| `api/members.js` | CRUD data Member — pola proteksi sama seperti `api/models.js` | ✅ Boleh, sama hati-hatinya |
| `api/admin-login.js` | Verifikasi password admin sebelum panel `/admin` bisa dipakai | ⚠️ Boleh, jangan sampai lupa validasi password |
| `api/feedback.js` | Terima form feedback, rate limiting (Upstash Redis, 5x/10 menit per IP), verifikasi reCAPTCHA v2, kirim ke Telegram Bot API | ✅ Boleh, sudah teruji stabil |
| `lib/db.js` | Koneksi ke database Turso, dipakai bareng semua `api/*.js` | 🔴 **Hati-hati banget** — dipakai semua endpoint, kalau rusak semua API ikut down |
| `package.json` / `package-lock.json` | Dependency: `tailwindcss`, `formidable`, `@upstash/ratelimit`, `@upstash/redis`, `@libsql/client` | ✅ Boleh nambah dependency baru |

### 🗄️ Database (Turso)

| File | Peran | Boleh diubah? |
|---|---|---|
| `db/schema.sql` | Struktur awal tabel (`CREATE TABLE IF NOT EXISTS`) | 🔴 **Jangan dijalankan ulang** di database yang sudah ada isinya — ini cuma referensi struktur |
| `db/migration-002-add-app-target.sql` dan migrasi sejenis ke depan | Perubahan skema (`ALTER TABLE`) buat database yang sudah hidup | ✅ Boleh nambah file migrasi baru kalau nambah kolom, jalankan lewat Turso Web Dashboard |
| `scripts/migrate-to-turso.js` | Script one-time pemindahan data JSON lama → Turso | 🔴 **Jangan dijalankan ulang** kalau database sudah terisi — bisa dobel data |
| `Models/models.json`, `member-Afi-Studio/member.json` | Arsip/backup data lama, bukan sumber data live lagi | ✅ Boleh dihapus isinya kalau sudah yakin database stabil, tapi disaranin simpan dulu sebagai cadangan |

---

## 5. Keamanan — Ringkasan Cepat

### 🔴 JANGAN diubah/dihapus sembarangan
- `lib/db.js` — jantung koneksi ke semua data
- `db/schema.sql` & `scripts/migrate-to-turso.js` — jangan dijalankan ulang di database yang sudah hidup
- `.gitignore` — mencegah `node_modules/`, `.env`, `.vercel` ikut ter-commit ke GitHub
- Isi Environment Variable berikut — **jangan pernah** ditulis langsung di file kode manapun, semua wajib dibaca lewat `process.env`, di-set di **Vercel → Settings → Environment Variables**:
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - `RECAPTCHA_SECRET_KEY`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
  - `ADMIN_PASSWORD`

### ✅ Aman diubah kapan aja
- Semua file tampilan (`*/index.html`, `*/script.js`)
- `src/input.css`, `tailwind.config.js`, `admin/index.html`
- Nambah file migrasi SQL baru (`db/migration-00X-....sql`) kalau mau nambah kolom baru ke tabel

### Catatan tambahan
- `feedback/index.html` — bagian yang manggil `fetch('/api/feedback', ...)` jangan diubah untuk manggil `api.telegram.org` langsung dari sisi client (bocorin token)
- `admin/index.html` — token login disimpan di `localStorage` browser (bukan server), jadi kalau HP dipinjam orang lain dalam kondisi masih login, logout manual lewat tombol **Keluar**
- Kalau Upstash Redis down, rate limiting di `api/feedback.js` fail-safe (request tetap lolos), tapi reCAPTCHA tetap aktif sebagai lapisan kedua

---

## 6. Sistem PWA

`manifest.json` mendaftarkan 3 icon dengan fungsi berbeda:

| File | Ukuran | `purpose` | Kegunaan |
|---|---|---|---|
| `icon-192.png` | 192×192 | `any` | Icon PWA resolusi standar (app drawer, taskbar) |
| `favicon.png` | 512×512 | `any` | Icon PWA resolusi besar + favicon tab browser |
| `icon-maskable.png` | 512×512 | `maskable` | Icon adaptif Android — punya *safe zone* supaya tidak terpotong saat OS membentuknya jadi lingkaran/squircle |

> `icon.png` (512×512) **tidak didaftarkan di manifest** — file ini khusus dipakai sebagai logo di dalam konten halaman (`<img src="icon.png">` di navbar tiap halaman), bukan untuk kebutuhan PWA.

- `sw.js` (service worker) di-register dari script di `index.html`. Cakupannya sengaja dibatasi: hanya meng-cache halaman root (`/`) supaya bisa dibuka semi-offline; halaman lain (`ranking/`, `feedback/`, dll) tidak di-cache
- `theme-toggle.js` dimuat di semua halaman untuk sinkronisasi preferensi dark/light lewat `localStorage`
- Kalau ganti salah satu ikon PWA, pastikan ukuran & nama file tetap konsisten dengan yang dirujuk di `manifest.json` dan `sw.js`

---

## 7. Cara Menambah/Update Konten

Sejak migrasi ke database Turso, cara utama nambah/ubah konten adalah lewat **panel admin**, bukan edit file JSON manual:

1. Buka `https://afi-studio.vercel.app/admin`
2. Login pakai `ADMIN_PASSWORD`
3. Pilih tab **Models** atau **Members**
4. Isi form → **Simpan** untuk tambah baru, atau klik **Edit** di item yang mau diubah

**Model baru** → upload thumbnail ke hosting gambar eksternal dulu (ibb.co atau sejenisnya), tempel URL-nya di field "URL Thumbnail" pada form admin. Field **"Untuk Aplikasi"** (Prisma3D/Blender/Mine-Imator/Viontri/C4D/Lainnya) cuma boleh 1 pilihan per model — ditampilkan sebagai badge di kartu dan jadi tab filter tambahan di halaman Models.

**Member baru** → field "Kode Grup" boleh pakai grup yang sudah ada (`gen-1`, `gen-2`, `gen-3`, `orang-random`) atau bikin grup baru sama sekali (misal `gen-4`) — halaman member sekarang men-generate kotak generasi secara otomatis berdasarkan data yang ada, jadi **tidak perlu edit HTML lagi** untuk nambah grup baru. Judul kotak yang ditampilkan mengikuti isi field "Generasi" dari member pertama di grup itu.

**Foto profil member baru** → taruh di `member-Afi-Studio/profile/`, gunakan format **WebP**, lalu tempel path/URL-nya di field "URL Foto" pada form admin.

File `Models/models.json` dan `member-Afi-Studio/member.json` yang lama **tidak perlu diedit lagi** — statusnya sekarang arsip/backup saja, tidak dibaca oleh situs.

---

## 8. Fitur yang Sudah Ada & Ide Pengembangan

### Fitur yang sudah bisa diakses lewat `/admin`

| Fitur | Keterangan |
|---|---|
| CRUD Model | Tambah/edit/hapus: nama, caption, creator, converter, kategori (boleh lebih dari satu), **untuk aplikasi (cuma 1 pilihan: Prisma3D/Blender/Mine-Imator/Viontri/C4D/Lainnya)**, thumbnail, link download |
| CRUD Member | Tambah/edit/hapus: nama, spesialis, identitas (emoji), generasi, kode grup, foto, sosial media |
| Perubahan langsung live | Tidak perlu commit/push/deploy — begitu **Simpan** ditekan di admin panel, langsung muncul di halaman publik |

### Fitur di halaman publik `Models/`

- **Filter kategori & filter aplikasi sekarang dinamis** — tab-nya otomatis mengikuti data yang ada di database, tidak lagi di-hardcode di kode. Nambah/hapus kategori atau aplikasi baru cukup lewat isian di admin panel, tidak perlu edit `Models/script.js`
- Badge aplikasi di pojok kartu tiap model
- Search (nama, kategori, creator, converter)

### Fitur di halaman publik `member-Afi-Studio/`

- **Grup generasi sekarang dinamis** — kotak generasi (folder) di-generate otomatis dari data yang ada. Nambah member ke grup baru (misal `gen-4`) lewat admin panel langsung memunculkan kotak grup baru itu di halaman, **tidak perlu edit HTML** lagi

### Ide pengembangan selanjutnya (belum dikerjakan)

- [ ] Search/filter di halaman `member-Afi-Studio/` (sekarang cuma tampil per-generasi, belum bisa dicari)
- [ ] Sorting (model terbaru/terlama, member urut alfabet)
- [ ] Counter download — nambah kolom `download_count` di tabel `models`, di-increment tiap klik "Download Now"
- [ ] Like/rating dari pengunjung untuk tiap model
- [ ] Isi konten asli galeri `ranking/` (submit karya render → tabel baru di Turso → admin approve → tampil otomatis), gantiin placeholder `coming_soon.webp`
- [ ] Multi-admin (sekarang cuma 1 `ADMIN_PASSWORD` untuk semua, belum ada per-akun)
- [ ] Rate limiting untuk `api/models.js` & `api/members.js` (lihat juga poin ini di §12 Status Proyek)

~~Filter kategori/aplikasi dinamis~~ dan ~~grup generasi member dinamis~~ — **selesai dikerjakan**, tidak lagi jadi tugas manual edit kode.
- [ ] Riwayat perubahan (log siapa mengubah apa dan kapan) — baru relevan kalau admin sudah lebih dari 1 orang

Semua ide di atas mengikuti pola yang sama seperti fitur `app_target`: nambah kolom/tabel baru di Turso (lewat migrasi seperti `db/migration-002-add-app-target.sql`), lalu update `api/*.js`, `admin/index.html`, dan halaman publik terkait.

---

## 9. Peran Turso (Database)

Turso adalah database SQLite yang di-hosting di cloud/edge, tempat semua data Model & Member sekarang tersimpan (menggantikan `models.json`/`member.json` statis).

**Cara mengakses/mengelolanya:**
- **Turso Web Dashboard** (turso.tech, login GitHub/Google) — untuk: bikin database baru, lihat/generate token akses, **jalankan SQL manual lewat SQL Shell/Console** (dipakai untuk migrasi skema seperti nambah kolom baru — lihat `db/migration-002-add-app-target.sql`), lihat penggunaan storage
- **Turso CLI** — alternatif dashboard, tapi **diketahui bisa crash di sebagian perangkat Android/Termux** (error `SIGSYS: bad system call` pada `syscall.faccessat2`, masalah kompatibilitas kernel, bukan bug proyek). Kalau ini terjadi, pakai Web Dashboard saja
- **`@libsql/client`** (npm package) — dipakai di dalam kode (`lib/db.js`) untuk baca/tulis data dari server Vercel saat situs jalan; ini yang benar-benar menghubungkan `api/models.js`/`api/members.js` ke database

**Kapan perlu buka dashboard Turso secara manual:**
- Nambah kolom/tabel baru (skema berubah) — jalankan SQL `ALTER TABLE` / `CREATE TABLE` lewat SQL Shell
- Cek isi data langsung (kalau curiga ada data aneh/rusak)
- Generate token baru kalau token lama di-revoke atau bocor
- Cek berapa storage yang sudah terpakai (limit gratis: 5GB)

Untuk operasi sehari-hari (tambah/edit/hapus konten), **tidak perlu buka Turso sama sekali** — semua cukup lewat `/admin`.

---

## 10. Menjalankan Secara Lokal

Karena website memuat data lewat `fetch()` ke API, harus dibuka lewat local server (bukan dibuka langsung dari file manager), dan `api/*.js` butuh Vercel CLI supaya bisa dites.

**Prasyarat semua platform:** [Node.js](https://nodejs.org/) (LTS) + akun Vercel (gratis) + akun Turso (gratis, lihat `db/SETUP.md` untuk cara bikin database dari nol).

> **Catatan Termux/Android:** Turso CLI (biner Go) diketahui bisa crash di sebagian perangkat Android dengan error `SIGSYS: bad system call` pada `syscall.faccessat2` — ini masalah kompatibilitas kernel Android lama, bukan bug proyek ini. Kalau itu terjadi, pakai **Turso Web Dashboard** (turso.tech, login GitHub/Google) buat bikin database & ambil token, alih-alih CLI. Detail lengkap ada di `db/SETUP.md`.

### Termux (Android)
```bash
pkg update && pkg install nodejs git -y
git clone https://github.com/username/Afi-Studio-main.git
cd Afi-Studio-main
npm install
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```
Buka `http://localhost:3000`.
> Kalau muncul error `symlink`/`Permission Denied`: jalankan dari direktori home Termux (`~/`), jangan dari `storage/shared`.

### Windows
```powershell
git clone https://github.com/username/Afi-Studio-main.git
cd Afi-Studio-main
npm install
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```
Buka `http://localhost:3000`.

### Linux
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
git clone https://github.com/username/Afi-Studio-main.git
cd Afi-Studio-main
npm install
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```
Buka `http://localhost:3000`.

### Alternatif ringan (tanpa test fitur feedback)
```bash
python -m http.server 8080
```
Buka `http://localhost:8080` — tampilan bisa dilihat, tapi form feedback tidak akan berfungsi (butuh `vercel dev`).

---

## 11. SEO

- `robots.txt` mengizinkan semua crawler dan menunjuk ke `sitemap.xml`
- `sitemap.xml` memuat daftar URL semua halaman untuk diindeks Google
- Tiap halaman punya `<link rel="canonical">` serta meta Open Graph/Twitter Card — semua harus konsisten memakai domain `afi-studio.vercel.app`
- Kalau ganti domain custom, update di 4 tempat: `robots.txt`, `sitemap.xml`, tiap `<link rel="canonical">`, dan meta `og:url`/`og:image` di semua halaman

---

## 12. Status Proyek

- [x] Token Telegram, reCAPTCHA secret, kredensial Upstash Redis, kredensial Turso, dan `ADMIN_PASSWORD` aman di Environment Variable Vercel, tidak ada yang hardcode di kode
- [x] `api/feedback.js` berfungsi penuh (teks + gambar via `formidable`, rate limiting via Upstash Redis, verifikasi reCAPTCHA v2), teruji di production
- [x] Migrasi data Model & Member dari JSON statis ke database Turso selesai, teruji di production (`/api/models`, `/api/members` aktif dan menampilkan data live)
- [x] Panel admin (`/admin`) berfungsi penuh — tambah/edit/hapus Model & Member tanpa edit kode
- [x] `.gitignore` bekerja, `node_modules/`, `.env`, dan `.vercel` tidak ikut ter-track
- [x] `dist/output.css` valid dan ter-generate benar (Tailwind CLI)
- [x] Domain `sitemap.xml` konsisten dengan `robots.txt` dan canonical tag di semua halaman (termasuk `bantuan/`)
- [x] Font (Outfit, DM Sans, Dancing Script) dan ikon Lucide di-self-host, tidak ada request ke CDN eksternal lagi
- [x] Halaman `bantuan/` (FAQ) sudah live
- [x] Duplikasi `icon.png`/`favicon.png` di tiap subfolder sudah dihapus — semua halaman kini mereferensikan file di root saja
- [x] Nav-bar `event/` sudah disamakan dengan halaman lain (logo, back button, dropdown menu, toggle tema)
- [x] Aset gambar teroptimasi (WebP + kompresi), total ukuran project ±1.2MB
- [x] Deployment Vercel status Ready
- [ ] Konten asli galeri `ranking/` (Juara 1–3 + Top 10) — UI sudah siap, masih menampilkan placeholder `coming_soon.webp`
- [ ] Rate limiting untuk `api/models.js` & `api/members.js` (saat ini `GET` publik tanpa batas, berbeda dari `api/feedback.js` yang sudah dilindungi)

---

## 13. Kontribusi

Punya model, rig, atau map buatan sendiri yang ingin dibagikan? Atau menemukan bug di website ini? Hubungi tim Afi Studio lewat kanal media sosial di halaman member, atau isi halaman **Feedback** di website.

## 14. Lisensi

Hak cipta aset milik masing-masing kreator/converter yang tercantum di setiap item.

---

© 2026 Afi Studio — dibuat dengan ❤️ oleh komunitas Afi Studio
