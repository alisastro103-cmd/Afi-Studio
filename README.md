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
├── images/
├── src/input.css
├── dist/output.css
├── manifest.json
├── sw.js
├── robots.txt
├── sitemap.xml
├── tailwind.config.js
├── package.json
├── package-lock.json
└── .gitignore
```

---

## 3. Penjelasan Tiap Halaman

| Halaman | Isi & Fungsi |
|---|---|
| `index.html` | Landing page — pengantar Afi Studio, navigasi ke semua halaman lain |
| `Models/` | Katalog aset Minecraft — filter kategori, pencarian, dan 3D model viewer (Three.js) yang support format Java (block/item) maupun Bedrock (entity geometry) |
| `member-Afi-Studio/` | Daftar profil member, dikelompokkan per generasi (`gen-1`, `gen-2`, `gen-3`, `orang-random`), tiap profil ada spesialisasi & link sosial media |
| `ranking/` | Papan peringkat member/karya — saat ini masih placeholder "segera hadir" |
| `event/` | Galeri render hasil event komunitas |
| `feedback/` | Form kritik & saran — terhubung ke Telegram lewat `api/feedback.js`, support lampiran gambar (maks 1MB) |

---

## 4. Peran Source Code

| File/Folder | Peran | Kategori |
|---|---|---|
| `*/index.html` | Markup & style tiap halaman | UI |
| `*/script.js` | Logic: fetch data JSON, render UI, interaksi tombol | UI/Fitur |
| `Models/models.json` | Data seluruh model (nama, kategori, thumbnail, link download, converter) | Konten |
| `member-Afi-Studio/member.json` | Data seluruh member | Konten |
| `api/feedback.js` | Serverless function — terima form feedback, kirim ke Telegram Bot API pakai token dari server | **Keamanan** |
| `src/input.css` | Sumber Tailwind (`@tailwind base/components/utilities`) | Build |
| `dist/output.css` | Hasil compile Tailwind — file inilah yang dipakai semua halaman, bukan `src/input.css` langsung | Build output |
| `tailwind.config.js` | Config Tailwind, termasuk `content` (daftar file yang di-scan) | Build config |
| `manifest.json` | Metadata PWA (nama app, ikon, warna tema) | PWA |
| `sw.js` | Service Worker — caching & kemampuan install PWA | PWA |
| `robots.txt` / `sitemap.xml` | Instruksi & daftar URL untuk Google Search | SEO |
| `package.json` / `package-lock.json` | Dependency (`tailwindcss` untuk compile CSS, `formidable` untuk parsing upload gambar) | Build |
| `.gitignore` | File/folder yang sengaja tidak ikut Git (`node_modules/`, `.env`) | Git config |

---

## 5. Keamanan — File Sensitif vs Aman Diubah

### ✅ Aman diubah bebas
- `index.html`, `Models/`, `ranking/`, `event/` — tampilan & markup
- `*/script.js` — logic UI, animasi, interaksi
- `Models/models.json`, `member-Afi-Studio/member.json` — konten
- `src/input.css`, `tailwind.config.js` — styling
- `manifest.json`, `sw.js` — konfigurasi PWA
- `robots.txt`, `sitemap.xml` — pastikan domain tetap konsisten (`afi-studio.vercel.app`, pakai strip)

### 🔴 Sensitif — perlu hati-hati
- `api/feedback.js` — **jangan pernah** hardcode `TELEGRAM_BOT_TOKEN` atau `TELEGRAM_CHAT_ID` langsung di file ini atau file mana pun. Kedua nilai itu wajib dibaca lewat `process.env`, dengan value-nya diset di **Vercel → Settings → Environment Variables** (ditandai *Sensitive*)
- `feedback/index.html` — bagian script yang memanggil `fetch('/api/feedback', ...)`. Jangan diubah untuk memanggil `api.telegram.org` langsung dari sisi client
- `.gitignore` — jangan dihapus, ini yang mencegah `node_modules/` dan file `.env` ikut ter-commit

**Aturan untuk API key/token baru ke depannya:** selalu simpan sebagai Environment Variable di Vercel, baca lewat `process.env` di dalam file folder `api/`. Jangan pernah ditulis langsung di HTML/JS yang dikirim ke browser.

---

## 6. Sistem PWA

- `manifest.json` mendaftarkan nama app, ikon (`favicon.png`, `icon.png`), warna tema, dan `display: standalone`
- `sw.js` (service worker) di-register dari script di `index.html`, menangani caching aset supaya situs bisa diakses semi-offline dan memunculkan opsi "Install App" di browser mobile
- Kalau ganti ikon PWA, pastikan ukuran & nama file tetap konsisten dengan yang dirujuk di `manifest.json`

---

## 7. Cara Menambah/Update Konten

**Model baru** → tambahkan entri di `Models/models.json`, ikuti format entri yang sudah ada (nama, kategori, thumbnail, link download, nama converter).

**Member baru** → tambahkan entri di `member-Afi-Studio/member.json`, taruh di grup generasi yang sesuai.

**Gambar/thumbnail baru** → taruh di `images/` (untuk model) atau `member-Afi-Studio/profile/` (untuk foto member). Gunakan format **WebP** supaya konsisten dan tetap ringan — convert dulu kalau sumbernya PNG/JPG.

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

- [x] Token Telegram aman di Environment Variable Vercel, tidak ada di kode
- [x] `api/feedback.js` berfungsi penuh (teks + gambar, via `formidable`), teruji di production
- [x] `.gitignore` bekerja, `node_modules/` tidak ikut ter-track
- [x] `dist/output.css` valid dan ter-generate benar
- [x] Domain `sitemap.xml` konsisten dengan `robots.txt` dan canonical tag
- [x] Aset gambar teroptimasi (WebP + kompresi), ukuran project ±800KB
- [x] Deployment Vercel status Ready
- [ ] `juara.html` (galeri pemenang kompetisi) — belum dibuat

---

## 11. Kontribusi

Punya model, rig, atau map buatan sendiri yang ingin dibagikan? Atau menemukan bug di website ini? Hubungi tim Afi Studio lewat kanal media sosial di halaman member, atau isi halaman **Feedback** di website.

## 12. Lisensi

Hak cipta aset milik masing-masing kreator/converter yang tercantum di setiap item.

---

© 2026 Afi Studio — dibuat dengan ❤️ oleh komunitas Afi Studio
