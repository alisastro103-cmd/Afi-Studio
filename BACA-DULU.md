# Cara pakai

## 1. HAPUS 2 item ini dulu
```
admin/fonts/                (seluruh folder)
admin/coming_soon.webp
```
```bash
git rm -r admin/fonts
git rm admin/coming_soon.webp
```

## 2. Extract & timpa/tambah file dari zip ini
```
admin/index.html            (timpa — link font diarahin ke /fonts/ punya root)
admin/panel.html            (timpa — sama, link font diarahin ke /fonts/)
admin/tailwind.config.js    (timpa — sekarang scan panel.html juga, sebelumnya kelewat)
admin/src/input.css         (BARU — source Tailwind admin, ikutin konvensi yang sama kayak root)
admin/dist/output.css       (timpa — hasil build ulang dari config yang udah dibenerin)
README.md                   (timpa — dokumentasinya disesuaikan sama perubahan ini)
```

## Ringkasan yang diubah

1. **`admin/fonts/` dihapus** — itu duplikat 100% identik sama `fonts/` di root (208KB
   kembar). Sekarang `admin/index.html` & `admin/panel.html` sama-sama pakai
   `/fonts/fonts.css` yang di root, gak ada lagi 2 salinan.

2. **`admin/coming_soon.webp` dihapus** — sama persis kayak `ranking/coming_soon.webp`,
   tapi gak dipakai di mana pun dalam kode admin. Orphan murni.

3. **Bug ke-temu & dibenerin**: `admin/tailwind.config.js` sebelumnya cuma nyuruh Tailwind
   scan `admin/index.html` doang — `admin/panel.html` (file terbesar di seluruh repo)
   gak pernah ke-scan. CSS-nya udah aku build ulang dari config yang bener, jadi kalau
   nanti ada yang nambah class Tailwind baru di panel.html dan build ulang, class-nya
   gak bakal ilang/ke-purge lagi.

**Dampak ke tampilan: NOL** — ini murni beres-beres file, gak ada perubahan visual atau
fungsional sama sekali. Cuma ngirit ~208KB dari repo + benerin bug config yang bisa
jadi masalah di masa depan.

## Setelah upload
```bash
git add -A
git commit -m "Beres-beres: hapus font & gambar duplikat, fix config Tailwind admin"
git pull --rebase origin main
git push
```

Tunggu deploy, terus cek admin panel-nya masih tampil normal (font, ikon, style semua
harusnya sama persis kayak sebelumnya — kalau ada yang keliatan aneh, kabarin).
