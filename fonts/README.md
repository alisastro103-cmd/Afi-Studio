# Font lokal — status

Semua font di sini self-hosted (`.woff2`, dari paket npm @fontsource / rilis resmi,
bukan CDN Google) — tidak ada request keluar sama sekali saat halaman dibuka.

| Font | Peran | Status |
|---|---|---|
| Geist 700 & 800 | Body, deskripsi, caption, detail text, label, nav, tombol | Aktif. Baru 2 weight (Bold/ExtraBold) — belum ada Regular/Medium (400/500/600), jadi browser sementara nampilin versi Bold buat teks yang minta weight itu |
| Anton | Heading (h1-h4) di semua halaman | Aktif — lihat `Anton-OFL-LICENSE.txt` (SIL OFL 1.1) |
| Minercraftory | Judul section/header (`.category-header`, `.folder`) | Aktif — lihat `Minercraftory-LICENSE.txt` (CC BY-SA 3.0) |
| Dancing Script 700 | Logo/wordmark "Afi-Studio" | Aktif |

## Kalau mau lengkapi Geist Regular/Medium
Download dari https://vercel.com/font (resmi, gratis, lisensi SIL OFL) — ambil
`Geist-Regular.woff2` (400) dan `Geist-Medium.woff2` (500) atau `Geist-SemiBold.woff2`
(600), taruh di folder ini, lalu tambahkan blok `@font-face` baru di `fonts.css`
mengikuti pola yang sudah ada untuk weight 700/800.
