# FinanceTrack v3.4
Aplikasi manajemen keuangan pribadi berbasis HTML, CSS, dan JavaScript murni. Siap di-host pada GitHub Pages tanpa backend.

## Fitur utama
- Dashboard responsif desktop dan smartphone.
- Sidebar dapat disembunyikan/dimunculkan dan statusnya diingat browser.
- Pemasukan/gaji bulanan dengan format nominal Indonesia (titik ribuan).
- Pengeluaran aktual per tanggal, kategori, kelompok, dan catatan.
- Anggaran/rencana pengeluaran per sub-kategori.
- Tambah, hapus, dan edit judul kelompok serta sub-kategori.
- Riwayat bulanan.
- Laporan rencana vs aktual.
- PDF langsung download tanpa print dialog.
- PDF berisi gaji, total rencana, detail rencana, aktual harian, rekapitulasi, selisih, kesimpulan, dan tanggal unduh.
- Backup/restore JSON.
- Dark mode.
- Penyimpanan lokal browser (localStorage).

## Catatan data
FinanceTrack menyimpan data keuangan pada localStorage browser. GitHub hanya meng-host kode aplikasi; data keuangan pengguna tidak dikirim ke GitHub. Gunakan fitur Backup JSON sebelum berganti browser/perangkat atau melakukan reset data.

## FinanceTrack v3.4
- Kalender otomatis: bulan aktif mengikuti kalender dan bulan hingga 36 bulan ke depan disiapkan otomatis.
- Riwayat transaksi dipertahankan maksimal 3 tahun berdasarkan tanggal transaksi.
- Transaksi yang melewati batas 3 tahun dihapus otomatis saat aplikasi dibuka/menyimpan data.
- Saat bulan lama dihapus dari jendela 3 tahun, bulan baru di ujung depan otomatis dibuat.
- Pemasukan sekarang disimpan sebagai transaksi bertanggal dan dapat ditambah, diedit, atau dihapus.
- Pengeluaran otomatis masuk ke bulan berdasarkan tanggal transaksi, termasuk ketika tanggal diubah saat edit.
- Saldo berjalan menghubungkan saldo awal + pemasukan - pengeluaran setiap bulan.
- CSV laporan mencakup pemasukan dan pengeluaran.
- Tidak ada backend; data tetap berada di localStorage browser.
