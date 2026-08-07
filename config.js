// Kontrol jalur pendaftaran & event Afi Studio.
// File ini dipakai di semua halaman — nilainya sekarang datang dari database
// (diatur lewat halaman Pengaturan di admin panel), BUKAN diedit manual lagi.
//
// Baris const di bawah cuma nilai DEFAULT: dipakai sebentar sebagai
// tampilan awal sebelum fetch ke /api/data/settings selesai, dan sebagai
// cadangan kalau device sedang offline / API gagal diakses.
let isDaftarModelOpen = true;   // Pendaftaran Model 3D
let isDaftarMemberOpen = false; // Pendaftaran Member
let isEventOpen = true;         // Jalur Event Render (Drive)

// Jalur/link tujuan — bisa diubah admin tanpa perlu edit kode, cukup lewat
// halaman Pengaturan. Nilai di bawah ini dipakai sebagai default/cadangan.
let daftarModelUrl = 'https://forms.gle/KvbgZP3CrziGGZBU8';
let daftarMemberUrl = 'https://forms.gle/JmYJ1S5GFCEscAnU7';
let eventDriveUrl = 'https://drive.google.com/drive/folders/1wZwtLzkCXjhMoWQ_DGO0UuJO-u9zVUAc';

// Terapkan link terbaru ke elemen <a> di halaman (kalau ada). Dipanggil saat
// DOM sudah siap, dan dipanggil lagi setelah fetch ke database selesai.
function applyDaftarLinks() {
  var modelLink = document.getElementById('link-daftar-model');
  if (modelLink) modelLink.href = daftarModelUrl;
  var memberLink = document.getElementById('link-daftar-member');
  if (memberLink) memberLink.href = daftarMemberUrl;
  var eventLink = document.querySelector('[data-event-drive-link]');
  if (eventLink) eventLink.href = eventDriveUrl;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyDaftarLinks);
} else {
  applyDaftarLinks();
}

// Ambil nilai terbaru dari database. Berjalan diam-diam di background;
// begitu selesai, variabel-variabel di atas otomatis diperbarui mengikuti
// saklar & link yang diatur admin di panel, lalu link di halaman ikut diganti.
(function syncDaftarSettings() {
  fetch('/api/data/settings')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data) return;
      if (typeof data.isDaftarModelOpen === 'boolean') isDaftarModelOpen = data.isDaftarModelOpen;
      if (typeof data.isDaftarMemberOpen === 'boolean') isDaftarMemberOpen = data.isDaftarMemberOpen;
      if (typeof data.isEventOpen === 'boolean') isEventOpen = data.isEventOpen;
      if (typeof data.daftarModelUrl === 'string' && data.daftarModelUrl) daftarModelUrl = data.daftarModelUrl;
      if (typeof data.daftarMemberUrl === 'string' && data.daftarMemberUrl) daftarMemberUrl = data.daftarMemberUrl;
      if (typeof data.eventDriveUrl === 'string' && data.eventDriveUrl) eventDriveUrl = data.eventDriveUrl;
      applyDaftarLinks();
    })
    .catch(function () {
      // Offline / API gagal: biarkan nilai default di atas yang dipakai.
    });
})();

function showDaftarToast() {
    var t = document.getElementById('toast-daftar');
    if (t) { t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2000); }
}
