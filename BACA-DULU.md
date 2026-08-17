# Cara pakai

Extract lalu TIMPA (bukan file baru, 3 file yang udah ada):
```
admin/panel.html
api/admin/auth.js
api/telegram-webhook.js
```

## 1. Admin undangan gak lihat "Kelola Admin" ✅
Ini sebenernya udah jalan dari awal, sempet aku cek ulang abis proses
gabung-endpoint kemarin — masih aman. Menu "Kelola Admin" di sidebar cuma
muncul kalau yang login itu OWNER (token asli), admin yang masuk lewat kode
undangan gak bakal lihat menu itu sama sekali.

## 2. Durasi custom (menit/jam/hari) ✅
Dropdown durasi sekarang ada pilihan **1 Hari / 3 Hari / 7 Hari / 30 Hari /
Permanent / Custom...** — pilih "Custom..." bakal muncul 2 kolom baru:
angka + satuan (Menit/Jam/Hari), bisa diisi bebas (misal "45 Menit" atau
"12 Jam").

Di balik layar, durasinya sekarang disimpan dalam MENIT (bukan hari kayak
sebelumnya) biar presisi ke satuan sekecil apapun.

## 3. Lihat admin aktif dari bot Telegram ✅
Command baru: **`/webadmin`** — nampilin daftar admin panel website yang
lagi aktif (nama/label + kapan expired-nya), plus jumlah totalnya. Juga
ditambahin ke `/menu` (tombol "👥 Web Admin") dan `/help`.

Ini VIEW-ONLY dari bot (buat cabut akses, tetep lewat "Kelola Admin" di
Admin Panel Website — biar semua aksi cabut-mencabut tetep di satu tempat,
gak kecampur 2 sumber kontrol).

Bot bacanya dari data Redis yang SAMA persis dipakai web (gak ada
duplikasi/nyimpen 2x), jadi datanya selalu sinkron — kalau ada yang login
dari web, langsung kelihatan di bot juga.

## Setelah upload
```bash
git add . && git commit -m "Custom durasi invite + lihat admin aktif dari bot Telegram" && git push
```
(kalau ditolak: `git pull --rebase origin main` dulu, baru push lagi)

Tunggu deploy, terus:
- Cek dropdown durasi di "Kelola Admin" — pilih "Custom...", pastiin muncul kolom angka+satuan
- Generate 1 kode pakai durasi custom (misal 2 jam), redeem di tab lain, cek waktu expired-nya bener
- Ketik `/webadmin` ke bot, pastiin daftar admin yang muncul cocok sama yang di web
