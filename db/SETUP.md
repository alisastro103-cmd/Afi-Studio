# Setup Database Turso — Afi Studio

Langkah-langkah bikin database gratis dan nyambungin ke proyek.

## 1. Install Turso CLI (di Termux)

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

Kalau perintah `turso` belum kekenal setelah install, tutup-buka lagi Termux
atau jalankan `source ~/.bashrc`.

## 2. Login / daftar akun

```bash
turso auth login
```

Ini bakal buka browser buat login (pakai GitHub/Google). Kalau di Termux
susah buka browser, dia bakal kasih link — buka link itu manual di Chrome HP.

## 3. Bikin database

```bash
turso db create afi-studio-db
```

## 4. Ambil URL & Token

```bash
turso db show afi-studio-db --url
turso db tokens create afi-studio-db
```

Simpan 2 hasil ini (URL dan token) — ini yang bakal dipasang di Vercel.

## 5. Pasang di Vercel

Buka project di vercel.com > Settings > Environment Variables, tambah:

| Key                  | Value                          |
|----------------------|---------------------------------|
| `TURSO_DATABASE_URL` | hasil dari `turso db show --url` |
| `TURSO_AUTH_TOKEN`   | hasil dari `turso db tokens create` |
| `ADMIN_PASSWORD`     | password bebas buatan sendiri untuk masuk `/admin` |

Terapkan ke semua environment (Production, Preview, Development).

## 6. Migrasi data lama (sekali saja)

Di Termux, dari folder proyek:

```bash
npm install
export TURSO_DATABASE_URL="isi-dari-langkah-4"
export TURSO_AUTH_TOKEN="isi-dari-langkah-4"
node scripts/migrate-to-turso.js
```

Script ini otomatis bikin tabel (dari `db/schema.sql`) lalu mindahin isi
`Models/models.json` dan `member-Afi-Studio/member.json` ke database.
Aman dijalankan ulang — kalau tabel udah ada isinya, migrasi dilewati
supaya nggak dobel data.

## 7. Deploy & tes

```bash
git add .
git commit -m "Tambah database Turso + admin panel"
git push
```

Setelah Vercel selesai deploy:
- Buka `https://domainmu.com/admin` → login pakai `ADMIN_PASSWORD`
- Cek halaman Models & Member biar datanya masih muncul normal

## Catatan soal grup member

Halaman member (`member-Afi-Studio/index.html`) punya container tetap:
`gen-1`, `gen-2`, `gen-3`, `orang-random`. Kalau nambah member baru ke
grup yang SUDAH ADA, isi field "Kode Grup" di admin panel persis sama
(misal `gen-2`). Kalau mau bikin grup generasi baru sama sekali, itu
butuh nambah HTML container baru dulu — kabari aku kalau perlu, tinggal
tambah beberapa baris di `member-Afi-Studio/index.html`.
