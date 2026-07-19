# Afi Studio

Website berbagi aset Minecraft (model, rig, map, dan furniture) buatan komunitas Afi Studio. Pengunjung bisa menjelajah, mencari, dan mengunduh aset siap pakai, nonton video tutorial, dan kenalan sama member-member yang tergabung di komunitas.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app)

> 📘 Dokumen ini dibuat buat siapapun — termasuk yang gak ngerti coding sama sekali — biar bisa ngerti proyek ini secara garis besar. Kalau kamu mau tau detail teknis lebih dalam (struktur data, cara validasi, dll), cek `data.schema.md`.

---

## 1. Istilah-Istilah Penting

Biar gak bingung pas baca dokumen ini atau ngobrol soal proyek:

| Istilah | Penjelasan gampangnya |
|---|---|
| **Repo / Repository** | "Folder proyek" ini, tapi disimpen di GitHub biar ada riwayat perubahannya |
| **Vercel** | Tempat website ini "tinggal" di internet. Tiap kamu `git push`, Vercel otomatis update situsnya, gak perlu upload manual |
| **GitHub** | Tempat nyimpen kode proyek, semacam Google Drive tapi khusus buat kode & ada riwayat versi |
| **JSON** | Format file teks buat nyimpen data terstruktur (mirip daftar/tabel), gampang dibaca manusia maupun komputer. Semua data model, member, dan video di situs ini disimpen dalam bentuk ini |
| **Static site** | Website yang isinya "sudah jadi" (HTML/CSS/JS biasa), bukan yang butuh server nyala terus buat ngolah data. Makanya situs ini ringan & cepat |
| **Termux** | Aplikasi terminal di HP Android, dipakai buat jalanin perintah kayak `git push` dari HP tanpa laptop |
| **Serverless Function** | Kode kecil yang jalan otomatis di server Vercel cuma pas dibutuhkan (di proyek ini cuma dipakai buat form Feedback) |
| **Environment Variable** | "Kunci rahasia" (password, token) yang disimpen aman di pengaturan Vercel, bukan ditulis langsung di kode |
| **PWA (Progressive Web App)** | Website yang bisa di-"install" ke HP kayak aplikasi biasa, dan tetap bisa dibuka meski koneksi lagi jelek |
| **Validasi** | Proses ngecek data (JSON) itu formatnya benar sebelum dipakai/di-push, biar gak bikin situs error |

---

## 2. Peta Halaman

| Alamat | Isinya |
|---|---|
| `/` | Halaman depan — pengantar, beberapa model & video acak, navigasi ke semua halaman lain |
| `/Models/` | Katalog semua model — bisa difilter per kategori, bisa dicari |
| `/tutorial/` | Semua video & tutorial YouTube — bisa dicari judulnya, ada badge "Baru" & penanda video populer |
| `/member-Afi-Studio/` | Daftar member komunitas, dikelompokkan per generasi |
| `/ranking/` | Papan peringkat karya render — **masih placeholder**, belum ada isinya beneran |
| `/event/` | Aturan & panduan ikut event render (bukan galeri foto) |
| `/bantuan/` | FAQ — pertanyaan umum soal cara pakai website |
| `/feedback/` | Form kritik & saran, terkirim ke Telegram tim |

---

## 3. Dari Mana Datanya?

Website ini **sengaja tidak pakai database**. Semua konten disimpen di 3 file JSON, dibaca langsung oleh browser pengunjung:

| File | Isinya |
|---|---|
| `Models/models.json` | Semua model/aset yang bisa didownload |
| `member-Afi-Studio/member.json` | Semua member komunitas |
| `videos.json` | Semua video & tutorial YouTube |

**Artinya:** nambah/edit konten = edit file JSON itu langsung, lalu `git push`. Gak ada "panel admin" terpisah — cara editnya sama kayak edit teks biasa lewat editor (nano/vim di Termux, atau VS Code kalau di laptop).

📖 **Struktur lengkap tiap field** (field apa aja yang wajib diisi, formatnya gimana) ada di **`data.schema.md`** — baca ini dulu sebelum nambah entri baru biar gak salah format.

✅ **Sebelum push**, selalu jalankan dulu:
```bash
python3 validate_data.py
```
Script ini otomatis ngecek `videos.json` dan `Models/models.json` — kasih tau persis kalau ada field yang kurang, format tanggal salah, kategori kosong, dll — sebelum sempat bikin situs live error.

---

## 4. Fitur yang Sudah Ada

**Model (`/Models/`)**
- Filter kategori otomatis (tab filter mengikuti isi `models.json`, gak perlu edit kode buat nambah kategori baru)
- Badge aplikasi tujuan (Blender/C4D/dll) di tiap kartu
- Pencarian (nama, kategori, creator, converter)

**Video & Tutorial (`/tutorial/` + beranda)**
- Pencarian judul video
- Badge **"Baru"** otomatis untuk video yang baru ditambahkan (14 hari terakhir), hilang sendiri setelah itu
- Penanda **"🔥 Video Populer"** — dihitung dari video yang paling sering dibuka di device pengunjung (disimpan di `localStorage` browser, bukan hitungan gabungan semua pengunjung karena situs ini tanpa database)

**Member (`/member-Afi-Studio/`)**
- Grup generasi otomatis — nambah key baru di `member.json` langsung bikin kotak grup baru muncul, tanpa edit HTML

**Umum**
- Tema gelap/terang (ngikutin HP otomatis, bisa di-toggle manual)
- PWA — bisa di-install ke homescreen, halaman utama tetap bisa dibuka semi-offline
- SEO dasar (biar gampang ketemu di Google)

### Ide pengembangan selanjutnya (belum dikerjakan)
- [ ] Search/filter di halaman Member
- [ ] Sorting (model terbaru/terlama, member alfabet)
- [ ] Isi konten asli galeri `/ranking/`, ganti placeholder
- [ ] Counter download / like dari pengunjung — ini butuh database beneran kalau mau diterapkan, karena situs ini sengaja tanpa database

---

## 5. Struktur Folder (Ringkas)

```
Afi-Studio-main/
├── index.html                  ← Halaman depan
├── videos.json                 ← Data video/tutorial
├── data.schema.md              ← Dokumentasi format data JSON
├── validate_data.py            ← Cek data sebelum push
├── Models/
│   ├── index.html
│   ├── script.js
│   └── models.json              ← Data model
├── tutorial/
│   ├── index.html
│   └── script.js
├── member-Afi-Studio/
│   ├── index.html
│   ├── script.js
│   ├── member.json               ← Data member
│   └── profile/                  ← Foto profil member
├── ranking/    (placeholder)
├── event/      (aturan event)
├── bantuan/    (FAQ)
├── feedback/   (form feedback)
├── api/
│   └── feedback.js             ← Backend form feedback → Telegram
├── fonts/, icons/               ← Font & ikon self-hosted
├── src/input.css, dist/output.css  ← Sumber & hasil compile Tailwind
├── manifest.json, sw.js         ← Pengaturan PWA & offline
└── theme-toggle.js              ← Toggle tema gelap/terang
```

---

## 6. Cara Nambah/Update Konten

1. Buka repo (di Termux atau laptop), edit file JSON yang relevan
2. **Cek dulu formatnya** dengan `python3 validate_data.py` (untuk `videos.json`/`models.json`) atau `python3 -m json.tool member-Afi-Studio/member.json` (untuk member)
3. `git add -A && git commit -m "pesan commit" && git push`
4. Tunggu Vercel selesai deploy (biasanya < 1 menit), cek langsung di situs live

**Detail field wajib per jenis data** (model, video, member) ada di `data.schema.md` — baca dulu biar gak ada field yang kelewat.

**Foto profil member baru** → taruh di `member-Afi-Studio/profile/`, format **WebP**, isi path/URL-nya di field `foto`.

**Thumbnail model baru** → upload dulu ke hosting gambar eksternal (ibb.co atau sejenisnya), isi URL-nya di field `thumb` — bukan file lokal di repo.

---

## 7. Keamanan — Ringkasan Cepat

- **Jangan pernah** tulis token/password langsung di file kode. Semua kredensial (Telegram Bot Token, reCAPTCHA secret, dll) disimpen sebagai Environment Variable di **Vercel → Settings → Environment Variables**
- `.gitignore` mencegah `node_modules/`, `.env`, dan `.vercel` ikut ter-commit ke GitHub — jangan dihapus
- `validate_data.py` boleh ditaruh di manapun di root proyek, **kecuali di dalam folder `api/`** — Vercel otomatis mencoba menjalankan apapun di `api/` sebagai serverless function, dan file Python di situ bisa bikin deploy gagal

---

## 8. Menjalankan Secara Lokal

Karena `feedback/` manggil `api/feedback.js`, kalau mau tes fitur itu butuh Vercel CLI. Untuk sekadar lihat tampilan/konten (Models, Member, Tutorial), cukup local static server biasa.

**Prasyarat:** [Node.js](https://nodejs.org/) (LTS).

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

**Alternatif ringan** (tanpa test form feedback):
```bash
python3 -m http.server 8080
```
Buka `http://localhost:8080`.

---

## 9. Kalau Ada yang Error

- **Situs nampilin data kosong:** buka langsung file JSON-nya di browser (misal `afi-studio.vercel.app/Models/models.json`), pastikan formatnya masih valid. Jalankan `python3 validate_data.py` buat cek otomatis
- **Video/model baru gak muncul:** cek lagi field wajib di `data.schema.md`, pastikan gak ada yang kosong/typo
- **Form feedback gak jalan:** cek Environment Variable di Vercel (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RECAPTCHA_SECRET_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) sudah ke-set semua

---

## 10. Kontribusi & Lisensi

Punya model, rig, atau map buatan sendiri yang ingin dibagikan? Atau nemu bug di website ini? Hubungi tim Afi Studio lewat media sosial di halaman Member, atau isi halaman **Feedback** di website.

Hak cipta tiap aset milik masing-masing kreator/converter yang tercantum di setiap item.

---

© 2026 Afi Studio — dibuat dengan ❤️ oleh komunitas Afi Studio
