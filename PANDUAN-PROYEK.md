# Panduan Lengkap Afi Studio

> Dokumen ini dibuat khusus buat kamu baca ulang kalau lupa sistemnya gimana, atau kalau ada orang baru yang bantu kelola proyek ini dan perlu ngerti dari nol. Ditulis sesantai mungkin, nggak asumsi kamu masih inget istilah teknis.

🔗 **Live site:** [afi-studio.vercel.app](https://afi-studio.vercel.app)
🔗 **Admin panel:** [afi-studio.vercel.app/admin](https://afi-studio.vercel.app/admin)

---

## 1. Ini Proyek Apa, Sih?

Afi Studio itu website buat komunitas kamu berbagi aset Minecraft — model 3D, rig karakter, map, furniture — biar orang lain bisa download dan pakai. Ada juga halaman buat kenalin member-member yang tergabung di komunitas.

Dulu (sebelum Juli 2026) semua datanya (daftar model, daftar member) disimpen manual di file teks (`.json`), jadi tiap mau nambah 1 item, kamu harus buka file itu dan edit teksnya sendiri — capek dan gampang salah ketik. **Sekarang udah nggak gitu lagi** — ada database beneran di cloud, dan ada halaman admin buat isi datanya tinggal isi form, klik simpan.

---

## 2. Istilah-Istilah yang Perlu Kamu Tau

Nggak perlu ngerti detail teknisnya, cukup tau ini "kotak apa":

| Istilah | Penjelasan gampangnya |
|---|---|
| **Vercel** | Tempat website kamu "tinggal" di internet. Setiap kamu `git push`, Vercel otomatis update website-nya. |
| **GitHub** | Tempat nyimpen kode/source code proyek kamu, semacam Google Drive tapi khusus kode. |
| **Turso** | Database-nya — tempat semua data model & member disimpen sekarang (bukan di file JSON lagi). |
| **Database** | Gudang data yang terorganisir rapi, bisa ditambah/ubah/hapus tanpa harus edit file kode. |
| **API** / **Endpoint** | "Pintu" yang dipakai website buat ambil data dari database. Contoh: `/api/models` itu pintu buat ambil daftar model. |
| **Serverless Function** | Kode kecil yang jalan di server Vercel tiap kali ada yang minta data (misal tiap orang buka halaman Models). |
| **Admin Panel** | Halaman `/admin` — tempat kamu tambah/edit/hapus data tanpa nyentuh kode sama sekali. |
| **Environment Variable** | "Kunci rahasia" (password, token) yang disimpen aman di Vercel, bukan ditulis langsung di kode. |
| **Termux** | Aplikasi terminal di HP Android kamu, dipakai buat jalanin perintah kayak `git push`, `npm install`, dll. |

---

## 3. Peta Halaman Website

| Alamat | Isinya |
|---|---|
| `/` | Halaman depan — pengantar, ada beberapa model random, navigasi ke halaman lain |
| `/Models/` | Katalog semua model — bisa difilter per kategori (Furniture, Map, Rig, dll) dan per aplikasi (Blender, C4D, dll), bisa dicari |
| `/member-Afi-Studio/` | Daftar semua member, dikelompokkan per generasi (1st, 2nd, 3rd, dan grup "orang-random") |
| `/ranking/` | Papan peringkat karya render — **masih placeholder**, belum ada isinya beneran |
| `/event/` | Aturan & panduan ikut event render (bukan galeri) |
| `/bantuan/` | FAQ — pertanyaan umum soal cara pakai website |
| `/feedback/` | Form kritik & saran, masuk ke Telegram kamu |
| `/admin/` | **Panel kelola data** — login pakai password, tambah/edit/hapus Model & Member |

---

## 4. Database (Turso) — Isinya Apa Aja

Databasenya punya 2 "tabel" (bayangin kayak 2 spreadsheet Excel terpisah):

### Tabel `models`
Isinya daftar semua aset yang bisa didownload. Tiap baris = 1 model, kolomnya:

| Kolom | Isinya |
|---|---|
| `name` | Nama model (misal "Rig Mob Minecraft") |
| `caption` | Deskripsi singkat |
| `creator` | Nama pembuat asli (boleh kosong) |
| `converter` | Nama yang convert ke Minecraft |
| `category` | Kategori, bisa lebih dari satu (dipisah koma), misal "Rig,Mob,Free" |
| `app_target` | Untuk aplikasi apa — **cuma 1 pilihan**: Prisma3D/Blender/Mine-Imator/Viontri/C4D/Lainnya |
| `thumb` | Link gambar thumbnail (di-hosting di ibb.co, bukan disimpen di website) |
| `link` | Link download modelnya |

### Tabel `members`
Isinya daftar semua member komunitas. Tiap baris = 1 member, kolomnya:

| Kolom | Isinya |
|---|---|
| `nama` | Nama member |
| `spesialis` | Keahlian (misal "Animator, Modeller") |
| `identitas` | 1 emoji penanda member itu |
| `generasi` | Teks yang ditampilin (misal "Generasi ke-1") |
| `gen_id` | **Kode teknis** penentu masuk kotak mana di halaman (`gen-1`, `gen-2`, `gen-3`, `orang-random`) — ini yang paling gampang salah kalau isi manual, harus persis sama |
| `foto` | Link/path foto profil |
| `socials` | Link-link sosial media (YouTube, IG, FB, TikTok, WA, Discord) |

> ⚠️ **Yang paling penting diinget:** `generasi` itu cuma teks buat ditampilin, sedangkan `gen_id` itu yang beneran nentuin member itu nongol di kotak generasi mana. Dua-duanya HARUS diisi kalau nambah member baru lewat admin panel.

**Batas gratis Turso:** 5GB storage (data kamu sekarang jauh di bawah itu, isinya cuma teks pendek-pendek, gambar semua di-hosting di luar).

---

## 5. Cara Kerja Sistemnya (Simpel)

```
Kamu buka /Models/  →  website minta data ke /api/models
                     →  /api/models nanya ke database Turso
                     →  Turso kasih balik data
                     →  ditampilin di layar kamu
```

```
Kamu buka /admin, isi form, klik Simpan
                     →  dikirim ke /api/models (atau /api/members)
                     →  disimpen ke database Turso
                     →  langsung nongol di halaman /Models/ (atau /member-Afi-Studio/)
```

Nggak ada langkah "commit-push-deploy" buat nambah konten sehari-hari — itu cuma perlu kalau kamu ubah **kode/tampilan**, bukan buat nambah data model/member.

---

## 6. Cara Pakai Admin Panel

1. Buka `https://afi-studio.vercel.app/admin`
2. Masukin password (yang kamu bikin sendiri, disimpen di Vercel sebagai `ADMIN_PASSWORD`)
3. Pilih tab **Models** atau **Members** di atas
4. **Nambah data baru** → isi semua kolom form → klik **Simpan**
5. **Edit data** → klik **Edit** di item yang mau diubah → form otomatis keisi → ubah → **Simpan**
6. **Hapus data** → klik **Hapus** → ada konfirmasi dulu
7. Selesai kerja → klik **Keluar** (apalagi kalau HP dipakai orang lain, biar nggak ada yang bisa masuk pakai sesi login kamu)

**Khusus nambah Member baru**, kolom "Kode Grup" harus diisi salah satu dari: `gen-1`, `gen-2`, `gen-3`, atau `orang-random` — persis, jangan ada typo, kalau nggak member-nya nggak bakal muncul di halaman.

---

## 7. Fitur yang Sudah Ada

- ✅ Katalog model dengan filter kategori + filter aplikasi (Blender/C4D/dll) + pencarian
- ✅ Badge "untuk aplikasi apa" di tiap kartu model
- ✅ Halaman member per generasi
- ✅ Admin panel full CRUD (Create/Read/Update/Delete) buat Model & Member
- ✅ Form feedback ke Telegram (dilindungi anti-spam & reCAPTCHA)
- ✅ Tema gelap/terang (ngikutin setting HP otomatis, bisa di-toggle manual)
- ✅ PWA — bisa di-"install" ke homescreen HP kayak aplikasi asli
- ✅ SEO dasar (biar gampang ketemu di Google)

## 8. Fitur yang Belum Ada (Ide ke Depan)

- ⬜ Search/filter di halaman Member (sekarang cuma bisa lihat per-generasi)
- ⬜ Sorting (model terbaru, member alfabet, dll)
- ⬜ Hitung jumlah download tiap model
- ⬜ Like/rating dari pengunjung
- ⬜ Isi beneran halaman `/ranking/` (masih placeholder)
- ⬜ Admin lebih dari 1 password/akun
- ⬜ Batas jumlah request ke `/api/models` & `/api/members` (sekarang belum dibatasi, bisa aja disalahgunakan orang iseng)

---

## 9. Kalau Ada yang Error, Cek Ini Dulu

**Website nampilin data kosong / error 500:**
1. Buka `/api/models` atau `/api/members` langsung di browser, lihat pesannya
2. Kalau ada tulisan error, biasanya artinya `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` di Environment Variable Vercel belum ke-set atau belum di-redeploy
3. Cek Vercel → Settings → Environment Variables, pastiin 3 ini ada: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD`

**Admin panel nggak bisa login:**
- Password yang dipakai harus sama persis dengan `ADMIN_PASSWORD` di Vercel, ini bukan password dari Turso/GitHub

**Turso CLI crash di Termux (`SIGSYS: bad system call`):**
- Ini masalah kompatibilitas Android lama, bukan bug proyek. Solusinya: pakai **Turso Web Dashboard** (turso.tech, login GitHub/Google) buat urusan database, jangan pakai CLI

**Member baru nggak muncul di halaman:**
- Cek lagi kolom "Kode Grup" pas nambah — harus persis `gen-1`/`gen-2`/`gen-3`/`orang-random`

---

## 10. File-File Penting (Kalau Perlu Ubah Kode)

| File | Ngapain |
|---|---|
| `admin/index.html` | Tampilan & logic halaman admin |
| `api/models.js`, `api/members.js` | "Pintu" yang menghubungkan website ke database |
| `lib/db.js` | Cara koneksi ke database Turso |
| `db/schema.sql` | Struktur tabel database (referensi, bukan buat dijalanin ulang) |
| `Models/script.js`, `member-Afi-Studio/script.js` | Logic tampilan halaman Models & Member |
| `.env.example` | Contoh nama-nama Environment Variable yang dibutuhkan |

Detail lebih teknis (struktur folder lengkap, keamanan, cara jalanin di lokal) ada di `README.md`.

---

© 2026 Afi Studio — dokumen panduan ini dibuat biar kamu nggak perlu mikir ulang dari nol tiap kali balik ke proyek ini.
