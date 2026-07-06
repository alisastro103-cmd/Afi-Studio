# Font lokal — status & cara melengkapi

Semua weight yang sudah aktif dipakai di `fonts.css` kini dalam format
`.woff2` (termasuk Outfit 400 & 700, yang sebelumnya masih `.ttf` — sudah
dikonversi untuk menghemat ukuran file tanpa mengubah tampilan sama sekali).

Yang BELUM ada (situs tetap tampil normal, cuma fallback ke weight terdekat /
font sistem untuk bagian ini sampai kamu lengkapi):

| Font | Weight | Nama file yang diharapkan |
|---|---|---|
| Outfit | 500 | `Outfit-500.woff2` |
| Outfit | 600 | `Outfit-600.woff2` |
| Outfit | 800 | `Outfit-800.woff2` |
| DM Sans | 400 | `DMSans-400.woff2` |
| DM Sans | 500 | `DMSans-500.woff2` |
| DM Sans | 600 | `DMSans-600.woff2` |
| Dancing Script | 700 | `DancingScript-700.woff2` |

## Cara paling gampang melengkapi (5 menit, sekali saja, butuh internet sekali ini saja)

1. Buka: https://google-webfonts-helper.herokuapp.com/fonts (atau versi mirror-nya:
   https://gwfh.mranftl.com/fonts) — pilih font **Outfit**, centang weight 500, 600, 800
   → download → pilih format **woff2**.
2. Ulangi untuk **DM Sans** (weight 400, 500, 600) dan **Dancing Script** (weight 700).
3. Rename file hasil download sesuai tabel di atas, taruh semua di folder `fonts/` ini
   (sejajar dengan `fonts.css`).
4. Buka `fonts/fonts.css`, hapus tanda komentar `/* ... */` di bagian bawah file
   (sudah saya siapkan blok kodenya, tinggal di-uncomment).
5. Selesai — tidak perlu ubah HTML apa pun lagi, karena semua halaman sudah menunjuk
   ke `fonts.css` ini.

## Alternatif kalau mau lebih presisi / official
Download langsung dari https://fonts.google.com/specimen/Outfit (dan
/specimen/DM+Sans, /specimen/Dancing+Script) → tombol "Get font" → extract →
convert ke `.woff2` (bisa pakai https://transfonter.org/ secara offline-tool
atau CLI `fonttools` kalau kamu punya `pip install fonttools brotli`).


