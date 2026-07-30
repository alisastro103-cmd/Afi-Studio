// Kontrol jalur pendaftaran Afi Studio.
// File ini dipakai di semua halaman — ubah di sini, otomatis berlaku ke semua halaman yang memanggilnya.
// true  = jalur aktif (tombol langsung buka Google Form)
// false = jalur ditutup (tombol memunculkan notifikasi "Segera Hadir")
const isDaftarModelOpen = true;   // Pendaftaran Model 3D
const isDaftarMemberOpen = false; // Pendaftaran Member

function showDaftarToast() {
    var t = document.getElementById('toast-daftar');
    if (t) { t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2000); }
}
