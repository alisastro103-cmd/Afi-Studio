# Afi Studio

Website berbagi aset Minecraft (model, rig, map, dan furniture) yang dibuat oleh komunitas Afi Studio. Pengunjung bisa menjelajahi, mencari, dan mengunduh berbagai aset siap pakai, serta mengenal member-member yang tergabung di dalamnya.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app)

---

## 1. Ringkasan Sistem

- Static site: HTML + CSS (Tailwind) + JavaScript murni, tanpa framework frontend
- Hosting: Vercel, terhubung langsung ke repo GitHub (auto-deploy tiap push ke `main`)
- Data: **JSON statis** — `Models/models.json` dan `member-Afi-Studio/member.json` adalah sumber data live, dibaca langsung lewat `fetch()` oleh browser, tanpa database maupun API perantara
- Nambah/ubah konten dilakukan manual: edit file JSON lewat Termux, lalu `git commit` + `git push`
- Backend yang masih ada cuma `api/feedback.js` (proxy form feedback ke Telegram)
- PWA-ready: installable ke homescreen, punya service worker

---

## 2. Struktur Folder

```
Afi-Studio-main/
├── api/
│   └── feedback.js
├── index.html
├── Models/
│   ├── index.html
│   ├── script.js
│   └── models.json           (sumber data live Models)
├── member-Afi-Studio/
│   ├── index.html
│   ├── script.js
│   ├── member.json            (sumber data live Member)
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

Semua halaman (kecuali `index.html`) berbagi komponen yang sama: nav-bar sticky dengan logo `icon.png` dari root, tombol back, dropdown menu pindah halaman, dan toggle tema light/dark.

---

## 4. Peran Setiap Bagian Sistem

### 🎨 Frontend (tampilan, yang dilihat pengunjung)

| File/Folder | Peran | Boleh diubah? |
|---|---|---|
| `*/index.html` (Models, member-Afi-Studio, ranking, event, bantuan, feedback, root) | Markup & style tiap halaman | ✅ Bebas |
| `*/script.js` | Logic: fetch data dari file JSON lokal (`models.json`/`member.json`), render UI, filter, interaksi tombol | ✅ Bebas, hati-hati di bagian `fetch('/Models/models.json')` / `fetch('/member-Afi-Studio/member.json')` |
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
| `api/feedback.js` | Terima form feedback, rate limiting (Upstash Redis, 5x/10 menit per IP), verifikasi reCAPTCHA v2, kirim ke Telegram Bot API | ✅ Boleh, sudah teruji stabil |
| `package.json` / `package-lock.json` | Dependency: `tailwindcss`, `formidable`, `@upstash/ratelimit`, `@upstash/redis` | ✅ Boleh nambah dependency baru |
| `Models/models.json`, `member-Afi-Studio/member.json` | Sumber data live untuk halaman Models & Member — diedit manual, lalu commit & push | ✅ Bebas, cukup jaga format JSON tetap valid |

---

## 5. Keamanan — Ringkasan Cepat

### 🔴 JANGAN diubah/dihapus sembarangan
- `.gitignore` — mencegah `node_modules/`, `.env`, `.vercel` ikut ter-commit ke GitHub
- Isi Environment Variable berikut — **jangan pernah** ditulis langsung di file kode manapun, semua wajib dibaca lewat `process.env`, di-set di **Vercel → Settings → Environment Variables**:
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - `RECAPTCHA_SECRET_KEY`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### ✅ Aman diubah kapan aja
- Semua file tampilan (`*/index.html`, `*/script.js`)
- `src/input.css`, `tailwind.config.js`
- `Models/models.json`, `member-Afi-Studio/member.json` — tambah/edit/hapus entri model & member manual, pastikan format JSON tetap valid (cek dengan `python3 -m json.tool nama-file.json` sebelum commit)

### Catatan tambahan
- `feedback/index.html` — bagian yang manggil `fetch('/api/feedback', ...)` jangan diubah untuk manggil `api.telegram.org` langsung dari sisi client (bocorin token)
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

Konten dikelola manual lewat file JSON, diedit langsung di Termux, lalu commit & push ke GitHub (Vercel auto-deploy tiap push ke `main`):

1. Buka repo di Termux, edit file JSON yang relevan dengan editor teks (`nano`, `vim`, atau editor pilihanmu)
2. Pastikan format JSON tetap valid sebelum commit — cek dengan `python3 -m json.tool Models/models.json` (ganti nama file sesuai yang diedit)
3. `git add -A && git commit -m "pesan commit" && git push`
4. Tunggu Vercel selesai deploy (biasanya < 1 menit), lalu cek langsung di situs live

**Model baru** → tambah objek baru di array `Models/models.json`. Upload thumbnail ke hosting gambar eksternal dulu (ibb.co atau sejenisnya), isi URL-nya di field `thumb`. Field `app_target` (Prisma3D/Blender/Mine-Imator/Viontri/C4D/Lainnya) cuma boleh 1 nilai per model — ditampilkan sebagai badge di kartu dan jadi tab filter tambahan di halaman Models.

**Member baru** → tambah objek baru di key grup yang sesuai di `member-Afi-Studio/member.json` (`gen-1`, `gen-2`, `gen-3`, `orang-random`), atau bikin key grup baru sama sekali (misal `gen-4`) — halaman member otomatis men-generate kotak generasi baru dari key yang ada di JSON, jadi **tidak perlu edit HTML** untuk nambah grup baru.

**Foto profil member baru** → taruh di `member-Afi-Studio/profile/`, gunakan format **WebP**, lalu isi path/URL-nya di field `foto` pada entri member.

---

## 8. Fitur yang Sudah Ada & Ide Pengembangan

### Fitur di halaman publik `Models/`

- Filter kategori & filter aplikasi dinamis — tab-nya otomatis mengikuti data yang ada di `Models/models.json`, tidak di-hardcode di kode. Nambah/hapus kategori atau aplikasi baru cukup lewat entri JSON, tidak perlu edit `Models/script.js`
- Badge aplikasi di pojok kartu tiap model
- Search (nama, kategori, creator, converter)

### Fitur di halaman publik `member-Afi-Studio/`

- Grup generasi dinamis — kotak generasi (folder) di-generate otomatis dari key yang ada di `member.json`. Nambah member ke grup baru (misal `gen-4`) lewat entri JSON langsung memunculkan kotak grup baru itu di halaman, **tidak perlu edit HTML** lagi

### Ide pengembangan selanjutnya (belum dikerjakan)

- [ ] Search/filter di halaman `member-Afi-Studio/` (sekarang cuma tampil per-generasi, belum bisa dicari)
- [ ] Sorting (model terbaru/terlama, member urut alfabet)
- [ ] Counter download, like/rating dari pengunjung — butuh backend/database baru kalau mau diterapkan (saat ini situs sengaja tanpa database)
- [ ] Isi konten asli galeri `ranking/`, gantiin placeholder `coming_soon.webp`

Semua ide di atas, kalau butuh data dinamis dari pengunjung (bukan cuma dikelola manual lewat JSON), akan butuh backend/database baru — situs saat ini sengaja didesain tanpa database demi kesederhanaan.

---

## 9. Menjalankan Secara Lokal

Karena `feedback/` memanggil `api/feedback.js`, kalau mau tes fitur itu perlu Vercel CLI. Untuk sekadar lihat tampilan/isi konten (Models, Member, dll), cukup local static server biasa karena data dimuat dari file JSON di repo.

**Prasyarat semua platform:** [Node.js](https://nodejs.org/) (LTS) + akun Vercel (gratis, hanya perlu kalau mau tes `api/feedback.js`).

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

## 10. SEO

- `robots.txt` mengizinkan semua crawler dan menunjuk ke `sitemap.xml`
- `sitemap.xml` memuat daftar URL semua halaman untuk diindeks Google
- Tiap halaman punya `<link rel="canonical">` serta meta Open Graph/Twitter Card — semua harus konsisten memakai domain `afi-studio.vercel.app`
- Kalau ganti domain custom, update di 4 tempat: `robots.txt`, `sitemap.xml`, tiap `<link rel="canonical">`, dan meta `og:url`/`og:image` di semua halaman

---

## 11. Status Proyek

- [x] Token Telegram, reCAPTCHA secret, dan kredensial Upstash Redis aman di Environment Variable Vercel, tidak ada yang hardcode di kode
- [x] `api/feedback.js` berfungsi penuh (teks + gambar via `formidable`, rate limiting via Upstash Redis, verifikasi reCAPTCHA v2), teruji di production
- [x] Data Model & Member kembali ke JSON statis (`Models/models.json`, `member-Afi-Studio/member.json`), dikelola manual via Termux + git, tanpa database/API perantara
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

---

## 12. Kontribusi

Punya model, rig, atau map buatan sendiri yang ingin dibagikan? Atau menemukan bug di website ini? Hubungi tim Afi Studio lewat kanal media sosial di halaman member, atau isi halaman **Feedback** di website.

## 13. Lisensi

Hak cipta aset milik masing-masing kreator/converter yang tercantum di setiap item.

---

© 2026 Afi Studio — dibuat dengan ❤️ oleh komunitas Afi Studio
