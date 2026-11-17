# Impor Data Akademik (FR-005, revisi 4)

Impor manual CSV/XLSX untuk **referensi** program studi, mata kuliah, dan dosen.
Integrasi API SIAT/PIPP belum tersedia pada revisi ini.

## Batas dan semantik

- Satu jenis impor per berkas: program studi, mata kuliah, atau dosen.
- CSV UTF-8 (BOM opsional) atau XLSX satu lembar data. `.xls` lama ditolak.
  CSV yang bukan UTF-8 valid ditolak, bukan diganti karakter pengganti.
- Ukuran berkas maksimal 10 MB (implementasi 10 MiB). Maksimal 2000 baris data,
  20 kolom, 4000 karakter per sel. XLSX dengan total dekompresi > 64 MiB ditolak.
- XLSX dibaca pada posisi baris yang benar-benar terisi; baris kosong di tengah
  tidak membuat baris berikutnya hilang dan nomor baris asli dipertahankan.
  Posisi baris sheet dibatasi 3000 untuk mencegah pemindaian lembar sparse yang
  sangat jauh. Batas sel/kolom/baris berlaku sama untuk CSV dan XLSX.
- Sel formula, tanggal Excel, dan sel error ditolak; formula tidak pernah dievaluasi.
- Header harus persis sesuai template. Nilai opsional tetap memiliki kolom.
- Referensi saja: impor dosen tidak membuat akun/login atau mengubah `User`;
  impor mata kuliah tidak membuat/menerbitkan/mengarsipkan katalog `Course`,
  tidak mengubah enrollment, pengampu, cover, atau riwayat publikasi.

## Template

Unduh dari halaman `/admin/academic-import` atau
`GET /api/admin/academic-import/templates?type=<TYPE>&format=<csv|xlsx>`.

| Jenis | Header |
| --- | --- |
| `STUDY_PROGRAMS` | `faculty_code,faculty_name,study_program_code,study_program_name` |
| `COURSES` | `faculty_code,study_program_code,course_code,course_name,is_active` |
| `LECTURERS` | `nip,nidn,name,email,is_active` |

Template berisi contoh sintetis; bukan ekspor resmi SIAT/PIPP.

## Normalisasi dan identitas

- `faculty_code`, `study_program_code`: 2–20 karakter `A-Z`, `0-9`, `_`, `-`
  setelah trim dan uppercase. Stabil dan unik.
- `course_code`: 4–12 karakter alfanumerik uppercase (kebijakan kode katalog).
- Identitas: fakultas = `faculty_code`; program studi =
  (`faculty_code`, `study_program_code`); referensi mata kuliah =
  (program studi, `course_code` ternormalisasi); dosen = NIP/NIDN eksak.
- `nip`/`nidn`: teks trim 8–18 digit ASCII; nol di depan dipertahankan. Sel angka
  Excel tidak ditebak nilai nolnya — gunakan sel teks. Minimal salah satu wajib;
  jika keduanya menunjuk dua dosen berbeda, baris ditolak.
- `name`: trim, spasi dirapikan, wajib, maksimal 150 karakter.
- `is_active`: hanya `true`/`false` (sel boolean XLSX diterima). Angka/`yes` ditolak.
- `email`: opsional, divalidasi dan di-lowercase; tidak dipakai sebagai identitas.

## Adopsi data lama

Fakultas/program lama tanpa kode dapat diadopsi hanya bila nama ternormalisasi
cocok persis dan tidak ambigu dalam lingkupnya. Kode yang sudah ada tetapi berbeda
menghasilkan konflik; tidak ada backfill kode buatan.

## Pratinjau dan konfirmasi

1. `POST /api/admin/academic-import/preview` (multipart `source`, `type`, `file`).
   Server mem-parse, menormalkan, dan mengklasifikasikan tiap baris:
   `CREATED`, `UPDATED`, `UNCHANGED`, `FAILED`, `CONFLICT`.
   Tidak ada penulisan data bisnis. Batch disimpan 30 menit, terikat pada aktor,
   sumber, jenis, digest berkas, dan nomor baris asli.
   Respons memakai DTO lengkap: `status`, `previewCounts`, `resultCounts`,
   `rows`, `outcomes`, `expiresAt`, dan `canConfirm`. Pratinjau baru yang valid
   langsung memiliki `canConfirm: true`; pratinjau tanpa baris valid tetap
   menyimpan baris gagal agar dapat diunduh.
2. `POST /api/admin/academic-import/<id>/confirm` hanya untuk admin **pembuat
   pratinjau**. Admin lain dapat melihat riwayat tetapi harus membuat pratinjau
   sendiri. Server mengunci baris aktor lalu batch (`PREVIEWED` → `CONFIRMING`),
   lalu memproses tiap baris dalam transaksi sendiri: kunci aktor, kunci target
   bisnis dengan urutan tetap (fakultas → program studi → referensi mata kuliah →
   referensi dosen), klasifikasi ulang, verifikasi target belum berubah, tulis
   data + outcome baris secara atomik. Otoritas aktor diperiksa ulang secara
   transaksional; bila dicabut, penulisan bisnis berikutnya dihentikan dan baris
   yang belum diproses dicatat `FAILED`.
   Target yang baru ditemukan saat klasifikasi ulang ikut dikunci lebih dulu,
   lalu baris diklasifikasi ulang secara otoritatif sebelum keputusan akhir.
   Transaksi per baris memakai batas produksi `{ timeout: 30000, maxWait: 10000 }`;
   pencatatan outcome best-effort memakai `{ timeout: 15000 }`.
3. Baris yang targetnya berubah karena batch lain ditandai `FAILED` (stale).
   Perubahan yang dihasilkan baris sebelumnya **dalam batch yang sama** dikenali
   dari timestamp target batch-lokal, sehingga adopsi/rename induk bersama tetap
   valid tanpa melonggarkan proteksi stale global.
4. Rekonsiliasi membandingkan **seluruh** target, bukan hanya target yang tercatat
   di pratinjau. Target yang muncul eksternal setelah pratinjau ditolak sebagai
   stale, termasuk bila baris masih terklasifikasi `CREATED`; target itu tidak
   boleh menerima rename atau promosi provenance yang tidak dipratinjau. Target
   yang absen saat pratinjau hanya boleh dipakai ulang bila **ID dan `updatedAt`**
   sama persis dengan snapshot commit terakhir batch ini; target yang dibuat baris
   lain dalam batch tetap reusable, sedangkan perubahan eksternal setelah commit
   batch tersebut ditolak sebelum penulisan bisnis.
5. Bila perubahan yang direncanakan baris `UPDATED` sudah dipenuhi baris
   sebelumnya dalam batch yang sama, baris dicatat `UNCHANGED` secara jujur:
   tidak ada penulisan kedua dan tidak menjadi `FAILED`/`PARTIAL` palsu.

Konfirmasi ulang batch `CONFIRMED`/`PARTIAL` mengembalikan hasil tersimpan tanpa
mutasi baru. Batch `CONFIRMING` mengembalikan 409 (jangan mulai impor baru).
Batch kedaluwarsa: transisi `EXPIRED` di-commit pada transaksi terpisah sebelum
error 409 dikembalikan, sehingga status tersimpan dan tidak ada perubahan bisnis.
Kegagalan sebagian tetap menyimpan baris yang sudah commit; status batch menjadi
`PARTIAL`. Hitungan hasil (`resultCounts`) berasal dari outcome tersimpan, bukan
dari rencana pratinjau; rencana yang gagal/stale tidak ditampilkan sebagai sukses.

Sebelum penulisan bisnis, duplikat dalam berkas divalidasi menyeluruh:
fakultas yang sama tidak boleh memiliki nama berbeda; dosen yang berbagi NIP/NIDN
tidak boleh memiliki identitas yang bertentangan. Duplikat identik tidak
diterapkan dua kali; duplikat dengan nilai berbeda ditolak seluruhnya (tidak ada
last-row-wins). NIP/NIDN yang tidak diisi pada pembaruan dosen mempertahankan nilai
yang sudah tercatat, dan identifier yang sudah ada tidak diganti implisit.
NIP/NIDN komplementer dari beberapa baris dosen yang identik digabung **sebelum**
klasifikasi akhir; action, target, perubahan, identitas, dan nilai ternormalisasi
seluruhnya menggambarkan input final. `originalCells` tidak diubah.

## Precedence sumber

- `SIAT` menimpa data milik `PIPP`.
- Impor SIAT dengan nilai bisnis yang **identik** tetap mempromosikan provenance
  `PIPP` → `SIAT` sebagai perubahan `UPDATED` yang terlihat di pratinjau, termasuk
  untuk fakultas, program studi, referensi mata kuliah, dan dosen.
- `PIPP` tidak boleh menimpa data milik `SIAT`; baris menjadi `CONFLICT` dan dilewati.
  Ini juga berlaku setelah promosi SIAT pada nilai yang sebelumnya identik.
- Data yang tidak ada di berkas tidak pernah dihapus.
- Status `is_active` hanya memengaruhi referensi akademik, bukan akun/katalog.

## Riwayat, hasil, dan ekspor

- `GET /api/admin/academic-import` — 50 batch terakhir (aktor, sumber, jenis,
  waktu, digest, status, hitungan).
- `GET /api/admin/academic-import/<id>` — detail baris + outcome tersimpan.
- `GET /api/admin/academic-import/<id>/failed` — CSV baris gagal/konflik dengan
  nomor baris asli, kolom asli, dan penjelasan. Sel asli (termasuk identifier,
  email, dan boolean tidak valid) disimpan terpisah dari nilai ternormalisasi.
  Sebelum konfirmasi, ekspor memakai baris gagal dari pratinjau; setelah
  konfirmasi, ekspor memakai outcome otoritatif. Batch lama yang tidak menyimpan
  sel asli memakai fallback nilai ternormalisasi (didokumentasikan, tidak
  direkonstruksi seolah-olah asli). Nilai di-escape dan diberi prefiks `'` bila
  diawali `=`, `+`, `-`, `@`, tab, atau CR untuk mencegah formula injection.

Semua route memerlukan sesi admin; tidak ada URL laporan publik. Isi berkas dan
data pribadi tidak dicatat ke log. Retensi: batch dan outcome tetap tersimpan
sampai dibersihkan operator; tidak ada scheduler baru pada revisi ini.

## Operasional

- Terapkan migrasi aditif `20261115000000_add_academic_file_import` sebelum memakai
  fitur. Migrasi tidak mengubah data lama; kolom kode/sumber dibiarkan `NULL`.
- Batas operasional: impor > 2000 baris harus dipecah. Bila konfirmasi terputus,
  muat ulang status batch dari Riwayat sebelum mengulang; jangan memulai impor baru
  secara buta.
- Harness live FR-005 mencatat permintaan HTTP yang timeout/abort sebagai
  **uncertain** (timeout hanya menghentikan penantian, bukan pekerjaan server).
  Bila penyelesaian tidak dapat dipastikan, penghapusan fixture ditunda, manifest
  kepemilikan (ID fixture dan batch) dicetak tanpa kredensial, dan proses keluar
  non-zero. Penghapusan hanya memakai ID fixture tercatat dan identitas komposit
  lengkap, bukan kode global semata. Batch/outcome tetap disimpan sebagai bukti.
- Uji cross-actor memakai dua admin fixture yang masing-masing mengonfirmasi
  batch sendiri terhadap target yang sama. Bukti sinkronisasi diambil dari rantai
  `pg_blocking_pids` yang dimulai dari **PID transaksi blocker fixture** (termasuk
  penunggu yang mengantre di belakang penunggu pertama), bukan hitungan query
  database-wide.
- Mode live terfokus `--mixed-source` memakai satu referensi mata kuliah milik
  PIPP dan dua batch (SIAT dan PIPP) dari aktor berbeda. Urutan SIAT-dahulu
  membuktikan nilai SIAT yang sudah commit tidak dapat ditimpa PIPP: konfirmasi
  PIPP yang masih memakai pratinjau lama ditolak `FAILED`/stale, dan pratinjau
  PIPP baru setelah commit SIAT tetap berakhir `CONFLICT`.
- Urutan PIPP-dahulu membuat konfirmasi SIAT dengan pratinjau lama stale; setelah
  membuat pratinjau baru, SIAT mempromosikan nilai sesuai presedensi sumber.
  Pada eksekusi konkuren, urutan pemenang tidak dijamin FIFO: satu transaksi
  commit dan transaksi lain menjadi stale `FAILED` (re-preview diperlukan).
  Bila PIPP menang lebih dulu, batch SIAT harus membuat pratinjau baru untuk
  melakukan promosi; tidak ada klaim pemenang universal.
- Keterbatasan yang diketahui: tidak ada pemulihan otomatis batch yang macet pada
  status `CONFIRMING` (mis. proses server mati saat konfirmasi); operator harus
  memeriksa outcome tersimpan sebelum tindakan lanjutan.
