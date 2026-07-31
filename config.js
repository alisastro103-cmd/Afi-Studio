// Kontrol jalur pendaftaran Afi Studio.
// File ini dipakai di semua halaman — nilainya sekarang datang dari database
// (diatur lewat halaman Pengaturan di admin panel), BUKAN diedit manual lagi.
//
// Dua baris const di bawah cuma nilai DEFAULT: dipakai sebentar sebagai
// tampilan awal sebelum fetch ke /api/data/settings selesai, dan sebagai
// cadangan kalau device sedang offline / API gagal diakses.
let isDaftarModelOpen = true;   // Pendaftaran Model 3D
let isDaftarMemberOpen = false; // Pendaftaran Member

// Ambil nilai terbaru dari database. Berjalan diam-diam di background;
// begitu selesai, kedua variabel di atas otomatis diperbarui mengikuti
// saklar yang diatur admin di panel.
(function syncDaftarSettings() {
  fetch('/api/data/settings')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (!data) return;
      if (typeof data.isDaftarModelOpen === 'boolean') isDaftarModelOpen = data.isDaftarModelOpen;
      if (typeof data.isDaftarMemberOpen === 'boolean') isDaftarMemberOpen = data.isDaftarMemberOpen;
    })
    .catch(function () {
      // Offline / API gagal: biarkan nilai default di atas yang dipakai.
    });
})();

function showDaftarToast() {
    var t = document.getElementById('toast-daftar');
    if (t) { t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2000); }
}
