# Panduan Lengkap Afi Studio

> Dokumen ini buat gambaran besar: proyek ini apa, kepingan-kepingannya apa aja, dan gimana semuanya saling nyambung. Kalau butuh detail teknis per file (buat ubah kode), baca `README.md`. Kalau butuh detail format data JSON, baca `data.schema.md`.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app)

---

## 1. Ini Proyek Apa?

Afi Studio adalah website komunitas untuk berbagi aset Minecraft — model 3D, rig karakter, map, furniture — biar orang lain bisa lihat dan download. Ada juga halaman buat kenalan sama member komunitas, video tutorial, papan ranking event render, dan form feedback.

Situs ini **sengaja dibuat tanpa database dan tanpa panel admin**. Semua konten (daftar model, daftar member, daftar video) disimpan sebagai file teks terstruktur (`.json`) langsung di dalam kode situs. Nambah/ubah konten = edit file itu, lalu `git push` — Vercel otomatis update situsnya dalam hitungan detik.

> Catatan sejarah: sempat ada percobaan migrasi ke database (Turso) lengkap dengan panel admin `/admin`. Itu **sudah dilepas sepenuhnya** — proyek ini balik lagi ke pendekatan file JSON manual, karena lebih sederhana untuk skala komunitas ini dan tidak butuh biaya/maintenance server tambahan.

## 2. Istilah-Istilah Penting

| Istilah | Penjelasan gampangnya |
|---|---|
| **Repo / Repository** | "Folder proyek" ini, disimpan di GitHub biar ada riwayat perubahannya |
| **GitHub** | Tempat nyimpen kode proyek, semacam Google Drive tapi khusus kode & ada riwayat versi |
| **Vercel** | Tempat website ini "tinggal" di internet. Tiap `git push`, Vercel otomatis update situsnya |
| **JSON** | Format file teks buat nyimpen data terstruktur (mirip tabel), gampang dibaca manusia & komputer. Semua data model/member/video disimpan begini |
| **Static site** | Website yang isinya "sudah jadi" (HTML/CSS/JS biasa), tidak butuh server aplikasi nyala terus. Situs ini ringan & cepat karena begini |
| **Serverless Function** | Kode kecil yang jalan otomatis di server Vercel cuma pas dibutuhkan — di proyek ini cuma dipakai untuk form Feedback |
| **PWA (Progressive Web App)** | Website yang bisa di-"install" ke HP kayak aplikasi, tetap bisa dibuka (halaman utama) meski koneksi jelek |
| **Termux** | Aplikasi terminal Android, dipakai buat jalanin `git push` dari HP tanpa laptop |
| **Validasi** | Proses ngecek format JSON sebelum dipakai/di-push, biar situs tidak error |

## 3. Peta Halaman

| Alamat | Isinya |
|---|---|
| `/` | Beranda — pengantar, sample model & video acak, navigasi ke semua halaman |
| `/Models/` | Katalog semua model — filter kategori & aplikasi tujuan, pencarian |
| `/tutorial/` | Semua video & tutorial YouTube — pencarian, badge "Baru", penanda populer |
| `/member-Afi-Studio/` | Daftar member, dikelompokkan per generasi |
| `/ranking/` | Papan Top 3 + Top 10 karya render — tampilan sudah jadi, datanya masih placeholder |
| `/event/` | Aturan & panduan ikut event render |
| `/bantuan/` | FAQ — pertanyaan umum cara pakai situs |
| `/feedback/` | Form kritik & saran, terkirim ke Telegram tim |

## 4. Dari Mana Datanya?

Tiga file JSON adalah "database" situs ini:

| File | Isinya |
|---|---|
| `Models/models.json` | Semua model/aset yang bisa didownload |
| `member-Afi-Studio/member.json` | Semua member komunitas |
| `videos.json` | Semua video & tutorial YouTube |

Nambah konten = buka file itu, tambah 1 entri baru dengan format yang sama, lalu push. Tidak ada "form isi data" terpisah — cara editnya sama seperti edit teks biasa (nano/vim di Termux, atau editor apapun).

Sebelum push, selalu jalankan validator dulu:
```bash
python3 validate_data.py
```

Detail lengkap tiap field wajib ada di `data.schema.md`.

## 5. Bagaimana Semuanya Saling Nyambung (Alur Kerja)

```
Kamu edit Models/models.json (tambah 1 model baru)
    → git push
    → Vercel deploy ulang otomatis (~1 menit)
    → Pengunjung buka /Models/ → browser fetch models.json → model baru langsung muncul
```

Tidak ada langkah "restart server" atau "migrasi database" — karena memang tidak ada server aplikasi atau database yang perlu dijaga. Satu-satunya pengecualian: form Feedback, yang manggil satu serverless function kecil (`api/feedback.js`) untuk meneruskan pesan ke Telegram tim.

## 6. Fitur yang Sudah Ada

- Katalog model dengan filter kategori (otomatis mengikuti isi JSON) + filter aplikasi tujuan + pencarian
- Video & tutorial dengan badge "Baru" otomatis dan penanda video populer (dihitung per-device lewat `localStorage`, bukan gabungan semua pengunjung — karena situs ini tanpa database)
- Halaman member per generasi, grup baru otomatis muncul kalau ada `gen_id` baru di data
- Tema gelap/terang (ngikutin HP otomatis, bisa toggle manual)
- PWA — bisa di-install ke homescreen, halaman utama tetap terbuka semi-offline
- SEO dasar (sitemap, robots.txt)
- Cache browser diatur lewat `vercel.json` — font/ikon/banner disimpan lama di browser, data JSON tetap cepat update

### Belum Dikerjakan (Ide ke Depan)
- Search/filter di halaman Member
- Sorting (model terbaru/terlama, member alfabet)
- Isi galeri `/ranking/` dengan foto render juara asli, pindahkan datanya ke JSON terpisah
- Counter download / like dari pengunjung — ini baru butuh database beneran kalau mau diterapkan
- **Fitur Favorit** (lagi dipertimbangkan) — nandain model/video favorit tanpa login, tersimpan lokal di browser pengunjung (`localStorage`), ditandai dengan ikon bendera/bintang. Lihat catatan di bagian 8.

## 7. Kalau Ada yang Error

- **Situs nampilin data kosong:** buka langsung file JSON-nya di browser (misal `afi-studio.vercel.app/Models/models.json`), pastikan formatnya masih valid. Jalankan `python3 validate_data.py`
- **Video/model baru tidak muncul:** cek field wajib di `data.schema.md`, pastikan tidak ada yang kosong/typo
- **Member baru tidak muncul di kotak generasinya:** cek field `gen_id`, harus persis salah satu dari `gen-1`/`gen-2`/`gen-3`/`orang-random`
- **Form feedback tidak jalan:** cek Environment Variable di Vercel (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RECAPTCHA_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) sudah ke-set
- **Tampilan halaman berantakan / style hilang setelah nambah class Tailwind baru:** pastikan file halaman itu ada di daftar `content` pada `tailwind.config.js`, lalu jalankan ulang `npx tailwindcss -i ./src/input.css -o ./dist/output.css --minify`

## 8. Rencana Fitur "Favorit" (Diskusi)

Ide dari Randy: tombol tandai favorit di kartu Model & Video, tanpa login, cuma tersimpan di browser pengunjung masing-masing (bukan gabungan semua orang — konsisten dengan pendekatan "tanpa database" situs ini), ditandai ikon bendera.

Kalau mau dilanjutkan, ini yang perlu diputuskan sebelum implementasi:
- **Penyimpanan:** `localStorage`, key berisi array id model/video yang ditandai (mirip pola view-counter video yang sudah ada di `tutorial/script.js`)
- **Tampilan:** ikon bendera di pojok kartu (toggle on/off), plus mungkin halaman/tab "Favorit Saya" yang menyaring dari data yang sama
- **Cakupan:** Model saja, Video saja, atau dua-duanya?
- **Reset:** favorit hilang kalau cache browser dibersihkan — perlu disebutkan ke pengunjung atau tidak?

Detail teknis file mana yang perlu disentuh (kemungkinan besar `Models/script.js`, `tutorial/script.js`, dan CSS terkait) bisa dibahas lebih lanjut begitu arah fiturnya disetujui.

---
© 2026 Afi Studio — dokumen ini dibuat biar tidak perlu mikir ulang dari nol tiap kali balik ke proyek ini.
