// lib/image-storage.js
//
// Dua "kantong" penyimpanan gambar, gantiin ibb/postimg:
//
//   SECONDARY (ImageKit) — buat konten yang sifatnya sementara/rotatif:
//     banner beranda, thumbnail survey, DAN thumbnail pendaftaran model
//     yang MASIH nunggu ditinjau admin (belum tentu ditayangkan).
//
//   PERMANENT (Cloudinary) — buat konten yang bertahan lama: foto profil
//     user, banner akun user, dan konten Model yang SUDAH di-approve admin.
//
// Alur pendaftaran model: file thumbnail masuk ke SECONDARY dulu pas
// disubmit publik (lihat api/model-submit.js). Begitu admin approve lewat
// panel (lihat api/admin/media.js, action=approve-model), file itu
// dipindah ke PERMANENT dan salinan di SECONDARY dihapus. Kalau admin
// reject, salinan di SECONDARY langsung dihapus juga -- gak pernah
// nyampah, dan gak pernah nyentuh PERMANENT sama sekali kalau ujungnya
// ditolak.
//
// Semua fungsi di sini pakai fetch/FormData bawaan Node (sama gayanya
// kayak file lain di /api yang manggil Telegram API langsung), jadi gak
// nambah dependency baru (gak pake SDK resmi imagekit/cloudinary).

import crypto from 'crypto';

/* ==================== SECONDARY: ImageKit ==================== */

function imagekitAuthHeader() {
  const key = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!key) return null;
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

// Upload ke ImageKit. `input` boleh Buffer (file asli) atau string URL
// (kalau submission modenya "link" -- ImageKit bisa fetch sendiri dari URL).
// Return: { url, fileId } atau throw Error kalau gagal.
export async function uploadToSecondary(input, fileName, folder) {
  const auth = imagekitAuthHeader();
  if (!auth) throw new Error('IMAGEKIT_PRIVATE_KEY belum diset di environment variables.');

  const form = new FormData();
  if (Buffer.isBuffer(input)) {
    form.append('file', new Blob([input]), fileName || 'image.jpg');
  } else {
    form.append('file', String(input)); // ImageKit terima URL langsung sebagai value 'file'
    form.append('fileName', fileName || 'image.jpg');
  }
  if (Buffer.isBuffer(input)) form.append('fileName', fileName || 'image.jpg');
  if (folder) form.append('folder', folder.startsWith('/') ? folder : `/${folder}`);
  form.append('useUniqueFileName', 'true');

  const resp = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: auth },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || 'Upload ke ImageKit gagal.');
  return { url: data.url, fileId: data.fileId };
}

// Hapus file dari ImageKit. Sengaja gak throw kalau gagal (dipanggil dari
// alur cleanup/reject -- lebih baik gagal diam-diam daripada bikin approve
// atau reject jadi gagal total gara-gara file udah kehapus duluan/dsb).
export async function deleteFromSecondary(fileId) {
  if (!fileId) return;
  const auth = imagekitAuthHeader();
  if (!auth) return;
  try {
    await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error('Gagal hapus file secondary (ImageKit):', e.message);
  }
}

/* ==================== PERMANENT: Cloudinary ==================== */

function cloudinarySign(params) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(sorted + secret).digest('hex');
}

// Upload ke Cloudinary. `input` Buffer (file asli) atau string URL.
// Return: { url, publicId } atau throw Error kalau gagal.
export async function uploadToPermanent(input, folder, publicId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  if (!cloudName || !apiKey || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET belum lengkap di environment variables.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const pid = publicId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const signParams = { folder, public_id: pid, timestamp };
  const signature = cloudinarySign(signParams);

  const form = new FormData();
  if (Buffer.isBuffer(input)) {
    form.append('file', new Blob([input]));
  } else {
    form.append('file', String(input)); // Cloudinary juga bisa fetch dari URL remote
  }
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);
  form.append('public_id', pid);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || 'Upload ke Cloudinary gagal.');
  return { url: data.secure_url, publicId: data.public_id };
}

export async function deleteFromPermanent(publicId) {
  if (!publicId) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  if (!cloudName || !apiKey || !process.env.CLOUDINARY_API_SECRET) return;

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinarySign({ public_id: publicId, timestamp });
    const form = new FormData();
    form.append('public_id', publicId);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.error('Gagal hapus file permanent (Cloudinary):', e.message);
  }
}

/* ==================== PINDAH: Secondary -> Permanent ==================== */

// Dipanggil pas admin APPROVE. Ambil file dari ImageKit (secondary),
// upload ulang ke Cloudinary (permanent), baru hapus yang di ImageKit.
// Kalau upload ke permanent gagal, salinan secondary SENGAJA gak dihapus
// (biar submission-nya gak hilang percuma, admin bisa coba approve lagi).
export async function moveSecondaryToPermanent(secondaryUrl, secondaryFileId, folder, publicId) {
  const permanent = await uploadToPermanent(secondaryUrl, folder, publicId);
  await deleteFromSecondary(secondaryFileId);
  return permanent;
}
