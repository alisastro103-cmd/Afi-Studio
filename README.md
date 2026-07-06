# Afi Studio

Website berbagi aset Minecraft (model, rig, map, dan furniture) yang dibuat oleh komunitas Afi Studio. Pengunjung bisa menjelajahi, mencari, dan mengunduh berbagai aset siap pakai, serta mengenal member-member yang tergabung di dalamnya.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app)

---

## 1. Ringkasan Sistem

- Static site: HTML + CSS (Tailwind) + JavaScript murni, tanpa framework frontend
- Hosting: Vercel, terhubung langsung ke repo GitHub (auto-deploy tiap push ke `main`)
- Backend minimal: 1 serverless function (`api/feedback.js`) — proxy form feedback ke Telegram, dengan proteksi rate limiting (Upstash) dan anti-bot (Google reCAPTCHA)
- PWA-ready: installable ke homescreen, punya service worker
- SEO-ready: sitemap, robots.txt, canonical tag, Open Graph, dan structured data
- Data konten (model & member) disimpan terpisah dalam file JSON, dimuat dinamis lewat `fetch()`

---

## 2. Layanan Eksternal yang Terhubung

Proyek ini terhubung ke 4 layanan pihak ketiga. Berikut peran masing-masing dan bagaimana mereka saling terhubung:

| Layanan | Peran | Terhubung lewat |
|---|---|---|
| **GitHub** | Menyimpan source code + seluruh riwayat versi (folder `.git`). Titik awal dari alur kerja: semua perubahan proyek dimulai dari sini | Repo: `https://github.com/<username>/Afi-Studio.git` |
| **Vercel** | Hosting + auto-deploy. Begitu ada `git push` ke branch `main`, Vercel otomatis mendeteksi perubahan lewat integrasi GitHub dan build ulang situs. Juga tempat menyimpan **Environment Variables** (semua secret/API key) | Folder `.vercel/` (config lokal) + GitHub integration |
| **Google** | Berperan ganda: (1) lewat **Search Console**, membaca `sitemap.xml` & `robots.txt` untuk mengindeks halaman ke hasil pencarian; (2) lewat **reCAPTCHA**, menyediakan widget verifikasi "bukan robot" di form feedback — tokennya diverifikasi server-side di `api/feedback.js` | `sitemap.xml`, `robots.txt`, script reCAPTCHA di `feedback/index.html`, env var `RECAPTCHA_SECRET_KEY` |
| **Upstash** | Menyediakan database Redis kecil untuk **rate limiting** — mencatat berapa kali satu IP mengirim feedback dalam 10 menit terakhir, supaya form tidak bisa di-spam | `api/feedback.js`, env var `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` |

**Alur kerja lengkap:**
```
GitHub (simpan kode)
   ↓ git push
Vercel (build & deploy otomatis)
   ↓
Pengunjung buka situs → isi form feedback
   ↓
Google reCAPTCHA (verifikasi manusia) + Upstash (cek rate limit)
   ↓ lolos semua
Telegram (notifikasi masuk ke admin)
```

---

## 3. Struktur Folder

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
│   └── *.woff2
├── icons/
│   └── lucide-local.js
├── theme-toggle.js
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

## 4. Penjelasan Tiap Halaman

| Halaman | Isi & Fungsi |
|---|---|
| `index.html` | Landing page — pengantar Afi Studio, banner promosi, navigasi ke semua halaman lain |
| `Models/` | Katalog aset Minecraft — filter kategori, pencarian, data dimuat dari `models.json` |
| `member-Afi-Studio/` | Daftar profil member, dikelompokkan per generasi, tiap profil punya modal detail & link sosial media |
| `ranking/` | Papan peringkat member/karya — saat ini masih placeholder "segera hadir" |
| `event/` | Galeri render hasil event komunitas |
| `feedback/` | Form kritik & saran — terhubung ke Telegram lewat `api/feedback.js`, dilindungi reCAPTCHA & rate limiting, support lampiran gambar (maks 1MB) |
| `bantuan/` | Pusat bantuan / FAQ seputar Afi Studio |

---

## 5. Peran Source Code & Hubungan Antar File

| File/Folder | Peran | Kategori |
|---|---|---|
| `*/index.html` | Markup & style tiap halaman | UI |
| `*/script.js` | Logic: fetch data JSON, render UI, interaksi tombol | UI/Fitur |
| `theme-toggle.js` | Logic tombol ganti tema light/dark, dipakai bersama di semua halaman | UI/Fitur |
| `icons/lucide-local.js` | Versi ringan ikon Lucide (hanya 9 ikon yang benar-benar dipakai), pengganti CDN eksternal | UI/Aset |
| `Models/models.json` | Data seluruh model (nama, kategori, thumbnail, link download, converter) | Konten |
| `member-Afi-Studio/member.json` | Data seluruh member | Konten |
| `api/feedback.js` | Serverless function — terima form feedback, cek rate limit (Upstash), verifikasi reCAPTCHA (Google), lalu kirim ke Telegram Bot API pakai token dari server | **Keamanan** |
| `src/input.css` | Sumber Tailwind (`@tailwind base/components/utilities`) | Build |
| `dist/output.css` | Hasil compile Tailwind — file inilah yang dipakai semua halaman, bukan `src/input.css` langsung | Build output |
| `tailwind.config.js` | Config Tailwind, termasuk `content` (daftar file yang di-scan) | Build config |
| `manifest.json` | Metadata PWA (nama app, ikon, warna tema) | PWA |
| `sw.js` | Service Worker — caching halaman root & kemampuan install PWA | PWA |
| `robots.txt` / `sitemap.xml` | Instruksi & daftar URL untuk Google Search | SEO |
| `package.json` / `package-lock.json` | Dependency (`tailwindcss`, `formidable`, `@upstash/ratelimit`, `@upstash/redis`) | Build |
| `.gitignore` | File/folder yang sengaja tidak ikut Git (`node_modules/`, `.env`, `.vercel`) | Git config |

**Rantai ketergantungan yang penting untuk dipahami:**
- Styling: `src/input.css` → (compile via `tailwind.config.js`) → `dist/output.css` (yang dipakai di HTML)
- Katalog model: `Models/index.html` → `Models/script.js` → `fetch()` → `Models/models.json`
- Profil member: `member-Afi-Studio/index.html` → `member-Afi-Studio/script.js` → `fetch()` → `member.json`
- Form feedback: `feedback/index.html` (form + widget reCAPTCHA) → `fetch('/api/feedback')` → `api/feedback.js` → Upstash (rate limit) → Google (verifikasi reCAPTCHA) → Telegram Bot API

---

## 6. SEO

- `robots.txt` mengizinkan semua crawler dan menunjuk ke `sitemap.xml`
- `sitemap.xml` memuat daftar URL semua halaman untuk diindeks Google
- Tiap halaman punya `<link rel="canonical">` serta meta Open Graph/Twitter Card — semua harus konsisten memakai domain `afi-studio.vercel.app`
- `index.html` juga punya structured data (`application/ld+json`) supaya nama "Afi Studio" tampil rapi di hasil pencarian Google
- Kalau ganti domain custom, update di 4 tempat: `robots.txt`, `sitemap.xml`, tiap `<link rel="canonical">`, dan meta `og:url`/`og:image` di semua halaman

---

## 7. Sistem PWA

- `manifest.json` mendaftarkan nama app, ikon (`favicon.png`, `icon-192.png`, `icon-maskable.png`), warna tema, dan `display: standalone`
- `sw.js` (service worker) menangani caching aset (khusus halaman root `/`) supaya situs bisa diakses semi-offline dan memunculkan opsi "Install App" di browser mobile
- Script inline di `<head>` tiap halaman membaca `localStorage` dan set mode gelap/terang **sebelum** halaman dirender, mencegah "kedipan" tampilan
- Kalau ganti ikon PWA, pastikan ukuran & nama file tetap konsisten dengan yang dirujuk di `manifest.json`

---

## 8. Keamanan — File Sensitif vs Aman Diubah

### ✅ Aman diubah bebas
- `index.html`, `Models/`, `ranking/`, `event/`, `bantuan/` — tampilan & markup
- `*/script.js`, `theme-toggle.js` — logic UI, animasi, interaksi
- `Models/models.json`, `member-Afi-Studio/member.json` — konten
- `src/input.css`, `tailwind.config.js` — styling
- `manifest.json`, `sw.js` — konfigurasi PWA
- `robots.txt`, `sitemap.xml` — pastikan domain tetap konsisten (`afi-studio.vercel.app`)

### 🔴 Sensitif — perlu hati-hati
- `api/feedback.js` — **jangan pernah** hardcode nilai-nilai berikut langsung di file ini atau file mana pun:
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - `RECAPTCHA_SECRET_KEY`
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

  Semua nilai di atas wajib dibaca lewat `process.env`, dengan value-nya diset di **Vercel → Settings → Environment Variables** (idealnya ditandai *Sensitive*)
- `feedback/index.html` — bagian script yang memanggil `fetch('/api/feedback', ...)`. Jangan diubah untuk memanggil `api.telegram.org` atau Upstash langsung dari sisi client
- Site key reCAPTCHA (`data-sitekey`) di `feedback/index.html` **aman** untuk publik/terlihat — yang wajib dirahasiakan hanya `RECAPTCHA_SECRET_KEY`-nya
- `.gitignore` — jangan dihapus, ini yang mencegah `node_modules/`, `.env`, dan `.vercel` ikut ter-commit

**Aturan untuk API key/token baru ke depannya:** selalu simpan sebagai Environment Variable di Vercel, baca lewat `process.env` di dalam file folder `api/`. Jangan pernah ditulis langsung di HTML/JS yang dikirim ke browser.

**Catatan fail-open:** `api/feedback.js` sengaja dirancang supaya kalau Upstash sedang down/error, request tetap diloloskan (availability diprioritaskan di atas rate-limit saat outage). Ini trade-off yang disengaja, bukan bug — reCAPTCHA tetap aktif sebagai lapisan proteksi meski rate limit sedang tidak berfungsi.

---

## 9. Cara Menambah/Update Konten

**Model baru** → tambahkan entri di `Models/models.json`, ikuti format entri yang sudah ada.

**Member baru** → tambahkan entri di `member-Afi-Studio/member.json`, taruh di grup generasi yang sesuai.

**Gambar/thumbnail baru** → taruh di folder yang relevan (mis. `member-Afi-Studio/profile/` untuk foto member). Gunakan format **WebP** supaya konsisten dan tetap ringan.

Tidak perlu menyentuh file `.js` untuk menambah konten apa pun — semua data dipisah di file `.json`.

---

## 10. Menjalankan Secara Lokal

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

### Windows / Linux
```bash
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

## 11. Status Proyek

- [x] Token Telegram, reCAPTCHA secret, dan kredensial Upstash aman di Environment Variable Vercel, tidak ada di kode
- [x] `api/feedback.js` berfungsi penuh (teks + gambar, rate limiting, verifikasi reCAPTCHA), teruji di production
- [x] `.gitignore` bekerja, `node_modules/`, `.env`, dan `.vercel` tidak ikut ter-track
- [x] `dist/output.css` valid dan ter-generate benar
- [x] Domain `sitemap.xml` konsisten dengan `robots.txt` dan canonical tag
- [x] Aset gambar teroptimasi (WebP + kompresi)
- [x] Deployment Vercel status Ready
- [ ] `juara.html` (galeri pemenang kompetisi) — belum dibuat

---

## 12. Kontribusi

Punya model, rig, atau map buatan sendiri yang ingin dibagikan? Atau menemukan bug di website ini? Hubungi tim Afi Studio lewat kanal media sosial di halaman member, atau isi halaman **Feedback** di website.

## 13. Lisensi

Hak cipta aset milik masing-masing kreator/converter yang tercantum di setiap item.

---

© 2026 Afi Studio — dibuat dengan ❤️ oleh komunitas Afi Studio
