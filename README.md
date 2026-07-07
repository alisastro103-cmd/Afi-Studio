# Afi Studio

Website berbagi aset Minecraft (model, rig, map, dan furniture) yang dibuat oleh komunitas Afi Studio. Pengunjung bisa menjelajahi, mencari, dan mengunduh berbagai aset siap pakai, serta mengenal member-member yang tergabung di dalamnya.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app)

---

## 1. Ringkasan Sistem

- Static site: HTML + CSS (Tailwind) + JavaScript murni, tanpa framework frontend
- Hosting: Vercel, terhubung langsung ke repo GitHub (auto-deploy tiap push ke `main`)
- Backend minimal: 1 serverless function (`api/feedback.js`) untuk proxy form feedback ke Telegram
- PWA-ready: installable ke homescreen, punya service worker
- Data konten (model & member) disimpan terpisah dalam file JSON, dimuat dinamis lewat `fetch()`

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
│   └── models.json
├── member-Afi-Studio/
│   ├── index.html
│   ├── script.js
│   ├── member.json
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
└── .gitignore
```

> ⚠️ **Sudah tidak berlaku:** folder `images/` yang disebut di versi README sebelumnya **tidak lagi ada**. Semua thumbnail model sekarang di-hosting eksternal (ibb.co) dan dirujuk lewat field `thumb` di `Models/models.json`, bukan file lokal di project.

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

## 4. Peran Source Code

| File/Folder | Peran | Kategori |
|---|---|---|
| `*/index.html` | Markup & style tiap halaman | UI |
| `*/script.js` | Logic: fetch data JSON, render UI, interaksi tombol | UI/Fitur |
| `Models/models.json` | Data seluruh model (nama, kategori, thumbnail eksternal, link download, converter) | Konten |
| `member-Afi-Studio/member.json` | Data seluruh member | Konten |
| `theme-toggle.js` | Script bersama untuk semua halaman — toggle dark/light, simpan preferensi ke `localStorage`, ikut `prefers-color-scheme` sistem selama user belum pilih manual | UI/Fitur |
| `fonts/fonts.css` + `fonts/*.woff2` | Font self-hosted (Outfit, DM Sans, Dancing Script) hasil convert dari TTF ke WOFF2 — pengganti Google Fonts CDN, jadi tidak ada request keluar sama sekali saat halaman dibuka | Aset/Performa |
| `icons/lucide-local.js` | Bundle ikon Lucide yang di-self-host, pengganti CDN eksternal | Aset/Performa |
| `api/feedback.js` | Serverless function — terima form feedback, dilindungi rate limiting (Upstash Redis, 5x/10 menit per IP) dan verifikasi reCAPTCHA v2 di server, baru kirim ke Telegram Bot API pakai token dari environment variable | **Keamanan** |
| `src/input.css` | Sumber Tailwind (`@tailwind base/components/utilities`) | Build |
| `dist/output.css` | Hasil compile Tailwind — file inilah yang dipakai semua halaman, bukan `src/input.css` langsung | Build output |
| `tailwind.config.js` | Config Tailwind, termasuk `content` (daftar file yang di-scan) | Build config |
| `manifest.json` | Metadata PWA (nama app, ikon, warna tema) | PWA |
| `sw.js` | Service Worker — cache khusus `index.html` (root) supaya tetap bisa dibuka offline; halaman lain sengaja tidak di-cache | PWA |
| `robots.txt` / `sitemap.xml` | Instruksi & daftar URL untuk Google Search | SEO |
| `package.json` / `package-lock.json` | Dependency: `tailwindcss` (compile CSS), `formidable` (parsing upload gambar feedback), `@upstash/ratelimit` + `@upstash/redis` (rate limiting API feedback) | Build |
| `.gitignore` | File/folder yang sengaja tidak ikut Git (`node_modules/`, `.env`, `.vercel`) | Git config |

---

## 5. Keamanan — File Sensitif vs Aman Diubah

### ✅ Aman diubah bebas
- `index.html`, `Models/`, `ranking/`, `event/`, `bantuan/` — tampilan & markup
- `*/script.js` — logic UI, animasi, interaksi
- `Models/models.json`, `member-Afi-Studio/member.json` — konten
- `src/input.css`, `tailwind.config.js` — styling
- `manifest.json`, `sw.js`, `theme-toggle.js` — konfigurasi PWA & tema
- `fonts/`, `icons/` — aset self-hosted (font & ikon)
- `robots.txt`, `sitemap.xml` — pastikan domain tetap konsisten (`afi-studio.vercel.app`, pakai strip)

### 🔴 Sensitif — perlu hati-hati
- `api/feedback.js` — **jangan pernah** hardcode nilai environment variable berikut langsung di file ini atau file mana pun. Semua wajib dibaca lewat `process.env`, di-set di **Vercel → Settings → Environment Variables** (ditandai *Sensitive*):
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - `RECAPTCHA_SECRET_KEY`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `feedback/index.html` — bagian script yang memanggil `fetch('/api/feedback', ...)`. Jangan diubah untuk memanggil `api.telegram.org` langsung dari sisi client
- `.gitignore` — jangan dihapus, ini yang mencegah `node_modules/`, `.env`, dan `.vercel` ikut ter-commit

**Aturan untuk API key/token baru ke depannya:** selalu simpan sebagai Environment Variable di Vercel, baca lewat `process.env` di dalam file folder `api/`. Jangan pernah ditulis langsung di HTML/JS yang dikirim ke browser.

> **Catatan trade-off yang disengaja:** kalau Upstash Redis sedang down, rate limiting di `api/feedback.js` fail-safe (request tetap lolos, availability diprioritaskan), tapi reCAPTCHA tetap aktif sebagai lapisan proteksi kedua.

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

**Model baru** → tambahkan entri di `Models/models.json`, ikuti format entri yang sudah ada (nama, kategori, `thumb` berupa URL gambar eksternal, link download, nama converter). Upload thumbnail ke hosting gambar (ibb.co atau sejenisnya) dulu, lalu tempel URL-nya — **jangan** taruh file gambar di dalam project, karena folder `images/` lokal sudah tidak dipakai lagi.

**Member baru** → tambahkan entri di `member-Afi-Studio/member.json`, taruh di grup generasi yang sesuai.

**Foto profil member baru** → taruh di `member-Afi-Studio/profile/`. Gunakan format **WebP** supaya konsisten dan tetap ringan — convert dulu kalau sumbernya PNG/JPG.

Tidak perlu menyentuh file `.js` untuk menambah konten apa pun — semua data dipisah di file `.json`.

---

## 8. Menjalankan Secara Lokal

Karena website memuat data lewat `fetch()`, harus dibuka lewat local server (bukan dibuka langsung dari file manager), dan `api/feedback.js` butuh Vercel CLI supaya bisa dites.

**Prasyarat semua platform:** [Node.js](https://nodejs.org/) (LTS) + akun Vercel (gratis).

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

## 9. SEO

- `robots.txt` mengizinkan semua crawler dan menunjuk ke `sitemap.xml`
- `sitemap.xml` memuat daftar URL semua halaman untuk diindeks Google
- Tiap halaman punya `<link rel="canonical">` serta meta Open Graph/Twitter Card — semua harus konsisten memakai domain `afi-studio.vercel.app`
- Kalau ganti domain custom, update di 4 tempat: `robots.txt`, `sitemap.xml`, tiap `<link rel="canonical">`, dan meta `og:url`/`og:image` di semua halaman

---

## 10. Status Proyek

- [x] Token Telegram, reCAPTCHA secret, dan kredensial Upstash Redis aman di Environment Variable Vercel, tidak ada yang hardcode di kode
- [x] `api/feedback.js` berfungsi penuh (teks + gambar via `formidable`, rate limiting via Upstash Redis, verifikasi reCAPTCHA v2), teruji di production
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

## 11. Kontribusi

Punya model, rig, atau map buatan sendiri yang ingin dibagikan? Atau menemukan bug di website ini? Hubungi tim Afi Studio lewat kanal media sosial di halaman member, atau isi halaman **Feedback** di website.

## 12. Lisensi

Hak cipta aset milik masing-masing kreator/converter yang tercantum di setiap item.

---

© 2026 Afi Studio — dibuat dengan ❤️ oleh komunitas Afi Studio
