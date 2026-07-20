# Afi Studio

Website komunitas berbagi aset Minecraft (model 3D, rig, map, furniture) buatan komunitas Afi Studio. Static site, tanpa backend/database — semua konten dibaca langsung dari file JSON di repo ini.

🔗 **Live:** [afi-studio.vercel.app](https://afi-studio.vercel.app)
📘 Penjelasan versi santai/non-teknis (istilah, alur kerja, troubleshooting) ada di **`PANDUAN-PROYEK.md`**. Dokumen ini fokus ke sisi teknis untuk siapapun yang mau ubah kode.

---

## 1. Cara Kerja (Mekanisme)

Situs ini **static** — tidak ada server aplikasi, tidak ada database. Tiap halaman adalah file HTML mandiri yang saat dibuka browser, langsung `fetch()` file `.json` di sebelahnya, lalu render kartu/list-nya lewat JavaScript vanilla (tanpa framework, tanpa build step untuk JS).

```
Browser buka /Models/  →  Models/script.js fetch("./models.json")
                       →  data di-render jadi kartu HTML di client
                       →  filter kategori & pencarian juga jalan di client (tidak ada request ke server)
```

Satu-satunya bagian yang **bukan** murni statis adalah form Feedback, yang manggil satu serverless function (`api/feedback.js`) buat kirim pesan ke Telegram.

Konsekuensinya:
- Nambah/ubah konten = edit file `.json` langsung di repo, lalu `git push` → Vercel auto-redeploy.
- Tidak ada panel admin, tidak ada login, tidak ada kredensial database untuk dikelola.

## 2. Peta Halaman & Peran File-nya

| Halaman | File utama | Sumber data | Catatan |
|---|---|---|---|
| `/` (Beranda) | `index.html` (HTML+CSS+JS inline dalam satu file) | `videos.json`, `Models/models.json` (sample acak) | Nav, banner slider, marquee, carousel video, footer — semua logic ada langsung di `<script>` dalam file ini |
| `/Models/` | `Models/index.html` + `Models/script.js` | `Models/models.json` | Filter kategori otomatis mengikuti isi JSON, filter aplikasi (Blender/C4D/dll), pencarian, modal detail |
| `/tutorial/` | `tutorial/index.html` + `tutorial/script.js` | `videos.json` | Pencarian judul, badge "Baru" (14 hari), penanda video populer (hitungan `localStorage`, per-device) |
| `/member-Afi-Studio/` | `member-Afi-Studio/index.html` + `script.js` | `member-Afi-Studio/member.json` | Grup generasi (`gen-1`/`gen-2`/`gen-3`/`orang-random`) otomatis dibuat dari `gen_id` yang ada di JSON |
| `/ranking/` | `ranking/index.html` | data ditulis manual **di dalam file ini** (belum pakai JSON terpisah) | Top 3 + Top 10, lightbox. Gambar masih placeholder `coming_soon.webp` |
| `/event/` | `event/index.html` | — | Halaman statis, aturan event render |
| `/bantuan/` | `bantuan/index.html` | — | FAQ statis |
| `/feedback/` | `feedback/index.html` + `api/feedback.js` | — | Satu-satunya halaman yang manggil serverless function |

## 3. File/Source Penting

| File | Peran |
|---|---|
| `Models/models.json`, `member-Afi-Studio/member.json`, `videos.json` | **Sumber data utama** situs. Edit ini = edit konten situs |
| `data.schema.md` | Dokumentasi lengkap tiap field wajib di `videos.json` & `models.json` — **baca dulu sebelum nambah entri** |
| `validate_data.py` | Cek format `videos.json`/`models.json` sebelum push (`python3 validate_data.py`) |
| `config.js` | Toggle buka/tutup jalur pendaftaran Model 3D & Member (dipakai semua halaman lewat tag `<script>`) |
| `theme-toggle.js` | Logic tema gelap/terang + persist pilihan user |
| `sw.js` + `manifest.json` | Service worker & config PWA — hanya halaman root (`/`) yang di-cache untuk mode offline, halaman lain sengaja tidak |
| `src/input.css` → `dist/output.css` | Source Tailwind → hasil compile. Jalankan `npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify` tiap habis nambah class Tailwind baru |
| `tailwind.config.js` | Daftar file yang di-scan Tailwind untuk tahu class mana yang harus disertakan di `output.css`. **Pastikan semua halaman yang memakai `dist/output.css` masuk daftar `content`**, kalau tidak, class yang cuma dipakai di halaman itu akan hilang (ke-purge) |
| `api/feedback.js` | Serverless function pengirim form feedback ke Telegram (pakai rate-limit Upstash + reCAPTCHA) |
| `fonts/fonts.css` | Font self-hosted (Outfit, DM Sans, Dancing Script) — tidak ada request ke Google Fonts CDN |
| `vercel.json` | Aturan `Cache-Control` per jenis file (font/ikon di-cache lama, JSON data di-cache pendek biar update konten cepat kelihatan) |

## 4. Struktur Direktori

```
Afi-Studio-main/
├── index.html                     ← Beranda (HTML+CSS+JS dalam satu file)
├── config.js                      ← Toggle jalur pendaftaran
├── theme-toggle.js                ← Toggle tema gelap/terang
├── videos.json                    ← Data video/tutorial
├── data.schema.md                 ← Dokumentasi format data JSON
├── validate_data.py                ← Validator videos.json & models.json
├── vercel.json                    ← Aturan cache header
├── tailwind.config.js             ← Konfigurasi scan class Tailwind
├── src/input.css                  ← Source Tailwind
├── dist/output.css                ← Hasil compile Tailwind (jangan edit manual)
├── manifest.json, sw.js           ← Konfigurasi PWA & offline cache
├── robots.txt, sitemap.xml        ← SEO dasar
├── Models/
│   ├── index.html, script.js
│   └── models.json                ← Data model/aset
├── tutorial/
│   ├── index.html, script.js
├── member-Afi-Studio/
│   ├── index.html, script.js
│   ├── member.json                ← Data member
│   └── profile/                   ← Foto profil (WebP)
├── ranking/
│   ├── index.html                 ← Data juara ditulis manual di file ini
│   └── coming_soon.webp           ← Placeholder gambar juara
├── event/       (aturan event, statis)
├── bantuan/     (FAQ, statis)
├── feedback/
│   └── index.html
├── api/
│   └── feedback.js                ← Serverless function → Telegram
├── fonts/                         ← Font self-hosted (.woff2)
└── icons/                         ← Ikon self-hosted (Lucide lokal)
```

## 5. Kondisi Source Saat Ini

- **Tanpa database.** Migrasi ke Turso (libSQL) yang pernah dikerjakan sudah **di-revert sepenuhnya** — tidak ada lagi folder `admin/`, `api/models.js`, `api/members.js`, atau `lib/db.js` di repo ini. Semua kembali ke workflow JSON manual.
- **`/ranking/`** masih placeholder — struktur tampilan sudah jadi, tapi data juara & foto (`coming_soon.webp`) belum diganti data asli, dan belum dipindah ke file JSON terpisah seperti Model/Member/Video.
- **Footer di `index.html`** sempat lebar tidak penuh karena breakout trick (`width: 100vw` + `margin-left: calc(50% - 50vw)`) bentrok dengan parent `#app` yang `overflow-auto` — sudah diperbaiki, footer sekarang `width: 100%` biasa (otomatis penuh karena footer sudah jadi sibling langsung `<main>` di dalam `#app`).
- **`tailwind.config.js`** sebelumnya tidak menyertakan `tutorial/index.html`, `bantuan/index.html`, dan file `member-Afi-Studio/*` di daftar `content`, padahal halaman itu memakai `dist/output.css` — berisiko class Tailwind yang cuma dipakai di halaman itu ter-purge dan hilang. Sudah ditambahkan ke `content`, dan `dist/output.css` sudah di-rebuild.
- **Cache header** (`vercel.json`) baru ditambahkan — font/ikon/banner di-cache lama (jarang berubah), file JSON data di-cache pendek (60 detik) supaya update konten tetap cepat terlihat pengunjung.

## 6. Cara Nambah/Update Konten

1. Edit file JSON yang relevan (`Models/models.json`, `member-Afi-Studio/member.json`, atau `videos.json`).
2. Validasi dulu: `python3 validate_data.py` (untuk models/videos) atau `python3 -m json.tool member-Afi-Studio/member.json` (untuk member).
3. `git add -A && git commit -m "pesan"` lalu `git push`.
4. Tunggu Vercel redeploy (biasanya < 1 menit).

Detail wajib per field ada di `data.schema.md`.

## 7. Menjalankan Secara Lokal

```bash
git clone https://github.com/username/Afi-Studio-main.git
cd Afi-Studio-main
npm install
npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify
python3 -m http.server 8080
```
Buka `http://localhost:8080`.

Untuk tes form feedback (butuh `api/feedback.js` jalan), pakai Vercel CLI:
```bash
npm install -g vercel
vercel dev
```

## 8. Keamanan

- Kredensial (`TELEGRAM_BOT_TOKEN`, `RECAPTCHA_SECRET_KEY`, Upstash Redis, dll) disimpan sebagai Environment Variable di Vercel — **jangan pernah** ditulis langsung di kode.
- `.gitignore` mencegah `node_modules/`, `.env`, `.vercel` ter-commit — jangan dihapus.
- `validate_data.py` boleh ada di mana saja di root, **kecuali di dalam `api/`** — Vercel otomatis menjalankan apapun di `api/` sebagai serverless function, file Python di situ bisa bikin deploy gagal.

## 9. Kontribusi & Lisensi

Ada model/rig/map buatan sendiri untuk dibagikan, atau nemu bug? Hubungi tim lewat halaman **Feedback** di situs, atau media sosial di halaman Member. Hak cipta tiap aset ada di masing-masing kreator/converter yang tercantum di setiap item.

---
© 2026 Afi Studio
