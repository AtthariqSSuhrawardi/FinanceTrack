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

## Struktur
```text
FinanceTrack-v3.4/
├── index.html
├── README.md
├── .gitignore
├── css/
│   ├── style.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── data.js
│   ├── storage.js
│   ├── dashboard.js
│   ├── expenses.js
│   ├── budget.js
│   ├── history.js
│   ├── reports.js
│   ├── settings.js
│   └── pdf.js
└── assets/
    └── logo.svg
```

## Menjalankan lokal
Buka `index.html` pada browser modern. Untuk hasil paling konsisten, gunakan server lokal atau GitHub Pages.

## GitHub Pages
1. Buat repository GitHub.
2. Upload **isi folder project** sehingga `index.html` berada di root repository.
3. Buka Settings → Pages.
4. Pilih Deploy from a branch.
5. Branch `main`, folder `/ (root)`.
6. Simpan dan tunggu deployment selesai.

## Catatan data
FinanceTrack menyimpan data keuangan pada localStorage browser. GitHub hanya meng-host kode aplikasi; data keuangan pengguna tidak dikirim ke GitHub. Gunakan fitur Backup JSON sebelum berganti browser/perangkat atau melakukan reset data.


## v3.4 changes
- PDF header now uses a brighter brand navy background for better readability.
- PDF header uses a vector FinanceTrack brand mark (chart + plus), not a single initial.
- Header metadata text has increased contrast.


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
