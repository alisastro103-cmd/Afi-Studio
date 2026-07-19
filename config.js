// ==================================================================
// KONTROL JALUR PENDAFTARAN (Afi Studio)
// SATU FILE INI DIPAKAI DI SEMUA HALAMAN — ubah di sini, otomatis
// berlaku ke semua halaman yang manggil file ini.
//
// true  = jalur AKTIF (tombol langsung buka Google Form)
// false = jalur DITUTUP (tombol munculin notif "Segera Hadir")
// ==================================================================
const isDaftarModelOpen = true;   // Pendaftaran Model 3D
const isDaftarMemberOpen = false; // Pendaftaran Member

function showDaftarToast() {
    var t = document.getElementById('toast-daftar');
    if (t) { t.classList.add('show'); setTimeout(function () { t.classList.remove('show'); }, 2000); }
}
