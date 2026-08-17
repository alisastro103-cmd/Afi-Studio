# Cara pakai

Ini perbaikan buat error "Build Failed — No more than 12 Serverless Functions"
yang muncul di Vercel kamu. **File yang harus DIHAPUS dulu**, baru ditimpa.

## 1. Hapus 6 file ini (udah digabung jadi 1 file `api/admin/auth.js`)
```
api/admin/verify.js
api/admin/invite-create.js
api/admin/invite-redeem.js
api/admin/whoami.js
api/admin/session-list.js
api/admin/session-revoke.js
```

## 2. Extract & timpa 3 file ini ke folder yang sama
```
api/admin/auth.js       (BARU)
admin/panel.html
admin/index.html
```

`api/admin/telegram-file.js` **JANGAN dihapus** — itu tetap file terpisah, gak
ikut digabung (beda fungsinya, buat proxy gambar dari Telegram).

## Kenapa ini kejadian

Plan Vercel Hobby cuma boleh maksimal **12 serverless function** per
deployment — tiap file `.js` di dalam folder `api/` (termasuk yang di
subfolder `api/admin/`) itu dihitung 1 function. Fitur invite-admin
kemarin nambahin 6 file kecil sekaligus, total jadi 16 function — 4
lewat dari batas, makanya Vercel nolak deploy sama sekali (Build Failed,
bukan cuma warning).

## Yang diubah

7 endpoint kecil (`verify`, `invite-create`, `invite-redeem`, `whoami`,
`session-list`, `session-revoke`, `logout`) digabung jadi **1 file**
`api/admin/auth.js`, dibedain lewat parameter `?action=...` di URL-nya.
Contoh: yang tadinya `POST /api/admin/invite-create` sekarang jadi
`POST /api/admin/auth?action=invite-create`.

Logic di dalamnya PERSIS SAMA kayak sebelumnya (gak ada behavior yang
berubah), cuma dipindah jadi 1 file biar hemat jatah function. Frontend
(`admin/panel.html` & `admin/index.html`) udah disesuaikan manggil URL
barunya.

Total function sekarang: **10** (dari 16), sisa jatah 2 buat kalau nanti
mau nambah fitur lagi.

## Setelah upload

```bash
git rm api/admin/verify.js api/admin/invite-create.js api/admin/invite-redeem.js api/admin/whoami.js api/admin/session-list.js api/admin/session-revoke.js
```
Terus extract 3 file baru ke folder yang sama, lalu:
```bash
git add -A
git commit -m "Gabungin endpoint admin-auth jadi 1 file (fix limit 12 function Vercel Hobby)"
git pull --rebase origin main
git push
```

Tunggu deploy Vercel, cek statusnya harus "Ready" (bukan "Error" lagi).
Test ulang alur login owner & redeem kode undangan, harusnya jalan
persis kayak sebelumnya.
