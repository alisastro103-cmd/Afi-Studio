# Skema Data — `videos.json` & `models.json`

> Dokumen ini nerangin struktur 2 file data statis yang dipakai website:
> `videos.json` (root) dan `Models/models.json`. Tujuannya biar kalau kamu
> (atau siapapun) mau nambah/edit entri manual, formatnya konsisten dan gak
> bikin fitur (badge "Baru", view counter, filter kategori, dll) jadi rusak.
>
> Sebelum push perubahan ke 2 file ini, jalanin `python3 validate_data.py`
> dulu dari root folder proyek — script itu bakal cek semua aturan di bawah
> secara otomatis.

---

## 1. `videos.json`

Array of object, tiap object = 1 video (dipakai di halaman `/tutorial/` dan
carousel "Video & Tutorial" di beranda).

```json
{
  "id": "tutorial-5",
  "title": "Cara Rig Mob di Blender",
  "url": "https://youtu.be/XXXXXXXXXXX?si=xxxxx",
  "added": "2026-07-15"
}
```

| Field | Wajib? | Tipe | Keterangan |
|---|---|---|---|
| `id` | ✅ | string | Identitas unik video, **harus beda** dari semua video lain. Dipakai buat nyimpen jumlah view di localStorage pengunjung. Format bebas tapi disaranin `tutorial-N` (angka urut) atau slug singkat (`rig-mob-blender`). Sekali dipakai dan situs sudah live, **jangan diubah lagi** — kalau `id` berubah, hitungan view video itu balik ke 0 karena dianggap video baru. |
| `title` | ✅ | string | Judul video, tampil di kartu & modal player. Ini juga yang dipakai buat pencarian di halaman `/tutorial/`. |
| `url` | ✅ | string | Link YouTube video (bentuk `youtu.be/...` atau `youtube.com/watch?v=...` / `/shorts/...`). Harus mengandung ID video YouTube 11 karakter yang valid, karena dipakai buat generate thumbnail & link embed. |
| `added` | ✅ | string (`YYYY-MM-DD`) | Tanggal video ditambahkan. Dipakai buat nentuin badge **"Baru"** — video otomatis dapat badge itu kalau `added` masih dalam 14 hari terakhir (lihat `NEW_BADGE_DAYS` di `tutorial/script.js`). Isi tanggal hari ini kalau lagi nambah video baru. |

**Cara kerja badge "Baru":** murni dihitung dari selisih tanggal `added` ke
tanggal sekarang, gak perlu di-set manual per video. Setelah 14 hari, badge
hilang sendiri — gak perlu edit apa-apa lagi.

**Cara kerja view counter "Populer":** tiap kali video dibuka (modal player
kebuka), `id` video itu +1 di localStorage browser pengunjung (key
`afi-video-views`). Ini **hitungan per-device**, bukan hitungan global semua
pengunjung situs (karena situsnya gak punya backend/database buat video).
Section "🔥 Video Populer" di halaman `/tutorial/` otomatis nongol kalau
minimal ada 1 video yang pernah dibuka di device itu, diurutkan dari yang
paling sering ditonton.

---

## 2. `Models/models.json`

Array of object, tiap object = 1 model/aset yang bisa didownload.

```json
{
  "name": "Rig Mob Minecraft",
  "caption": "Rig Mob Minecraft not full it's free.",
  "creator": "",
  "converter": "alisastro123",
  "category": ["Minecraft", "Rig", "Mob", "Free"],
  "app_target": "Blender",
  "thumb": "https://i.ibb.co.com/9kfSzwfF/mob-minecraft.webp",
  "link": "https://www.mediafire.com/file/ynm849b3g243pnc/Mob_Minecraft_Full.zip/file"
}
```

| Field | Wajib? | Tipe | Keterangan |
|---|---|---|---|
| `name` | ✅ | string | Nama model, tampil di judul kartu & modal. |
| `caption` | ✅ | string | Deskripsi singkat, tampil di bawah nama di kartu. |
| `creator` | opsional | string | Nama pembuat asli aset (boleh string kosong `""` kalau gak tau/gak ada). |
| `converter` | opsional | string | Nama yang convert aset ke format Minecraft (boleh kosong `""`). |
| `category` | ✅ | array of string | Minimal 1 kategori. Dipakai buat tombol filter di `/Models/` & beranda — tombol filter itu **otomatis** ke-generate dari semua kategori unik yang ada di file ini (lihat `recomputeFilters()` di `Models/script.js`), jadi nambah kategori baru cukup ketik di sini, gak perlu edit kode. |
| `app_target` | opsional (tapi sangat disarankan diisi) | string | Aplikasi tujuan aset ini — **cuma 1 nilai**, harus salah satu dari: `Prisma3D`, `Blender`, `Mine-Imator`, `Viontri`, `C4D`, `Lainnya`. Tampil sebagai badge kecil di pojok kartu. |
| `thumb` | ✅ | string (URL) | Link gambar thumbnail. Di-hosting eksternal (ibb.co), bukan file lokal di repo. |
| `link` | ✅ | string (URL) | Link download aset (biasanya Mediafire/Google Drive/dll). |

> ⚠️ Catatan konsistensi: field `category` di sini **case-sensitive** untuk
> tampilan tombol filter (misal `"Minecraft"` dan `"minecraft"` akan dianggap
> 2 kategori beda kalau beda huruf besar/kecil), jadi coba selalu pakai
> kapitalisasi yang sama tiap nulis kategori yang sama.

---

## 3. Ringkasan aturan validasi (dicek otomatis oleh `validate_data.py`)

**`videos.json`:**
- Harus berupa array of object
- Tiap entri wajib punya `id`, `title`, `url`, `added`
- `id` harus unik di seluruh file
- `url` harus mengandung ID video YouTube yang valid (11 karakter)
- `added` harus format tanggal `YYYY-MM-DD` yang valid

**`Models/models.json`:**
- Harus berupa array of object
- Tiap entri wajib punya `name`, `caption`, `category`, `thumb`, `link`
- `category` harus array dan tidak boleh kosong
- `thumb` dan `link` harus diawali `http://` atau `https://`
- Kalau `app_target` diisi, harus salah satu dari daftar yang valid (lihat tabel di atas)

Kalau ada aturan di atas yang dilanggar, script akan berhenti dengan pesan
error yang nunjuk persis di entri keberapa masalahnya, dan keluar dengan
exit code 1 (biar bisa dipasang sebagai pre-push hook / CI check).
