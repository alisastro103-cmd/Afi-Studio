# Font lokal — status

Semua font di sini self-hosted (bukan CDN Google) — tidak ada request keluar
sama sekali saat halaman dibuka. **3 font final** yang dipakai situs ini:

| Font | Peran | Status |
|---|---|---|
| Geist 500/600/700/800 | Body, deskripsi, caption, detail text, label, nav, tombol | Aktif. Belum ada Regular (400) — browser nampilin versi 500 buat teks yang minta weight di bawah itu |
| CreatoDisplay 300/700 | Heading (h1-h4) di semua halaman | Aktif. Cuma ada Light & Bold — weight lain (400/500/600/800) di-map browser ke yang paling dekat |
| Minercraftory | Judul section/header (`.category-header`, `.folder`) | Aktif — lihat `Minercraftory-LICENSE.txt` (CC BY-SA 3.0) |
| Dancing Script 700 | Logo/wordmark "Afi-Studio" saja (bukan bagian dari 3 font di atas, identitas brand) | Aktif |

Anton dan Outfit sudah tidak dipakai lagi (dihapus dari folder ini) sejak
CreatoDisplay resmi jadi font heading final.

## Kalau mau lengkapi Geist Regular (400)
Download dari https://vercel.com/font (resmi, gratis, lisensi SIL OFL) — ambil
`Geist-Regular.woff2`, taruh di folder ini, lalu tambahkan blok `@font-face`
baru di `fonts.css` mengikuti pola yang sudah ada untuk weight 500/600/700/800.

## Soal format file (.ttf/.otf vs .woff2)
`Geist-500.ttf`, `Geist-600.ttf`, `CreatoDisplay-300.otf`, `CreatoDisplay-700.otf`,
dan `Minercraftory.ttf` masih format asli (TrueType/OpenType), belum dikompres
ke `.woff2`. Fungsinya sama persis di browser, cuma ukuran file sedikit lebih
besar dari versi woff2. Kalau mau dikecilin, convert lewat
https://cloudconvert.com/ttf-to-woff2 (atau otf-to-woff2), lalu ganti
ekstensi + `format('woff2')` di `fonts.css`.
