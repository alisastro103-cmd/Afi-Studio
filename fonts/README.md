# Font lokal — status

Semua font di sini self-hosted (bukan CDN Google) — tidak ada request keluar
sama sekali saat halaman dibuka. **3 font final** yang dipakai situs ini,
semua sudah format `.woff2` (paling kecil & didukung semua browser modern):

| Font | Peran | Status |
|---|---|---|
| Geist 100–900 (9 weight) | Body, deskripsi, caption, detail text, label, nav, tombol | Aktif, lengkap semua weight |
| CreatoDisplay 300/400/500/700/800/900 | Heading (h1-h4) di semua halaman | Aktif. Weight 600 belum ada file asli — browser pakai 500/700 terdekat, bukan fake-bold karena masih ada face asli di sekitarnya |
| Minercraftory | Judul section/header (`.category-header`, `.folder`) | Aktif — lihat `Minercraftory-LICENSE.txt` (CC BY-SA 3.0). PENTING: selalu pakai `font-weight: 400` (satu-satunya weight asli) — jangan dipaksa 700/800, browser bakal fake-bold dan bikin bentuk hurufnya rusak/berdempetan |
| Dancing Script 700 | Logo/wordmark "Afi-Studio" saja (bukan bagian dari 3 font di atas, identitas brand) | Aktif |

Anton dan Outfit sudah tidak dipakai lagi (dihapus dari folder ini) sejak
CreatoDisplay resmi jadi font heading final.

## Soal format file
Semua font di folder ini sudah dikonversi ke `.woff2` (dari `.ttf`/`.otf`
aslinya) — ukuran total turun dari ~864 KB jadi ~348 KB tanpa bedanya
kelihatan sama sekali, karena woff2 cuma format kompresi, bukan font baru.
Kalau nanti nambah weight baru, convert dulu ke woff2 (misal lewat
https://cloudconvert.com/ttf-to-woff2) sebelum ditaruh di sini, biar
konsisten & tetap kecil.
