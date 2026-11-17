**FUNCTIONAL SPECIFICATION DOCUMENT**

Tutor AI & Immersive Learning Hub

Pengembangan Platform Tutor AI dan Modul Pembelajaran AR

| Versi | \[0.4\] |
| :---- | :---- |
| **Tanggal** | 7/11/2026 |
| **Penulis** | Bagas Anung Bayu Nugraha; M. Nurrizal Zid Maulana |
| **Status** | Draft |
| **Klasifikasi** | Internal |

**Daftar Isi**

[1\. Informasi Dokumen	3](#heading=)

[1.1 Riwayat Revisi	3](#heading=)

[1.2 Persetujuan Dokumen	3](#heading=)

[2\. Pendahuluan	3](#heading=)

[2.1 Tujuan Dokumen	3](#heading=)

[2.2 Ruang Lingkup	4](#heading=)

[2.3 Definisi, Istilah, dan Singkatan	4](#heading=)

[2.4 Dokumen Referensi	5](#heading=)

[3\. Gambaran Umum Sistem	5](#heading=)

[3.1 Deskripsi Produk dan Latar Belakang	5](#heading=)

[3.2 Tujuan Bisnis	6](#heading=)

[3.3 Asumsi dan Batasan	6](#heading=)

[3.4 Ketergantungan (Dependencies)	7](#heading=)

[4\. Pengguna dan Peran	7](#heading=)

[5\. Kebutuhan Fungsional	8](#heading=)

[5.1 Ringkasan Daftar Fitur	8](#heading=)

[5.2 Detail Fitur	9](#heading=)

[6\. Spesifikasi Antarmuka	31](#heading=)

[6.1 Antarmuka Pengguna (UI)	31](#heading=)

[6.2 Antarmuka Eksternal / Integrasi	32](#heading=)

[6.3 Notifikasi	33](#heading=)

[7\. Model dan Alur Data	33](#heading=)

[7.1 Diagram Alur	33](#heading=)

[7.2 Entitas Data Utama	37](#heading=)

[7.3 Laporan dan Output Sistem	38](#heading=)

[8\. Kebutuhan Non-Fungsional	38](#heading=)

[9\. Kriteria Penerimaan	40](#heading=)

[10\. Lampiran	42](#heading=)

[10.1 Matriks Keterlacakan (Traceability Matrix)	42](#heading=)

[10.2 Daftar Pertanyaan Terbuka (Open Issues)	42](#heading=)

[10.3 Glosarium Tambahan	42](#heading=)

# **1\. Informasi Dokumen**

## **1.1 Riwayat Revisi**

| Versi | Tanggal | Penulis | Deskripsi Perubahan |
| :---- | :---- | :---- | :---- |
| 0.1 | 25/10/2026 | Bagas Anung Bayu Nugraha | Draft awal penyusunan FSD |
| 0.2 | 26/10/2026 | Bagas Anung Bayu Nugraha; M. Nurrizal Zid Maulana | Melengkapi beberapa bagian FSD |
| 0.3  | 27/10/2026 | Bagas Anung Bayu Nugraha | Menyederhanakan bahasa |
| 0.4 | 06/11/2026 | Bagas Anung Bayu Nugraha; M. Nurrizal Zid Maulana | Menyesuaikan FSD dengan aplikasi Tutor AI Sebelumnya: fokus Fase 1–2, status fitur, kualitas jawaban, serta integrasi avatar |
| 0.4 | 07/11/2026 | Bagas Anung Bayu Nugraha; M. Nurrizal Zid Maulana | Memperbaiki bahasa dan tata penulisan |

## **1.2 Persetujuan Dokumen**

| Nama | Jabatan / Peran | Tanda Tangan | Tanggal |
| :---- | :---- | :---- | :---- |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

# **2\. Pendahuluan**

## **2.1 Tujuan Dokumen**

Dokumen ini menjelaskan fitur, alur penggunaan, dan ketentuan Tutor AI & Immersive Learning Hub. Dokumen ini menjadi acuan bagi tim pengembang, penguji, dosen, dan pengelola untuk memastikan aplikasi sesuai dengan kebutuhan.

Dokumen ini ditujukan kepada:

1. Tim pengembang PIPP dan DPSITD menggunakan dokumen ini sebagai acuan pembuatan fitur dan tampilan aplikasi.  
2. Tim penguji menggunakan dokumen ini untuk menyusun skenario pengujian dan uji penerimaan pengguna (UAT).  
3. Dosen dan admin memeriksa apakah fitur sesuai dengan kebutuhan perkuliahan dan pengelolaan layanan.  
4. Pimpinan menggunakan dokumen ini untuk menyetujui dan memantau cakupan pengembangan.

## **2.2 Ruang Lingkup**

| In Scope | Out of Scope |
| :---- | :---- |
| Melanjutkan aplikasi Tutor AI yang sudah tersedia, termasuk pengelolaan kelas, materi, percakapan, fitur suara, dan avatar 3D. | Modul Virtual Reality (VR); pengembangan difokuskan pada AR. |
| Tahap 1: memperbaiki jawaban Tutor AI agar sesuai dengan materi dosen, mencantumkan sumber, dan menyatakan jika jawaban tidak ditemukan. | Aplikasi mobile native (Android/iOS), akses melalui peramban web dan tidak ada aplikasi yang diunduh. |
| Tahap 2: menyempurnakan avatar agar dapat menyampaikan jawaban melalui suara. Mahasiswa dapat bertanya melalui teks atau suara. Tahap ini dimulai setelah tahap 1 stabil. | Integrasi LMS (Canvas/LTI); akses tetap melalui tautan atau kode manual. |
| Kualitas jawaban: pengujian akurasi, koreksi dosen, dan pemantauan pertanyaan yang tidak terjawab. | Pengelolaan nilai akademik resmi; nilai tetap dikelola pada sistem akademik kampus. |
| Pengelolaan materi berupa PDF, tautan, dan teks, termasuk pembacaan teks dari dokumen serta status pemrosesannya. | Analisis di luar penggunaan layanan, seperti prediksi, penilaian kinerja dosen, dan laporan keuangan. |
| Pengelolaan kelas dengan kode pendaftaran, lebih dari satu dosen, dan materi per pertemuan. | Integrasi penuh dengan LIVE Unpad pada rilis pertama belum diputuskan. |
| Ringkasan pemakaian untuk admin, dosen, dan mahasiswa. |  |
| Pembagian akses kelas melalui kode atau tautan, termasuk penggantian kode bila diperlukan. |  |
| Tiga peran: admin, dosen, mahasiswa. |  |

## **2.3 Definisi, Istilah, dan Singkatan**

| Istilah | Definisi |
| :---- | :---- |
| BRD | Business Requirements Document — dokumen kebutuhan bisnis yang menjadi acuan FSD ini. |
| FSD | Functional Specification Document — dokumen spesifikasi fungsional sistem. |
| RPS | Rencana Pembelajaran Semester; dokumen acuan topik dan tujuan mata kuliah. |
| Hub | Platform terpusat Tutor AI & Immersive Learning Hub sebagai pintu masuk tunggal layanan. |
| Tutor AI | Asisten belajar berbasis kecerdasan buatan yang dikonfigurasi dosen sesuai materi mata kuliah. |
| Avatar live tutor | Tampilan figur maya yang dapat diajak bercakap melalui suara. |
| AR (Augmented Reality) | Teknologi penambahan objek maya ke tampilan dunia nyata melalui kamera perangkat. |
| Web-AR | Modul AR yang dijalankan langsung dari peramban tanpa aplikasi terpisah. |
| Basis Pengetahuan Aktif | Kumpulan dokumen materi berstatus aktif yang menjadi satu-satunya sumber rujukan jawaban Tutor AI. |
| Strict Course Guardrails | Pembatasan ketat agar Tutor AI hanya menjawab sesuai materi mata kuliah yang diunggah dosen. |
| Sitasi | Keterangan sumber dokumen dan halaman yang dirujuk pada setiap jawaban Tutor AI. |
| Anti-halusinasi | Prinsip agar Tutor AI menyatakan ketidaktahuan alih-alih menyusun jawaban rekaan. |
| Socratic Guidance | Pendekatan komunikasi edukatif yang menuntun mahasiswa melalui pertanyaan pemantik dan penalaran bertahap. |
| Kode Kelas | Kode alfanumerik singkat yang dibagikan dosen untuk membuka akses ruang belajar. |
| Rotasi Kode | Penerbitan kode kelas baru yang membuat kode lama tidak berlaku bagi pendaftar baru. |
| Kill-Switch | Mekanisme dosen untuk langsung menonaktifkan satu dokumen sebagai sumber rujukan Tutor AI. |
| RBAC | Role-Based Access Control — pengaturan hak akses berdasarkan peran pengguna. |
| MAU | Monthly Active Users — jumlah pengguna aktif dalam satu bulan. |
| CRUD | Create, Read, Update, Delete — operasi dasar pengelolaan data. |
| UAT | User Acceptance Testing — pengujian penerimaan oleh pengguna. |
| SIAT | Sistem Informasi Akademik Terpadu Universitas Padjadjaran. |
| PIPP | Pusat Pengembangan Inovasi Pembelajaran. |
| DPSITD | Direktorat Pengembangan Sistem Informasi dan Teknologi Digital. |

## **2.4 Dokumen Referensi**

| Dokumen | Versi | Lokasi / Tautan |
| :---- | :---- | :---- |
| Aplikasi Tutor AI yang dibuat sebelumnya | 1.0 | [https\://github.com/Lukas166/tutor-ai](https://github.com/Lukas166/tutor-ai)  |
| BRD Tutor AI & Immersive Learning Hub | 1.2 (16 Oktober 2026\) | [Brd \| desain Aplikasi Tutor AI](https://docs.google.com/document/d/1TQjlMMmPV5sZQzFA8D6iAafO28Yn8uOT8jm06r_92fA/edit?usp=sharing) |

# **3\. Gambaran Umum Sistem**

## **3.1 Deskripsi Produk dan Latar Belakang**

Pengembangan ini melanjutkan aplikasi Tutor AI yang sudah tersedia. Aplikasi tersebut telah memiliki pengelolaan kelas dan materi, percakapan berbasis materi, pembacaan teks dari PDF, fitur suara, serta avatar 3D. Tahap pertama berfokus pada perbaikan kualitas jawaban. Setelah fitur tersebut stabil, pengembangan dilanjutkan pada penyempurnaan avatar sebagai tutor bersuara.

Mahasiswa membutuhkan dukungan belajar di luar jam perkuliahan, tetapi waktu dosen untuk mendampingi setiap mahasiswa terbatas. Kesempatan berlatih di laboratorium juga bergantung pada ketersediaan alat, bahan, dan ruangan, serta pertimbangan keselamatan. Sementara itu, materi belajar yang tersedia belum banyak memberi ruang bagi mahasiswa untuk bertanya dan mencoba secara langsung.

Tutor AI & Immersive Learning Hub menghimpun Tutor AI per mata kuliah dalam katalog yang mudah ditelusuri. Dosen dapat menyiapkan materi dan membagikan akses kelas melalui kode atau tautan. Mahasiswa dapat bertanya berdasarkan materi tersebut, sedangkan dosen dan pengelola dapat melihat penggunaan layanan sebagai bahan evaluasi. Platform ini juga direncanakan menyediakan akses modul AR untuk mendukung latihan praktikum; pengembangannya menunggu keputusan cakupan dan metode. Pengelolaan platform berada pada PIPP bersama DPSITD, dengan dukungan data SIAT dan aplikasi PIPP, serta mendukung tahap Learning Engagement dalam program Student and Graduate Success.

## **3.2 Tujuan Bisnis**

* Membantu mahasiswa belajar secara mandiri di luar jam kuliah melalui Tutor AI yang tersedia 24 jam.

* Menyatukan akses resmi layanan Tutor AI dalam satu platform.

* Memudahkan dosen mengelola materi, membagikan akses kelas, dan memantau penggunaannya.

* Menyediakan data penggunaan bagi pengelola dan pimpinan sebagai bahan evaluasi dan pengambilan keputusan.

* Menjaga pengelolaan platform, data, dan kualitas materi di bawah kendali universitas.

## **3.3 Asumsi dan Batasan**

| ID | Jenis | Deskripsi |
| :---- | :---- | :---- |
| AS-01 | Asumsi | Pengguna memiliki koneksi internet yang memadai untuk mengunggah dan mengunduh berkas. |
| AS-02 | Asumsi | Dosen menyediakan materi yang sesuai dan terbaru, lalu membagikan kode atau tautan kelas kepada mahasiswa. |
| AS-03 | Asumsi | SIAT dan aplikasi PIPP dapat diakses selama pengembangan dan penggunaan layanan. |
| AS-04 | Asumsi | Server dan penyimpanan PIPP/DPSITD siap digunakan untuk aplikasi, materi, dan aset pembelajaran. |
| AS-05 | Asumsi | Perangkat mahasiswa mendukung peramban modern dan kamera untuk menjalankan Web-AR. |
| AS-06 | Asumsi | Kode dan data aplikasi Tutor AI sebelumnya dapat digunakan kembali dan tersedia dokumentasinya. |
| AS-07 | Asumsi | Dosen bersedia menyiapkan materi dan daftar pertanyaan uji untuk mengukur kualitas jawaban. |
| As-08 | Asumsi | Perangkat mahasiswa mendukung peramban modern, WebGL, kamera, dan mikrofon untuk mode avatar. |
| BT-01 | Batasan | Aplikasi diakses melalui peramban pada laptop atau ponsel. |
| BT-02 | Batasan | Pengembangan terbatas pada website dan AR; VR tidak termasuk. |
| BT-03 | Batasan | Penerapan untuk mata kuliah dilakukan secara bertahap. |
| BT-04 | Batasan | Akses kelas Tutor AI hanya diberikan melalui kode atau tautan dari dosen. |
| BT-05 | Batasan | Kualitas Tutor AI bergantung pada materi yang diunggah dosen. |
| BT-06 | Batasan | AR mendukung latihan praktikum dan tidak menghapus kegiatan praktikum di laboratorium. |
| BT-07 | Batasan | Laporan dibatasi pada penggunaan layanan. |

## **3.4 Ketergantungan (Dependencies)**

| Sistem / Pihak | Jenis Ketergantungan | Keterangan |
| :---- | :---- | :---- |
| Aplikasi Tutor AI Sebelumnya | Kode, basis data, dan data | Menjadi dasar pengembangan; tidak dibangun ulang. |
| SIAT | API / pertukaran data | Sumber data program studi, mata kuliah aktif, dan penugasan dosen. |
| Aplikasi PIPP | API / basis data | Sumber data pendukung dan tujuan penyelarasan data akademik. |
| Infrastruktur PIPP/DPSITD | Hosting & penyimpanan | Penyediaan server aplikasi, basis data, dan object storage materi/AR. |
| Layanan kecerdasan buatan | API pihak ketiga / model internal | Mesin bahasa untuk Tutor AI |
| Pustaka Web-AR | Komponen perangkat lunak | Mesin render AR di peramban |
| Tim pengembang modul AR | Konten & aset | Penyediaan modul AR tervalidasi beserta aset 3D. |
| Dosen pengampu | Konten & operasional | Penyediaan materi dan konfigurasi Tutor AI per mata kuliah. |
| Layanan AI (Gemini, Groq, ElevenLabs) | Layanan pihak ketiga | Digunakan untuk jawaban, transkripsi suara, dan suara avatar. |

# **4\. Pengguna dan Peran**

| Peran | Deskripsi | Hak Akses / Kewenangan |
| :---- | :---- | :---- |
| Mahasiswa | Pengguna utama yang belajar mandiri melalui Tutor AI pada mata kuliah yang diikuti. | Mencari mata kuliah dan bergabung ke kelas melalui kode atau tautan; bertanya kepada Tutor AI; mengelola riwayat, penanda, dan catatan pribadi; menilai jawaban; serta melihat ringkasan belajar. |
| Dosen Pengampu | Pengelola ruang belajar Tutor AI untuk mata kuliah yang diampu. | Mengelola materi dan batasan jawaban; membagikan dan mengganti kode kelas; mengoreksi jawaban; serta melihat dan mengunduh laporan aktivitas kelas. |
| Admin Pengelola (PIPP/DPSITD) | Pengelola pusat katalog, pengguna, integrasi data, dan pemantauan global. | Mengelola mata kuliah dan tampilannya di katalog; mengatur akun dan peran; membekukan akun dan mengakhiri sesi; memperbarui data akademik; serta melihat dan mengunduh laporan penggunaan platform. |

# **5\. Kebutuhan Fungsional**

*Salin blok "Fitur" di bawah untuk setiap fitur / modul. Gunakan ID unik (FR-001, FR-002, dst.).*

## **5.1 Ringkasan Daftar Fitur**

| ID | Nama Fitur | Kelompok | Status | Prioritas | Pengguna |
| :---- | :---- | :---- | :---- | :---- | :---- |
| FR-001 | Mengelola Daftar Mata Kuliah | Daftar Layanan | Sebagian | Must | Admin |
| FR-002 | Menampilkan dan Menyembunyikan Mata Kuliah | Daftar Layanan | Sudah ada | Must | Admin |
| FR-003 | Mengelola Akun dan Hak Akses | Pengguna | Sudah ada | Must | Admin |
| FR-004 | Mengamankan Akun | Pengguna | Sebagian | Should | Admin |
| FR-005 | Mengambil Data Akademik | Data Akademik | Baru | Must | Admin |
| FR-006 | Menghubungkan Mata Kuliah, Dosen, dan Modul AR | Data Akademik | Sebagian | Must | Admin |
| FR-007 | Ringkasan Pemakaian dan Unduh Laporan | Ringkasan | Sebagian | Must | Admin |
| FR-008 | Mengelola Materi Acuan Tutor AI | Tutor AI | Sudah ada | Must | Dosen |
| FR-009 | Mengatur Tutor AI dan Batas Topik | Tutor AI | Sebagian | Must | Dosen |
| FR-010 | Membagikan dan Mengganti Kode Kelas | Akses Kelas | Sebagian | Must | Dosen |
| FR-011 | Menghubungkan Modul AR ke Mata Kuliah | AR | Ditunda | Won’t | Dosen |
| FR-012 | Ringkasan Aktivitas Kelas | Ringkasan | Sebagian | Must | Dosen |
| FR-013 | Mengoreksi Jawaban Tutor AI | Tutor AI | Baru | Must | Dosen |
| FR-014 | Mencari Mata Kuliah | Daftar Layanan | Sebagian | Must | Mahasiswa |
| FR-015 | Mendaftar ke Kelas | Akses Kelas | Sudah ada | Must | Mahasiswa |
| FR-016 | Bertanya kepada Tutor AI | Tutor AI | Sudah ada | Must | Mahasiswa |
| FR-017 | Menyimpan Riwayat, Tanda, dan Catatan | Tutor AI | Sebagian | Must | Mahasiswa |
| FR-018 | Menilai Jawaban Tutor AI | Tutor AI | Baru | Should | Mahasiswa |
| FR-019 | Membuka Modul AR yang Tersedia | AR | Ditunda | Won’t | Mahasiswa |
| FR-020 | Penilaian dan Ulasan Latihan AR | AR | Ditunda | Won’t | Mahasiswa |
| FR-021 | Ringkasan Belajar Mahasiswa | Ringkasan | Sebagian | Should | Mahasiswa |
| FR-022 | Pemberitahuan dan Pengingat | Pemberitahuan | Baru | Should | Mahasiswa, Dosen |
| FR-023 | Menjaga Kualitas Jawaban dan Perilaku "Tidak Tahu" | Kualitas | Baru | Must | Mahasiswa, Dosen |
| FR-024 | Menguji Akurasi Jawaban | Kualitas | Baru | Must | Dosen, Admin |
| FR-025 | Integrasi Avatar Live Tutor | Avatar | Sebagian | Must | Mahasiswa |
| FR-026 | Memantau Pemrosesan Materi | Tutor AI | Sudah ada | Must | Dosen |
| FR-027 | Menyesuaikan Jawaban per Jenjang | Tutor AI | Sudah ada | Must | Mahasiswa, Admin |

## **5.2 Detail Fitur**

### FR-001 – Kelola Katalog dan Profil Mata Kuliah

| ID Fitur | FR-001 |
| :---- | :---- |
| **Nama Fitur** | Kelola Katalog dan Profil Mata Kuliah |
| **Deskripsi** | Admin dapat menambah, melihat, memperbarui, dan mengarsipkan mata kuliah di katalog. Data yang dikelola meliputi program studi, fakultas, kode dan nama mata kuliah, dosen pengampu, capaian pembelajaran, gambar sampul, serta ketersediaan modul AR. |
| **Pengguna** | Admin Pengelola |
| **Prioritas** | Wajib |
| **Syarat awal** | Admin telah masuk dan memiliki peran Admin Pengelola. |
| **Hasil akhir** | Entri mata kuliah tersimpan dan tampil pada katalog sesuai status publikasinya. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka menu Katalog dan memilih Tambah/Ubah entri. | Sistem menampilkan daftar entri beserta filter dan formulir data. |
| 2 | Mengisi data mata kuliah dan menyimpan. | Sistem memvalidasi kelengkapan dan keunikan data, lalu menyimpan entri. |
| 3 | Mengarsipkan entri yang tidak lagi ditawarkan. | Sistem mengubah status menjadi arsip dan menyembunyikannya dari katalog publik. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Kode MK sudah terdaftar pada prodi yang sama. | Sistem menolak penyimpanan dan menampilkan pesan duplikasi. |
| ALT-2 | Data referensi dari SIAT belum tersedia. | Entri disimpan sebagai draft dan dapat dilengkapi kemudian. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Metadata mata kuliah (prodi, fakultas, kode, nama, dosen, deskripsi, gambar sampul, status AR) | Validasi, pengecekan duplikasi, dan penyimpanan data | Entri katalog mata kuliah |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-001 | Kode mata kuliah unik dalam satu program studi. |
| BR-002 | Entri berstatus arsip tidak tampil di katalog publik, tetapi data interaksi dan akun mahasiswa tetap tersimpan. |
| BR-003 | Setiap entri wajib memiliki minimal satu dosen pengampu sebelum dapat dipublikasikan. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Nama mata kuliah | Wajib diisi, maksimal 150 karakter. | Nama mata kuliah wajib diisi. |
| Kode mata kuliah | Wajib, 4–12 karakter alfanumerik. | Format kode mata kuliah tidak valid. |
| Gambar sampul | JPG/PNG, maksimal 2 MB. | Berkas gambar melebihi 2 MB atau format tidak didukung. |
| Dosen pengampu | Minimal satu dosen. | Tambahkan minimal satu dosen pengampu. |

### FR-002 – Publikasi dan Penonaktifan Entri Katalog

| ID Fitur | FR-002 |
| :---- | :---- |
| **Nama Fitur** | Publikasi dan Penonaktifan Entri Katalog |
| **Deskripsi** | Admin dapat menampilkan atau menyembunyikan mata kuliah dalam katalog per program studi. Perubahan ini tidak menghapus riwayat interaksi. |
| **Pengguna** | Admin Pengelola |
| **Prioritas** | Wajib |
| **Syarat awal** | Entri mata kuliah telah memiliki data lengkap. |
| **Hasil akhir** | Status publikasi entri berubah dan katalog publik menyesuaikan. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Memilih entri dan menekan Publish/Unpublish. | Sistem menampilkan konfirmasi perubahan status. |
| 2 | Mengonfirmasi perubahan. | Sistem memperbarui status dan mencatat log aktivitas. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Entri belum lengkap saat akan dipublikasikan. | Sistem menolak dan menampilkan daftar data yang belum lengkap. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Entri mata kuliah dan status publikasi | Validasi kelengkapan dan perubahan status | Status publikasi terbarui |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-004 | Unpublish tidak menghapus data interaksi, riwayat, maupun akun mahasiswa terdaftar. |
| BR-005 | Setiap perubahan status tercatat pada log aktivitas admin. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Status publikasi | Hanya dapat diaktifkan bila data wajib lengkap. | Lengkapi data sebelum mempublikasikan entri. |

### FR-003 – Kelola Pengguna dan Hak Akses

| ID Fitur | FR-003 |
| :---- | :---- |
| **Nama Fitur** | Kelola Pengguna dan Hak Akses |
| **Deskripsi** | Admin dapat mencari akun berdasarkan nama, NIM, atau NIP/NIDN dan menetapkan peran sebagai mahasiswa, dosen, atau admin. |
| **Pengguna** | Admin Pengelola |
| **Prioritas** | Wajib |
| **Syarat awal** | Admin telah masuk dengan peran Admin Pengelola. |
| **Hasil akhir** | Data pengguna dan peran tersimpan serta berlaku pada sesi berikutnya. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka menu Pengguna dan mencari akun. | Sistem menampilkan daftar akun sesuai kata kunci. |
| 2 | Memilih akun dan menetapkan peran. | Sistem memvalidasi kewenangan dan menyimpan perubahan peran. |
| 3 | Menyimpan perubahan. | Sistem mencatat log audit perubahan peran. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Admin mencoba mengubah perannya sendiri. | Sistem menolak untuk mencegah kehilangan akses administratif. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Data akun dan peran | Pencarian, validasi kewenangan, penyimpanan | Akun dengan peran terbarui |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-006 | Satu akun hanya memiliki satu peran utama. |
| BR-007 | Perubahan peran wajib tercatat pada log audit (pelaku, waktu, peran lama, peran baru). |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| NIM/NIP | Wajib numerik, 8–18 digit. | NIM/NIP harus berupa angka 8–18 digit. |
| Peran | Wajib dipilih dari daftar peran. | Peran wajib dipilih. |

### FR-004 – Keamanan Sesi dan Pembekuan Akun

| ID Fitur | FR-004 |
| :---- | :---- |
| **Nama Fitur** | Keamanan Sesi dan Pembekuan Akun |
| **Deskripsi** | Admin dapat membekukan akun yang menunjukkan aktivitas tidak wajar, seperti mengirim pertanyaan berulang secara berlebihan atau mengunduh materi secara massal. Admin juga dapat mengakhiri sesi akun yang sedang berjalan. |
| **Pengguna** | Admin Pengelola |
| **Prioritas** | Disarankan |
| **Syarat awal** | Admin telah masuk dan akun target teridentifikasi. |
| **Hasil akhir** | Akun target dibekukan dan seluruh sesi aktifnya diputus. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Memilih akun dan menekan Bekukan atau Force Logout. | Sistem menampilkan konfirmasi tindakan. |
| 2 | Mengonfirmasi tindakan. | Sistem membekukan akun, memutus sesi, dan mencatat log. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Akun target tidak ditemukan. | Sistem menampilkan pesan dan tidak melakukan perubahan. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| ID akun dan jenis tindakan | Validasi kewenangan dan eksekusi tindakan | Status akun dan sesi terbarui |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-008 | Akun beku tidak dapat masuk hingga dibuka kembali oleh admin. |
| BR-009 | Force logout mengakhiri seluruh sesi aktif tanpa menghapus data pengguna. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Alasan pembekuan | Wajib diisi, maksimal 200 karakter. | Alasan pembekuan wajib diisi. |

### FR-005 – Sinkronisasi Data Akademik (SIAT/PIPP)

| ID Fitur | FR-005 |
| :---- | :---- |
| **Nama Fitur** | Sinkronisasi Data Akademik (SIAT/PIPP) |
| **Deskripsi** | Sistem mengambil data program studi, mata kuliah aktif, dan dosen pengampu dari SIAT atau data PIPP. Data diterima melalui koneksi antarsistem (API) atau impor CSV/Excel secara berkala. |
| **Pengguna** | Admin Pengelola |
| **Prioritas** | Wajib |
| **Syarat awal** | Kredensial integrasi tersedia dan endpoint SIAT/PIPP dapat diakses. |
| **Hasil akhir** | Data referensi akademik tersimpan dan siap dipetakan ke katalog. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Memilih sumber data dan memulai sinkronisasi. | Sistem menghubungi endpoint atau membaca berkas impor. |
| 2 | Meninjau hasil pemetaan data. | Sistem menampilkan ringkasan data baru, berubah, dan gagal. |
| 3 | Mengonfirmasi hasil sinkronisasi. | Sistem menyimpan data dan mencatat log sinkronisasi. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Endpoint tidak dapat diakses. | Sistem menampilkan pesan kegagalan dan menyarankan impor berkas. |
| ALT-2 | Sebagian baris tidak valid. | Sistem menyimpan baris valid dan menampilkan daftar baris gagal untuk diunduh. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Data akademik dari API atau berkas CSV/Excel | Validasi, pemetaan, dan penyimpanan | Data referensi akademik terbarui dan log sinkronisasi |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-010 | SIAT menjadi sumber data induk; konflik data diselesaikan dengan mengutamakan SIAT. |
| BR-011 | Sinkronisasi bersifat idempoten dan tidak menggandakan data yang sama. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Berkas impor | CSV/XLSX, header baku, maksimal 10 MB. | Format berkas tidak sesuai template. |
| Koneksi API | Timeout maksimal 30 detik. | Koneksi ke SIAT/PIPP gagal. Silakan coba lagi atau gunakan impor berkas. |

### FR-006 – Pemetaan MK–Dosen–Modul AR

| ID Fitur | FR-006 |
| :---- | :---- |
| **Nama Fitur** | Pemetaan MK–Dosen–Modul AR |
| **Deskripsi** | Admin menetapkan satu atau lebih dosen pengampu untuk setiap mata kuliah dan menghubungkan modul AR yang tersedia. |
| **Pengguna** | Admin Pengelola |
| **Prioritas** | Wajib |
| **Syarat awal** | Data mata kuliah, dosen, dan modul AR telah tersedia. |
| **Hasil akhir** | Relasi MK–dosen dan MK–modul AR tersimpan dan digunakan pada katalog serta distribusi akses. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Memilih mata kuliah dan menambah dosen pengampu. | Sistem menampilkan daftar dosen dan menyimpan relasi. |
| 2 | Memilih modul AR yang relevan. | Sistem menampilkan pustaka modul AR tervalidasi. |
| 3 | Menyimpan pemetaan. | Sistem memperbarui relasi dan mencatat log. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Modul AR belum tervalidasi. | Sistem menolak penautan dan menampilkan status modul. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Mata kuliah, dosen, modul AR | Validasi relasi dan penyimpanan | Pemetaan akademik dan AR |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-012 | Satu mata kuliah dapat memiliki lebih dari satu dosen pengampu. |
| BR-013 | Satu modul AR dapat digunakan pada lebih dari satu mata kuliah. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Dosen | Minimal satu dan harus berstatus aktif. | Dosen tidak aktif tidak dapat dipetakan. |

### FR-007 – Dashboard Global dan Ekspor Laporan

| ID Fitur | FR-007 |
| :---- | :---- |
| **Nama Fitur** | Dashboard Global dan Ekspor Laporan |
| **Deskripsi** | Admin dapat melihat jumlah dan sebaran pengguna, perubahan aktivitas, serta mata kuliah yang tidak aktif. Laporan dapat diunduh dalam format CSV atau PDF. |
| **Pengguna** | Admin Pengelola |
| **Prioritas** | Wajib |
| **Syarat awal** | Terdapat data aktivitas pada platform. |
| **Hasil akhir** | Admin memperoleh ringkasan pemanfaatan dan berkas laporan. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka dashboard global. | Sistem menampilkan KPI, grafik tren, dan sebaran prodi. |
| 2 | Memfilter periode atau program studi. | Sistem memperbarui visualisasi sesuai filter. |
| 3 | Menekan Ekspor. | Sistem menghasilkan berkas CSV/PDF dan menyediakan tautan unduhan. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Data pada periode filter kosong. | Sistem menampilkan status tanpa data, bukan angka nol yang menyesatkan. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Rentang periode, program studi | Agregasi data aktivitas | Dashboard dan berkas laporan |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-014 | Statistik global ditampilkan sebagai data agregat; identitas pribadi mahasiswa tidak ditampilkan. |
| BR-015 | Mata kuliah tanpa interaksi lebih dari 4 minggu ditandai sebagai nonaktif. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Rentang periode | Tanggal awal tidak boleh melebihi tanggal akhir. | Rentang tanggal tidak valid. |

### FR-008 – Kelola Dokumen Materi dan Basis Pengetahuan

| ID Fitur | FR-008 |
| :---- | :---- |
| **Nama Fitur** | Kelola Dokumen Materi dan Basis Pengetahuan |
| **Deskripsi** | Dosen dapat mengunggah materi PDF atau teks, melihat riwayat berkas, dan menentukan materi yang digunakan sebagai sumber jawaban. Materi bermasalah dapat langsung dinonaktifkan. |
| **Pengguna** | Dosen Pengampu |
| **Prioritas** | Wajib |
| **Syarat awal** | Dosen telah masuk dan memiliki mata kuliah yang diampu. |
| **Hasil akhir** | Dokumen tersimpan dengan status aktif/nonaktif yang menentukan sumber jawaban Tutor AI. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Mengunggah dokumen materi pada mata kuliah. | Sistem memvalidasi format dan ukuran, lalu menyimpan berkas. |
| 2 | Mengaktifkan dokumen sebagai basis pengetahuan. | Sistem mengekstraksi teks dan menandai dokumen aktif. |
| 3 | Menonaktifkan dokumen melalui toggle atau penonaktifan materi. | Sistem menghentikan penggunaan dokumen sebagai sumber rujukan. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Unggahan gagal karena format/ukuran. | Sistem menolak berkas dan menampilkan alasan. |
| ALT-2 | Ekstraksi teks gagal. | Sistem menandai dokumen gagal ekstraksi dan meminta unggah ulang. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Berkas materi dan status aktif | Validasi, penyimpanan, ekstraksi teks | Basis pengetahuan aktif |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-016 | Hanya dokumen berstatus aktif yang dirujuk Tutor AI. |
| BR-017 | Menonaktifkan dokumen tidak menghapus arsip riwayat. |
| BR-018 | Tutor AI baru dapat diaktifkan bila minimal satu dokumen aktif tersedia. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Berkas | PDF/DOCX/TXT, maksimal 25 MB. | Format berkas tidak didukung atau melebihi 25 MB. |
| Dokumen aktif | Minimal satu dokumen aktif. | Aktifkan minimal satu dokumen sebelum Tutor AI digunakan. |

### FR-009 – Konfigurasi Identitas dan batasan jawaban Tutor AI

| ID Fitur | FR-009 |
| :---- | :---- |
| **Nama Fitur** | Konfigurasi Identitas dan batasan jawaban Tutor AI |
| **Deskripsi** | Dosen dapat mengatur nama Tutor AI, sapaan, topik utama, dan batasan jawaban agar Tutor AI tidak menjawab di luar materi. |
| **Pengguna** | Dosen Pengampu |
| **Prioritas** | Wajib |
| **Syarat awal** | Dokumen materi telah tersedia. |
| **Hasil akhir** | Konfigurasi Tutor AI tersimpan dan berlaku pada sesi konsultasi berikutnya. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka pengaturan Tutor AI pada mata kuliah. | Sistem menampilkan formulir konfigurasi. |
| 2 | Mengisi identitas, sapaan, topik, dan batasan jawaban. | Sistem memvalidasi isian. |
| 3 | Menyimpan konfigurasi. | Sistem menerapkan konfigurasi dan mencatat versi perubahan. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Topik utama kosong. | Sistem menolak penyimpanan dan meminta minimal satu topik. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Identitas asisten, sapaan, topik, status batasan jawaban | Validasi dan penyimpanan konfigurasi | Konfigurasi Tutor AI aktif |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-019 | Dengan batasan jawaban aktif, jawaban wajib bersumber dari dokumen aktif. |
| BR-020 | Bila dasar jawaban tidak ditemukan, asisten menyatakan ketidaktahuan secara sopan dan tidak mengarang jawaban. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Nama asisten | Wajib, maksimal 60 karakter. | Nama asisten maksimal 60 karakter. |
| Topik utama | Minimal satu topik. | Tambahkan minimal satu topik utama. |

### FR-010 – Distribusi dan Rotasi Kode Kelas

| ID Fitur | FR-010 |
| :---- | :---- |
| **Nama Fitur** | Distribusi dan Rotasi Kode Kelas |
| **Deskripsi** | Dosen dapat membagikan kode atau tautan kelas. Jika akses tersebar kepada pihak yang tidak berhak, dosen dapat mengganti kode agar kode lama tidak berlaku bagi pendaftar baru. |
| **Pengguna** | Dosen Pengampu |
| **Prioritas** | Wajib |
| **Syarat awal** | Mata kuliah memiliki ruang belajar aktif. |
| **Hasil akhir** | Tautan/kode kelas berlaku dan dapat digunakan mahasiswa untuk klaim akses. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka menu distribusi akses kelas. | Sistem menampilkan tautan dan kode kelas aktif. |
| 2 | Menyalin tautan atau kode. | Sistem menyalin ke papan klip dan menampilkan konfirmasi. |
| 3 | Merotasi kode. | Sistem menerbitkan kode baru; kode lama tidak berlaku bagi pendaftar baru. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Kode sudah kedaluwarsa saat digunakan mahasiswa. | Sistem menolak klaim dan meminta kode terbaru dari dosen. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Mata kuliah dan aksi distribusi | Pembuatan/rotasi kode | Tautan dan kode kelas aktif |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-021 | Kode unik per mata kuliah per semester. |
| BR-022 | Rotasi kode tidak mengeluarkan mahasiswa yang telah sah bergabung. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Kode kelas | 6–8 karakter alfanumerik. | Format kode kelas tidak valid. |

### FR-011 – Penautan Modul AR dan Petunjuk Praktikum

| ID Fitur | FR-011 |
| :---- | :---- |
| **Nama Fitur** | Penautan Modul AR dan Petunjuk Praktikum |
| **Deskripsi** | Fitur ini ditunda sampai cakupan dan metode pengembangan AR ditetapkan. Rencananya, dosen dapat memilih modul AR, menghubungkannya ke mata kuliah, menambahkan petunjuk praktikum, dan mengatur waktu ketersediaannya. |
| **Pengguna** | Dosen Pengampu |
| **Prioritas** | Wajib |
| **Syarat awal** | Modul AR tersedia dan berstatus tervalidasi. |
| **Hasil akhir** | Modul AR tertaut ke mata kuliah dan tampil pada ruang belajar mahasiswa. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Menelusuri repositori modul AR. | Sistem menampilkan daftar modul tervalidasi. |
| 2 | Menautkan modul dan melampirkan petunjuk PDF. | Sistem menyimpan relasi dan berkas petunjuk. |
| 3 | Mengatur status ketersediaan modul. | Sistem menampilkan atau menyembunyikan modul pada kelas. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Modul belum tervalidasi. | Sistem menolak penautan dan menampilkan status validasi. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Modul AR, berkas petunjuk, status ketersediaan | Validasi dan penyimpanan relasi | Modul AR tertaut ke mata kuliah |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-023 | Hanya modul AR berstatus tervalidasi yang dapat ditautkan. |
| BR-024 | Modul AR mengikuti linimasa materi yang ditetapkan dosen. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Petunjuk praktikum | PDF, maksimal 10 MB. | Berkas petunjuk harus PDF maksimal 10 MB. |

### FR-012 – Dashboard Analitik Kelas

| ID Fitur | FR-012 |
| :---- | :---- |
| **Nama Fitur** | Dashboard Analitik Kelas |
| **Deskripsi** | Dosen dapat melihat partisipasi mahasiswa, topik yang sering ditanyakan, pertanyaan yang belum terjawab, penggunaan AR, dan mahasiswa yang belum berpartisipasi. Ringkasan aktivitas kelas dapat diunduh. |
| **Pengguna** | Dosen Pengampu |
| **Prioritas** | Wajib |
| **Syarat awal** | Kelas memiliki data aktivitas. |
| **Hasil akhir** | Dosen memperoleh gambaran pemanfaatan kelas dan berkas rekapitulasi. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka dashboard kelas. | Sistem menampilkan ringkasan partisipasi dan topik populer. |
| 2 | Memfilter periode. | Sistem memperbarui data sesuai periode. |
| 3 | Mengekspor rekapitulasi. | Sistem menghasilkan berkas CSV/Excel. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Belum ada aktivitas. | Sistem menampilkan status tanpa data beserta panduan membagikan kode kelas. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Mata kuliah dan periode | Agregasi aktivitas kelas | Dashboard kelas dan berkas rekapitulasi |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-025 | Data analitik kelas hanya dapat diakses dosen pengampu mata kuliah terkait dan admin. |
| BR-026 | Identitas mahasiswa ditampilkan hanya pada daftar partisipasi, bukan pada analitik topik. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Periode | Maksimal 1 tahun ajaran. | Periode melebihi batas yang diizinkan. |

### FR-013 – Koreksi Jawaban Asisten

| ID Fitur | FR-013 |
| :---- | :---- |
| **Nama Fitur** | Koreksi Jawaban Asisten |
| **Deskripsi** | Dosen dapat memeriksa jawaban yang mendapat penilaian negatif dan menuliskan koreksi. Koreksi digunakan sebagai acuan untuk memperbaiki jawaban serupa berikutnya. |
| **Pengguna** | Dosen Pengampu |
| **Prioritas** | Wajib |
| **Syarat awal** | Terdapat umpan balik negatif dari mahasiswa. |
| **Hasil akhir** | Koreksi tersimpan dan menjadi acuan jawaban berikutnya. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka daftar jawaban bernilai rendah. | Sistem menampilkan jawaban, konteks pertanyaan, dan catatan mahasiswa. |
| 2 | Menuliskan koreksi. | Sistem memvalidasi isian koreksi. |
| 3 | Menyimpan koreksi. | Sistem menyimpan koreksi dan menandainya sebagai acuan. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Jawaban sudah dikoreksi dosen lain. | Sistem menampilkan riwayat koreksi dan meminta konfirmasi penimpaan. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Jawaban target dan teks koreksi | Penyimpanan dan penerapan acuan koreksi | Koreksi jawaban aktif |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-027 | Koreksi tercatat beserta identitas dosen dan waktu. |
| BR-028 | Koreksi hanya berlaku untuk mata kuliah terkait. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Teks koreksi | Wajib, 10–2000 karakter. | Koreksi minimal 10 karakter. |

### FR-014 – Penelusuran dan Penyaringan Katalog

| ID Fitur | FR-014 |
| :---- | :---- |
| **Nama Fitur** | Penelusuran dan Penyaringan Katalog |
| **Deskripsi** | Mahasiswa dapat mencari mata kuliah berdasarkan nama, dosen, program studi, atau kata kunci, lalu melihat informasi mata kuliah tersebut. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Wajib |
| **Syarat awal** | Terdapat entri katalog berstatus publish. |
| **Hasil akhir** | Mahasiswa menemukan mata kuliah dan informasinya. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka katalog. | Sistem menampilkan daftar entri publish. |
| 2 | Memasukkan kata kunci atau filter. | Sistem memperbarui hasil secara relevan. |
| 3 | Membuka halaman detail. | Sistem menampilkan profil pengajar, topik, dan ketersediaan AR. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Hasil pencarian kosong. | Sistem menampilkan saran kata kunci dan filter alternatif. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Kata kunci dan filter | Pencarian dan penyaringan | Daftar hasil dan detail mata kuliah |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-029 | Hanya entri berstatus publish yang tampil pada katalog publik. |
| BR-030 | Entri arsip tidak muncul pada hasil pencarian. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Kata kunci | Maksimal 100 karakter. | Kata kunci terlalu panjang. |

### FR-015 – Klaim Akses Kelas

| ID Fitur | FR-015 |
| :---- | :---- |
| **Nama Fitur** | Bergabung ke Kelas |
| **Deskripsi** | Mahasiswa bergabung ke kelas melalui tautan atau kode yang diberikan dosen. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Wajib |
| **Syarat awal** | Mahasiswa telah masuk dan memiliki kode/tautan valid. |
| **Hasil akhir** | Kelas terhubung dengan akun mahasiswa dan tampil pada beranda. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka tautan atau memasukkan kode kelas. | Sistem memvalidasi kode dan status kelas. |
| 2 | Mengonfirmasi pendaftaran. | Sistem menghubungkan kelas dengan akun mahasiswa. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Kode tidak valid atau kedaluwarsa. | Sistem menolak klaim dan meminta kode terbaru. |
| ALT-2 | Mahasiswa sudah terdaftar. | Sistem mengarahkan langsung ke ruang belajar tanpa duplikasi. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Kode atau tautan kelas | Validasi kode dan pendaftaran | Enrollment kelas |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-031 | Satu mahasiswa hanya memiliki satu enrollment per mata kuliah per semester. |
| BR-032 | Kode kelas tidak dapat digunakan untuk mata kuliah lain. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Kode kelas | Wajib, 6–8 karakter alfanumerik. | Kode kelas tidak valid. |

### FR-016 – Konsultasi Tutor AI Bersitasi

| ID Fitur | FR-016 |
| :---- | :---- |
| **Nama Fitur** | Konsultasi Tutor AI Bersitasi |
| **Deskripsi** | Mahasiswa bertanya melalui percakapan teks. Tutor AI menjawab berdasarkan materi dosen dan mencantumkan sumber dokumen serta halaman. Jika pertanyaan berada di luar materi, Tutor AI memberi tahu mahasiswa dan dapat menyarankan pertanyaan lanjutan. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Wajib |
| **Syarat awal** | Mahasiswa terdaftar pada kelas dan Tutor AI aktif dengan minimal satu dokumen aktif. |
| **Hasil akhir** | Percakapan tersimpan dan jawaban ditampilkan beserta sumbernya. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Mengetik pertanyaan pada ruang chat. | Sistem memvalidasi pertanyaan dan menampilkan indikator proses. |
| 2 | Sistem menyusun jawaban dari basis pengetahuan aktif. | Jawaban ditampilkan beserta sitasi dan saran pertanyaan lanjutan. |
| 3 | Mahasiswa melanjutkan percakapan. | Sistem mempertahankan konteks sesi. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Pertanyaan di luar materi. | Sistem menampilkan pemberitahuan bahwa topik belum tersedia dan menyarankan bertanya ke dosen. |
| ALT-2 | Layanan model tidak tersedia. | Sistem menampilkan pesan gangguan dan opsi mencoba kembali. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Pertanyaan teks (1–1000 karakter) | Pencarian konteks, penyusunan jawaban, penyisipan sitasi | Jawaban bersitasi dan riwayat sesi |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-033 | Setiap jawaban wajib merujuk minimal satu dokumen aktif. |
| BR-034 | Asisten dilarang mengarang jawaban; bila dasar tidak ditemukan, nyatakan ketidaktahuan. |
| BR-035 | Gaya komunikasi edukatif dan menggunakan bahasa Indonesia. |
| BR-036 | Asisten tidak diperkenankan menghasilkan soal, kuis, atau kunci jawaban. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Pesan | Wajib, 1–1000 karakter. | Pesan tidak boleh kosong dan maksimal 1000 karakter. |
| Batas laju | Maksimal 20 pesan per menit per pengguna. | Terlalu banyak permintaan. Tunggu sebentar. |

### FR-017 – Riwayat, Bookmark, dan Catatan

| ID Fitur | FR-017 |
| :---- | :---- |
| **Nama Fitur** | Riwayat, Bookmark, dan Catatan |
| **Deskripsi** | Percakapan disimpan otomatis. Mahasiswa dapat mengganti judul, menghapus riwayat, menandai percakapan penting, dan menambahkan catatan pribadi. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Wajib |
| **Syarat awal** | Mahasiswa memiliki riwayat percakapan. |
| **Hasil akhir** | Riwayat, bookmark, dan catatan tersimpan serta dapat dibuka kembali. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka menu riwayat. | Sistem menampilkan daftar sesi percakapan. |
| 2 | Membuka sesi dan menandai pesan. | Sistem menyimpan bookmark pada pesan terpilih. |
| 3 | Menambahkan catatan pribadi. | Sistem menyimpan catatan pada sesi terkait. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Mahasiswa menghapus riwayat. | Sistem meminta konfirmasi dan menghapus permanen setelah disetujui. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Pilihan sesi/pesan dan teks catatan | Penyimpanan dan pengambilan data pribadi | Riwayat, bookmark, dan catatan |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-037 | Riwayat, bookmark, dan catatan hanya dapat diakses pemiliknya. |
| BR-038 | Penghapusan riwayat bersifat permanen dan tidak dapat dibatalkan. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Catatan | Maksimal 2000 karakter. | Catatan maksimal 2000 karakter. |

### FR-018 – Umpan Balik Jawaban

| ID Fitur | FR-018 |
| :---- | :---- |
| **Nama Fitur** | Umpan Balik Jawaban |
| **Deskripsi** | Mahasiswa dapat menilai setiap jawaban dengan jempol ke atas atau ke bawah, serta menambahkan catatan jika diperlukan. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Disarankan |
| **Syarat awal** | Terdapat jawaban asisten pada sesi percakapan. |
| **Hasil akhir** | Umpan balik tersimpan dan masuk ke rekapitulasi dosen. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Menekan ikon jempol pada jawaban. | Sistem menyimpan penilaian dan menampilkan konfirmasi. |
| 2 | Menambahkan catatan opsional. | Sistem menyimpan catatan bersama penilaian. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Mahasiswa mengubah penilaian. | Sistem memperbarui penilaian terakhir. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Nilai umpan balik dan catatan | Penyimpanan dan agregasi | Umpan balik tersimpan |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-039 | Satu jawaban memiliki satu umpan balik aktif per mahasiswa. |
| BR-040 | Umpan balik negatif masuk ke daftar koreksi dosen. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Catatan | Opsional, maksimal 500 karakter. | Catatan maksimal 500 karakter. |

### FR-019 – Membuka Modul AR yang Tersedia (Ditunda)

| ID Fitur | FR-019 |
| :---- | :---- |
| **Nama Fitur** | Membuka Modul AR yang Tersedia |
| **Deskripsi** | Mahasiswa dapat membuka modul AR yang sudah tersedia melalui tautan kelas. Pengembangan mode AR baru, penilaian otomatis, dan AR berbantuan AI generatif belum termasuk tahap 1 dan 2\. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Ditunda |
| **Syarat awal** | Aplikasi AR existing terpasang atau tautannya tersedia. |
| **Hasil akhir** | Mahasiswa membuka modul AR existing; pemakaian dicatat bila tersedia. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Menekan tautan modul AR dari kelas. | Sistem membuka aplikasi AR existing atau menampilkan tautan. |
| 2 | — | Sistem menampilkan petunjuk penggunaan modul AR. |
| 3 | — | Mahasiswa menjalankan modul pada aplikasi AR terpisah. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Aplikasi AR tidak tersedia di perangkat. | Tampilkan tautan unduh dan petunjuk pemasangan. |
| ALT-2 | Perangkat tidak kompatibel. | Tampilkan pesan perangkat belum didukung. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Tautan modul dan perangkat mahasiswa | Pengalihan ke aplikasi AR existing | Modul AR terbuka |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-041 | Modul AR existing dibuka melalui tautan dari kelas; tidak tertanam di dalam platform. |
| BR-042 | Modul AR wajib menampilkan disclaimer bahwa simulasi tidak menggantikan praktikum fisik. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Tautan modul | Tautan valid dan modul aktif. | Modul AR belum tersedia. |
| Perangkat | Aplikasi AR existing terpasang. | Pasang aplikasi AR terlebih dahulu. |

### FR-020 – Penilaian dan Ulasan Latihan AR (Ditunda)

| ID Fitur | FR-020 |
| :---- | :---- |
| **Nama Fitur** | Penilaian dan Ulasan Latihan AR (Ditunda) |
| **Deskripsi** | Fitur ini ditunda sampai metode dan lingkup AR diputuskan. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Ditunda |
| **Syarat awal** | Metode dan lingkup AR sudah diputuskan. |
| **Hasil akhir** | Nilai dan daftar kesalahan tersimpan; mahasiswa dapat mengulang latihan. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Menyelesaikan seluruh tahapan Mode Latihan. | Sistem menghitung skor berdasarkan urutan, kelengkapan, dan waktu. |
| 2 | Membuka review kesalahan. | Sistem menampilkan langkah salah beserta penjelasan yang benar. |
| 3 | Mengulang dari tahap tertentu. | Sistem memulai ulang sesi sesuai pilihan mahasiswa. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Sesi dihentikan di tengah jalan. | Sistem menyimpan progres sebagai tidak selesai dan tidak memberi nilai akhir. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Jejak langkah, waktu, dan kelengkapan | Perhitungan skor dan pemetaan kesalahan | Skor akhir dan daftar kesalahan |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-043 | Skor akhir berada pada rentang 0–100. |
| BR-044 | Bobot penilaian: urutan 50%, kelengkapan 30%, waktu 20% (dapat disesuaikan, lihat OI-07). |
| BR-045 | Nilai hanya diberikan bila seluruh tahapan wajib diselesaikan. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Penyelesaian sesi | Seluruh tahap wajib terlewati. | Latihan belum selesai; nilai belum tersedia. |

### FR-021 – Dashboard Ringkasan Belajar Mahasiswa

| ID Fitur | FR-021 |
| :---- | :---- |
| **Nama Fitur** | Dashboard Ringkasan Belajar Mahasiswa |
| **Deskripsi** | Mahasiswa dapat melihat kelas yang diikuti, ringkasan aktivitas belajar, saran materi atau modul lanjutan, dan pengingat belajar. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Disarankan |
| **Syarat awal** | Mahasiswa memiliki minimal satu kelas terdaftar. |
| **Hasil akhir** | Mahasiswa memperoleh ringkasan progres dan rekomendasi. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Membuka dashboard belajar. | Sistem menampilkan kelas, statistik, dan rekomendasi. |
| 2 | Memilih kartu kelas. | Sistem mengarahkan ke ruang belajar terkait. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Belum ada aktivitas. | Sistem menampilkan panduan memulai belajar. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Data enrollment dan aktivitas pribadi | Agregasi dan penyusunan rekomendasi | Ringkasan belajar pribadi |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-046 | Dashboard hanya menampilkan data milik mahasiswa yang bersangkutan. |
| BR-047 | Rekomendasi bersifat saran dan tidak memengaruhi penilaian akademik. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Kelas terdaftar | Minimal satu kelas. | Daftarkan kelas terlebih dahulu. |

### FR-022 – Notifikasi dan Pengingat

| ID Fitur | FR-022 |
| :---- | :---- |
| **Nama Fitur** | Notifikasi dan Pengingat |
| **Deskripsi** | Aplikasi memberi tahu pengguna ketika tersedia materi atau modul AR baru. Mahasiswa yang lama tidak aktif juga menerima pengingat belajar. |
| **Pengguna** | Mahasiswa, Dosen Pengampu |
| **Prioritas** | Disarankan |
| **Syarat awal** | Pengguna telah masuk dan preferensi notifikasi aktif. |
| **Hasil akhir** | Notifikasi tersimpan dan ditampilkan pada pusat notifikasi. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Sistem mendeteksi peristiwa pemicu. | Sistem membuat notifikasi untuk pengguna terkait. |
| 2 | Pengguna membuka notifikasi. | Sistem menandai notifikasi sebagai telah dibaca dan mengarahkan ke halaman terkait. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Pengguna menonaktifkan notifikasi. | Sistem tidak mengirim notifikasi non-esensial. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Peristiwa pemicu dan preferensi pengguna | Penyaringan dan pembuatan notifikasi | Notifikasi dalam aplikasi |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-048 | Pengingat ketidakaktifan dikirim maksimal satu kali per 7 hari. |
| BR-049 | Notifikasi keamanan akun tetap dikirim meskipun preferensi non-esensial dimatikan. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Preferensi notifikasi | Nilai aktif/nonaktif. | Preferensi notifikasi tidak valid. |

### FR-023 – Menjaga Kualitas Jawaban dan Perilaku "Tidak Tahu"

| ID Fitur | FR-023 |
| :---- | :---- |
| **Nama Fitur** | Menjaga Kualitas Jawaban dan Perilaku "Tidak Tahu" |
| **Deskripsi** | Tutor AI hanya menjawab berdasarkan materi aktif dan mencantumkan sumbernya. Jika informasi tidak ditemukan, Tutor AI menyatakan bahwa pertanyaan belum dapat dijawab. Saat pembatasan topik aktif, Tutor AI tidak boleh mengarang atau menggunakan informasi di luar materi. |
| **Pengguna** | Mahasiswa, Dosen Pengampu |
| **Prioritas** | Wajib |
| **Syarat awal** | Ada minimal satu materi aktif dan Tutor AI menyala. |
| **Hasil akhir** | Jawaban tersimpan bersama sumbernya, atau pertanyaan tercatat sebagai belum terjawab. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Mahasiswa mengirim pertanyaan. | Sistem mencari bagian materi yang paling relevan. |
| 2 | — | Bila dasar ditemukan, sistem menampilkan jawaban beserta sumbernya. |
| 3 | — | Bila dasar tidak ditemukan, sistem menyatakan topik belum tersedia dan menyarankan bertanya kepada dosen. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Layanan AI sedang terganggu | Tampilkan pesan gangguan dan pilihan mencoba lagi. |
| ALT-2 | Materi baru saja diubah | Gunakan versi materi aktif terbaru. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Pertanyaan dan materi aktif | Pencarian dasar jawaban dan penyusunan jawaban | Jawaban bersumber atau pernyataan belum tersedia |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-050 | Setiap jawaban wajib menyebut sumber materi. |
| BR-051 | Tutor AI dilarang mengarang jawaban. |
| BR-052 | Saat pembatasan topik menyala, pengetahuan umum tidak boleh dipakai sebagai pengganti materi. |
| BR-053 | Pertanyaan yang tidak terjawab dicatat untuk dosen. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Pertanyaan | Wajib, 1–1000 karakter. | Pesan tidak boleh kosong dan paling banyak 1000 karakter. |
| Materi aktif | Minimal satu. | Nyalakan minimal satu materi sebelum Tutor AI dipakai. |
| Waktu jawab | Target paling lama 5 detik. | Jawaban membutuhkan waktu lebih lama. Coba lagi. |

### FR-024 – Menguji Akurasi Jawaban

| ID Fitur | FR-024 |
| :---- | :---- |
| **Nama Fitur** | Menguji Akurasi Jawaban |
| **Deskripsi** | Dosen menyiapkan pertanyaan uji dan jawaban acuan. Sistem menguji jawaban Tutor AI, menghitung tingkat akurasi, dan menampilkan pertanyaan yang belum dijawab dengan benar. |
| **Pengguna** | Dosen Pengampu, Admin Pengelola |
| **Prioritas** | Wajib |
| **Syarat awal** | Materi aktif dan daftar pertanyaan uji tersedia. |
| **Hasil akhir** | Hasil akurasi tersimpan per mata kuliah dan per versi materi. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Dosen menyiapkan pertanyaan uji dan jawaban acuan. | Sistem menyimpan daftar uji. |
| 2 | Dosen menjalankan pengujian. | Sistem memproses setiap pertanyaan. |
| 3 | — | Sistem menampilkan tingkat akurasi dan daftar pertanyaan yang gagal. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Daftar uji kosong | Sistem menawarkan contoh pertanyaan. |
| ALT-2 | Akurasi di bawah ambang | Sistem menandai mata kuliah perlu perbaikan materi. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Pertanyaan uji dan jawaban acuan | Pencocokan jawaban sistem dengan acuan | Laporan akurasi dan daftar kegagalan |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-054 | Ambang awal akurasi 90%; dapat diubah (lihat open issue). |
| BR-055 | Pengujian dijalankan ulang setiap materi berubah. |
| BR-056 | Hasil pengujian tidak memengaruhi nilai mahasiswa. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Jumlah pertanyaan uji | Minimal 10 per mata kuliah. | Tambahkan minimal 10 pertanyaan uji. |
| Jawaban acuan | Wajib diisi. | Jawaban acuan wajib diisi. |

### FR-025 – Integrasi Avatar Live Tutor (Fase 2\)

| ID Fitur | FR-025 |
| :---- | :---- |
| **Nama Fitur** | Integrasi Avatar Live Tutor |
| **Deskripsi** | Mahasiswa dapat bertanya melalui teks atau suara. Avatar menyampaikan jawaban melalui suara, disertai ekspresi dan gerakan sesuai keadaan. Jika layanan suara utama gagal, sistem menggunakan suara dari peramban. |
| **Pengguna** | Mahasiswa |
| **Prioritas** | Wajib pada tahap 2 |
| **Syarat awal** | Fase 1 stabil; perangkat mendukung WebGL dan audio. |
| **Hasil akhir** | Sesi avatar berjalan dan tercatat. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Mahasiswa memilih mode avatar. | Sistem memeriksa dukungan perangkat dan izin mikrofon. |
| 2 | Mahasiswa bertanya lewat teks atau suara. | Sistem menyiapkan jawaban dari materi yang sama dengan mode chat. |
| 3 | — | Jawaban ditampilkan, diucapkan, dan avatar bergerak sesuai keadaan. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Suara utama gagal | Gunakan suara peramban. |
| ALT-2 | Perangkat tidak mendukung | Alihkan ke mode chat. |
| ALT-3 | Izin mikrofon ditolak | Gunakan input teks. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Pertanyaan teks atau suara | Penyusunan jawaban, pengubahan ke suara, animasi avatar | Jawaban bersuara dan animasi avatar |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-057 | Isi jawaban pada mode avatar sama dengan mode chat. |
| BR-058 | Skenario percakapan tidak ditulis dosen per sesi. |
| BR-059 | Pembatasan topik tetap berlaku. |
| BR-060 | Percakapan avatar tersimpan seperti percakapan chat. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Dukungan perangkat | WebGL dan audio aktif. | Perangkat belum mendukung mode avatar. |
| Ukuran audio | Maksimal 10 MB. | Rekaman terlalu besar. Coba lebih singkat. |
| Izin mikrofon | Wajib untuk input suara. | Izin mikrofon ditolak. Gunakan input teks. |

### FR-026 – Memantau Pemrosesan Materi

| ID Fitur | FR-026 |
| :---- | :---- |
| **Nama Fitur** | Memantau Pemrosesan Materi |
| **Deskripsi** | Dosen dapat melihat perkembangan pengolahan materi, mulai dari unggah dan pembacaan teks hingga siap digunakan. Jika proses gagal, sistem menampilkan alasannya dan pilihan untuk mencoba kembali. |
| **Pengguna** | Dosen Pengampu |
| **Prioritas** | Wajib |
| **Syarat awal** | Dosen mengunggah materi. |
| **Hasil akhir** | Materi siap dipakai sebagai sumber jawaban atau ditandai gagal. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Dosen mengunggah materi. | Sistem menampilkan status proses. |
| 2 | — | Sistem menampilkan progres dan hasil akhir. |
| 3 | Dosen menekan coba ulang bila gagal. | Sistem memproses ulang materi. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Pemrosesan gagal | Tampilkan pesan dan tombol coba ulang. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Berkas materi | Pembacaan teks, OCR, pemotongan, penyiapan | Materi siap dipakai |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-061 | Materi hanya dipakai setelah status siap. |
| BR-062 | Kegagalan dicatat beserta alasannya. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Berkas | PDF, DOCX, atau TXT, maksimal 25 MB. | Format atau ukuran berkas tidak didukung. |

### FR-027 – Menyesuaikan Jawaban per Jenjang

| ID Fitur | FR-027 |
| :---- | :---- |
| **Nama Fitur** | Menyesuaikan Jawaban per Jenjang |
| **Deskripsi** | Cara menjelaskan jawaban disesuaikan dengan jenjang mahasiswa: S1 menggunakan analogi sederhana, S2 lebih teknis, dan S3 lebih analitis. Admin dapat mengubah panduan untuk setiap jenjang dan mode percakapan. |
| **Pengguna** | Mahasiswa, Admin Pengelola |
| **Prioritas** | Wajib |
| **Syarat awal** | Jenjang mahasiswa terisi pada profil. |
| **Hasil akhir** | Jawaban mengikuti gaya jenjang yang berlaku. |

**Alur penggunaan**

| Langkah | Aksi Pengguna | Respons Sistem |
| :---- | :---- | :---- |
| 1 | Mahasiswa bertanya. | Sistem membaca jenjang pada profil. |
| 2 | — | Sistem memilih gaya jawaban sesuai jenjang dan mode. |

**Kondisi lain**

| Kode | Kondisi | Penanganan |
| :---- | :---- | :---- |
| ALT-1 | Jenjang belum diisi | Gunakan gaya S1 sebagai bawaan. |

**Masukan proses dan hasil**

| Masukan | Proses | Hasil |
| :---- | :---- | :---- |
| Pertanyaan dan jenjang | Pemilihan gaya jawaban | Jawaban sesuai jenjang |

**Aturan Bisnis**

| ID | Aturan Bisnis |
| :---- | :---- |
| BR-063 | Perubahan panduan gaya jawaban hanya dapat dilakukan admin. |
| BR-064 | Perubahan berlaku pada percakapan berikutnya. |

**Pemeriksaan data dan pesan kesalahan**

| Data atau kondisi | Aturan Validasi | Pesan kesalahan |
| :---- | :---- | :---- |
| Jenjang | S1, S2, atau S3. | Jenjang belum dipilih. |

# **6\. Spesifikasi Antarmuka**

## **6.1 Antarmuka Pengguna (UI)**

*Sertakan wireframe / mockup dan alur navigasi antar layar.*

| ID Layar | Nama Layar | Deskripsi | Tautan Wireframe / Mockup |
| :---- | :---- | :---- | :---- |
| UI-001 | Beranda Katalog | Daftar Tutor AI dan modul AR lintas prodi dengan pencarian dan filter. | Belum tersedia |
| UI-002 | Detail Mata Kuliah | Profil pengajar, ringkasan topik, dan ketersediaan modul AR. | Belum tersedia |
| UI-003 | Klaim Akses Kelas | Formulir kode kelas dan konfirmasi pendaftaran. | Belum tersedia |
| UI-004 | Beranda Mata Kuliah Saya | Kartu akses cepat kelas yang diikuti. | Belum tersedia |
| UI-005 | Ruang Chat Tutor AI | Antarmuka percakapan, sitasi sumber, dan saran pertanyaan. | Belum tersedia |
| UI-006 | Riwayat, Bookmark, Catatan | Daftar sesi, penanda pesan, dan catatan pribadi. | Belum tersedia |
| UI-007 | Peluncur Web-AR | Pemeriksaan perangkat, izin kamera, dan pemilihan modul. | Belum tersedia |
| UI-008 | Mode Pandu | Panduan langkah demi langkah dengan penanda visual. | Belum tersedia |
| UI-009 | Mode Bebas | Eksplorasi objek dan tahapan tanpa panduan. | Belum tersedia |
| UI-010 | Mode Latihan | Praktik mandiri tanpa panduan dengan penilaian otomatis. | Belum tersedia |
| UI-011 | Review Kesalahan AR | Daftar langkah salah dan penjelasan perbaikan. | Belum tersedia |
| UI-012 | Dashboard Belajar Mahasiswa | Kelas diikuti, statistik pribadi, dan rekomendasi. | Belum tersedia |
| UI-013 | Dashboard Analitik Kelas | Partisipasi, topik populer, dan statistik AR per kelas. | Belum tersedia |
| UI-014 | Kelola Materi | Unggah materi, riwayat berkas, dan pilihan untuk mengaktifkan atau menonaktifkan materi sebagai sumber jawaban. | Belum tersedia |
| UI-015 | Konfigurasi Tutor AI | Identitas asisten, sapaan, topik, dan batasan jawaban. | Belum tersedia |
| UI-016 | Koreksi Jawaban | Daftar jawaban bernilai rendah dan formulir koreksi. | Belum tersedia |
| UI-017 | Dashboard Global | Jumlah pengguna, tren aktivitas, sebaran program studi, dan unduh laporan. | Belum tersedia |
| UI-018 | Kelola Katalog | Tambah, lihat, ubah, dan arsipkan mata kuliah serta atur tampilannya di katalog. | Belum tersedia |
| UI-019 | Kelola Pengguna | Pencarian akun, penetapan peran, dan pembekuan akun. | Belum tersedia |
| UI-020 | Integrasi dan Pemetaan | Sinkronisasi SIAT/PIPP dan pemetaan MK–dosen–AR. | Belum tersedia |
| UI-021 | Pusat Notifikasi | Daftar notifikasi dan preferensi pengguna. | Belum tersedia |
| UI-022 | Mode Avatar | Percakapan suara/teks, avatar berbicara, ekspresi, dan tombol beralih ke chat. | Belum tersedia |
| UI-023 | Status Pemrosesan Materi | Perkembangan pengolahan materi, pesan kegagalan, dan pilihan coba ulang. | Belum tersedia |
| UI-024 | Pengujian Akurasi | Daftar pertanyaan uji, jawaban acuan, hasil akurasi, dan daftar gagal. | Belum tersedia |

## **6.2 Antarmuka Eksternal / Integrasi**

| ID | Sistem Eksternal | Jenis (API / File / dll.) | Data yang Dipertukarkan |
| :---- | :---- | :---- | :---- |
| INT-001 | SIAT | API | Program studi, mata kuliah aktif, penugasan dosen. |
| INT-002 | Aplikasi PIPP | API / basis data | Data pendukung akademik dan penyelarasan referensi. |
| INT-003 | Object Storage | API penyimpanan | Berkas materi, thumbnail, petunjuk praktikum, aset AR. |
| INT-004 | Layanan Model Bahasa | API | Pertanyaan, konteks materi, dan jawaban (kebijakan data menyusul). |
| INT-005 | Email Gateway (opsional) | API | Notifikasi esensial dan pemulihan akun. |

## **6.3 Notifikasi**

| ID | Pemicu | Kanal (Email / Push / SMS) | Isi Pesan |
| :---- | :---- | :---- | :---- |
| NOT-001 | Dosen menerbitkan materi baru | Dalam aplikasi | Materi baru tersedia pada mata kuliah {nama MK}. |
| NOT-002 | Dosen menautkan modul AR baru | Dalam aplikasi | Modul AR baru tersedia pada mata kuliah {nama MK}. |
| NOT-003 | Mahasiswa tidak aktif 14 hari | Dalam aplikasi | Sudah 14 hari kamu tidak belajar. Lanjutkan progres di {nama MK}. |
| NOT-004 | Akun dibekukan atau sesi diputus | Email (esensial) | Akunmu dibekukan atau sesi diakhiri. Hubungi admin bila perlu. |
| NOT-005 | Jawaban asisten dikoreksi dosen | Dalam aplikasi | Dosen memperbarui jawaban untuk topik {topik}. |

# **7\. Model dan Alur Data**

## **7.1 Diagram Alur**

![][image1]

![][image2]

![][image3]

![][image4]

## **7.2 Entitas Data Utama**

| Entitas | Atribut Utama | Relasi |
| :---- | :---- | :---- |
| Pengguna | Nama, peran, jenjang, NPM, jurusan, fakultas | Memiliki kelas, percakapan, dan materi |
| Mata Kuliah | Judul, penjelasan, gambar sampul, kode pendaftaran, status aktif | Memiliki dosen, peserta, sesi, materi |
| Dosen Mata Kuliah | Mata kuliah dan dosen pengampu | Menghubungkan banyak dosen dan mata kuliah |
| Pendaftaran Kelas | Mata kuliah, mahasiswa, status aktif, waktu daftar | Menghubungkan mahasiswa dan kelas |
| Sesi Materi | Judul, urutan, status aktif | Memiliki materi dan percakapan |
| Materi | Judul, jenis (berkas/link/teks), berkas, status aktif, status proses | Milik satu sesi |
| Halaman Materi | Nomor halaman, teks hasil baca/OCR | Milik satu materi |
| Potongan Materi | Isi potongan, nomor halaman, nomor potongan, vektor | Milik satu materi dan sesi |
| Catatan Pemrosesan | Status, pesan, kesalahan, waktu | Milik satu materi |
| Percakapan | Pengguna, mata kuliah, sesi materi, judul, waktu mulai/aktif | Memiliki banyak pesan |
| Pesan | Pengirim, isi, sumber, audio, waktu jawab, waktu kirim | Milik satu percakapan |
| Panduan Tutor | Jenjang, mode (chat/avatar), isi panduan, status bawaan | Digunakan untuk menyusun jawaban |
| Modul AR | Nama, penjelasan, status pemeriksaan, aset | Dapat dipakai banyak mata kuliah |
| Penautan Modul AR | Mata kuliah, modul AR, status ketersediaan | Menghubungkan mata kuliah dan modul AR |
| Kode Kelas | Mata kuliah, kode, status, waktu terbit | Milik satu mata kuliah |
| Riwayat Aktivitas | Pengguna, tindakan, objek, waktu | Mencatat tindakan penting |
| Pengguna | Nama, surel, peran, jenjang, NPM, jurusan, fakultas | Memiliki kelas, percakapan, dan materi |

## **7.3 Laporan dan Output Sistem**

| ID | Nama Laporan | Deskripsi | Format / Frekuensi |
| :---- | :---- | :---- | :---- |
| LAP-001 | Laporan Global Pemanfaatan | KPI adopsi, tren aktivitas, sebaran prodi, dan MK nonaktif. | PDF/CSV, bulanan atau sesuai permintaan |
| LAP-002 | Rekapitulasi Aktivitas Kelas | Partisipasi, topik populer, pertanyaan tak terjawab, statistik AR. | CSV/Excel, per periode perkuliahan |
| LAP-003 | Ringkasan Belajar Mahasiswa | Kelas diikuti, statistik pribadi, dan rekomendasi. | Tampilan dashboard (tanpa ekspor) |
| LAP-004 | Daftar Jawaban Berkualitas Rendah | Jawaban dengan umpan balik negatif untuk ditinjau dosen. | Tampilan dashboard |
| LAP-005 | Log Sinkronisasi Akademik | Ringkasan data berhasil, berubah, dan gagal. | CSV, setiap sinkronisasi |

# **8\. Kebutuhan Non-Fungsional**

| Kategori | Kebutuhan | Target / Metrik |
| :---- | :---- | :---- |
| Performa | Respons Tutor AI | Waktu tanggap awal maksimal 5 detik pada kondisi normal; target rata-rata di bawah 3 detik. |
| Performa | Pemuatan katalog dan dashboard | Halaman utama tampil maksimal 3 detik pada koneksi 4G. |
| Performa | Peluncuran Web-AR | Modul siap digunakan maksimal 10 detik setelah aset termuat. |
| Keamanan | Autentikasi dan otorisasi | Setiap akses ke layanan sistem harus memeriksa identitas pengguna dan izin sesuai perannya. |
| Keamanan | Perlindungan data | Data dilindungi saat dikirim melalui HTTPS. Data sensitif juga disimpan dalam bentuk terenkripsi. |
| Keamanan | Audit | Tindakan penting admin dan dosen dicatat dalam riwayat yang tidak dapat diubah pengguna. |
| Ketersediaan | Uptime layanan | Minimal 95% per bulan pada jam layanan akademik. |
| Ketersediaan | Pencadangan data | Data dicadangkan setiap hari dan disimpan sekurangnya 30 hari. |
| Kompatibilitas | Peramban | Dua versi terakhir Chrome, Edge, Safari, dan Firefox; Web-AR memerlukan dukungan kamera. |
| Kompatibilitas | Perangkat | Responsif pada ponsel dan laptop; AR dioptimalkan untuk ponsel. |
| Skalabilitas | Beban pengguna | Mendukung minimal 1.000 pengguna aktif bersamaan pada tahap awal. |
| Usability | Kemudahan penggunaan | Dosen dapat menyiapkan Tutor AI tanpa pelatihan teknis mendalam. Alur utama terdiri dari maksimal 5 langkah. |
| Aksesibilitas | Keterbacaan dan navigasi | Kontras memadai, navigasi keyboard, dan label formulir yang jelas. |
| Privasi | Data percakapan | Percakapan hanya dapat diakses pemilik, dosen pengampu (agregat), dan admin berwenang. |
| Pemeliharaan | Konfigurasi | Perubahan konfigurasi Tutor AI dapat dilakukan tanpa mengubah kode. |
| Akurasi | Jawaban sesuai materi | Minimal 90% benar pada daftar pertanyaan uji; tidak ada jawaban tanpa sumber saat materi tersedia. |
| Akurasi | Perilaku "tidak tahu" | 100% pertanyaan di luar materi dijawab dengan pernyataan belum tersedia, bukan jawaban rekaan. |
| Kecepatan | Waktu jawab Tutor AI | Paling lama 5 detik; rata-rata di bawah 3 detik. |
| Kecepatan | Pemrosesan materi | PDF 25 MB selesai paling lama 5 menit. |
| Perangkat | Mode avatar | Berjalan pada peramban yang mendukung WebGL dan audio; ada fallback ke chat. |
| Privasi | Data ke layanan AI | Kebijakan penggunaan Gemini, Groq, dan ElevenLabs disepakati sebelum rilis. |

# **9\. Kriteria Penerimaan**

*Kondisi yang harus terpenuhi agar fitur dianggap selesai; menjadi dasar pengujian dan UAT.*

| ID | Fitur Terkait | Kriteria Penerimaan (Given – When – Then) | Status |
| :---- | :---- | :---- | :---- |
| AC-001 | FR-001 | Jika admin membuka formulir katalog, saat admin menyimpan data lengkap dengan kode unik, mata kuliah tersimpan dan tampil pada daftar katalog. |  |
| AC-002 | FR-002 | Jika mata kuliah berstatus ditampilkan, saat admin menonaktifkannya, mata kuliah hilang dari katalog publik tanpa menghapus data interaksi. |  |
| AC-003 | FR-003 | Jika admin mencari akun berdasarkan NIM, saat peran diubah dan disimpan, peran baru berlaku dan tercatat pada log audit. |  |
| AC-004 | FR-004 | Jika akun terindikasi spam, saat admin membekukan akun, pengguna tidak dapat masuk dan seluruh sesinya diputus. |  |
| AC-005 | FR-005 | Jika endpoint SIAT tersedia, saat admin menjalankan sinkronisasi, data prodi, MK, dan dosen tersimpan tanpa duplikasi. |  |
| AC-006 | FR-006 | Jika MK dan modul AR tervalidasi tersedia, saat admin menyimpan pemetaan, relasi MK–dosen–AR tampil pada detail MK. |  |
| AC-007 | FR-007 | Jika data aktivitas tersedia, saat admin mengekspor laporan periode tertentu, berkas CSV/PDF terunduh dan sesuai filter. |  |
| AC-008 | FR-008 | Jika dosen mengunggah PDF 10 MB, saat dosen mengaktifkannya, dokumen menjadi basis pengetahuan dan teksnya terekstraksi. |  |
| AC-009 | FR-009 | Jika pembatasan topik aktif, saat mahasiswa bertanya di luar materi, asisten menolak dengan sopan tanpa mengarang jawaban. |  |
| AC-010 | FR-010 | Jika kode kelas aktif, saat dosen mengganti kode, kode lama tidak berlaku bagi pendaftar baru dan mahasiswa lama tetap terdaftar. |  |
| AC-011 | FR-011 | Jika modul AR tervalidasi, saat dosen menautkannya ke MK, modul tampil pada ruang belajar mahasiswa kelas tersebut. |  |
| AC-012 | FR-012 | Jika kelas memiliki aktivitas, saat dosen membuka dashboard, partisipasi dan topik populer tampil sesuai periode. |  |
| AC-013 | FR-013 | Jika terdapat jawaban dengan umpan balik negatif, saat dosen menyimpan koreksi, koreksi menjadi acuan jawaban berikutnya. |  |
| AC-014 | FR-014 | Jika katalog memiliki mata kuliah ditampilkan dan arsip, saat mahasiswa mencari kata kunci, hanya mata kuliah ditampilkan yang muncul. |  |
| AC-015 | FR-015 | Jika mahasiswa memiliki kode valid, saat bergabung ke kelas, kelas terhubung dan tampil pada beranda tanpa duplikasi. |  |
| AC-016 | FR-016 | Jika Tutor AI aktif dengan dokumen aktif, saat mahasiswa bertanya, jawaban memuat sitasi dokumen/halaman. |  |
| AC-017 | FR-017 | Jika mahasiswa memiliki riwayat, saat menandai penanda dan menambah catatan, keduanya tersimpan dan dapat dibuka kembali. |  |
| AC-018 | FR-018 | Jika jawaban asisten tampil, saat mahasiswa menekan jempol ke bawah, umpan balik masuk ke daftar koreksi dosen. |  |
| AC-019 | FR-019 | Jika perangkat mendukung Web-AR, saat mahasiswa memilih Mode Pandu, modul termuat dengan panduan langkah demi langkah. |  |
| AC-020 | FR-020 | Jika mahasiswa menyelesaikan Mode Latihan, saat sesi berakhir, skor 0–100 dan daftar kesalahan ditampilkan. |  |
| AC-021 | FR-021 | Jika mahasiswa memiliki kelas terdaftar, saat membuka dashboard, kelas dan statistik pribadi tampil. |  |
| AC-022 | FR-022 | Jika mahasiswa tidak aktif 14 hari, saat sistem memeriksa aktivitas, satu notifikasi pengingat dikirim. |  |
| AC-023 | FR-023 | Jika jawaban tidak ditemukan dalam materi, saat mahasiswa bertanya, Tutor AI menyatakan bahwa jawaban belum tersedia dan tidak mengarang jawaban. |  |
| AC-024 | FR-024 | Setelah dosen menjalankan 10 pertanyaan uji, sistem menampilkan tingkat akurasi dan daftar pertanyaan yang gagal dijawab dengan benar. |  |
| AC-025 | FR-025 | Jika perangkat mendukung mode avatar, saat mahasiswa menggunakannya, jawaban diucapkan dan avatar bergerak sesuai keadaan. |  |
| AC-026 | FR-026 | Saat dosen mengunggah PDF dan pemrosesan berjalan, sistem menampilkan perkembangan proses hingga selesai atau gagal. |  |
| AC-027 | FR-027 | Jika mahasiswa dengan jenjang S2 bertanya, jawaban mengikuti panduan penjelasan untuk jenjang S2. |  |

# **10\. Lampiran**

## **10.1 Matriks Keterlacakan (Traceability Matrix)**

| Kebutuhan Bisnis | ID Fitur | ID Kriteria Penerimaan | ID Test Case |
| :---- | :---- | :---- | :---- |
| BN-01 Katalog terpusat lintas prodi | FR-001, FR-002, FR-014 | AC-001, AC-002, AC-014 | TC-001 |
| BN-02 Akses terkontrol per mata kuliah | FR-010, FR-015 | AC-010, AC-015 | TC-002 |
| BN-03 Pendampingan belajar 24 jam | FR-008, FR-009, FR-016, FR-017 | AC-008, AC-009, AC-016, AC-017 | TC-003 |
| BN-04 Latihan praktikum via AR | FR-011, FR-019, FR-020 | AC-011, AC-019, AC-020 | TC-004 |
| BN-05 Kualitas jawaban terjaga | FR-013, FR-018 | AC-013, AC-018 | TC-005 |
| BN-06 Pemantauan pemanfaatan | FR-007, FR-012, FR-021 | AC-007, AC-012, AC-021 | TC-006 |
| BN-07 Tata kelola pengguna dan data akademik | FR-003, FR-004, FR-005, FR-006 | AC-003, AC-004, AC-005, AC-006 | TC-007 |
| BN-08 Keterlibatan mahasiswa | FR-022 | AC-022 | TC-008 |
| BN-09 Kualitas jawaban terukur | FR-023, FR-024 | AC-023, AC-024 | TC-009 |
| BN-10 Kelanjutan aplikasi Tutor AI sebelumnya | FR-026, FR-027 | AC-026, AC-027 | TC-010 |
| BN-11 Avatar sebagai tutor bersuara | FR-025 | AC-025 | TC-011 |

## **10.2 Daftar Pertanyaan Terbuka (Open Issues)**

| ID | Pertanyaan / Isu | Penanggung Jawab | Target Selesai | Status |
| :---- | :---- | :---- | :---- | :---- |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

## **10.3 Glosarium Tambahan**

| Istilah | Definisi |
| :---- | :---- |
| Enrollment | Pendaftaran akun mahasiswa pada suatu kelas atau mata kuliah. |
| Guardrails | Aturan yang membatasi jawaban Tutor AI pada materi yang ditentukan. |
| Grounding | Cara menyusun jawaban berdasarkan materi yang tersedia. |
| KPI | Key Performance Indicator — indikator utama kinerja. |
| Perangkat lunak Web-AR | Perangkat lunak untuk menjalankan AR melalui peramban tanpa memasang aplikasi terpisah. |
| Staged Rollout | Peluncuran bertahap per program studi atau mata kuliah. |

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAloAAAC/CAYAAAAmTXLyAAAs40lEQVR4Xu2dB3gUVduG+bB/fogKUqVDIAUILYTeQXrvEKRIF2kCIiJFOtIFpHeRIlV6Dy10SKRI7yCGXlSE98/7+p9xdmaBbLKT3QnPfV2P58yZszOzswl7e+bMJAEBAAAAAABLSGBsAAAAAAAA7gGiBQAAAABgERAtAAAAAACLgGgBAAAAAFgERAsAAAAAwCIgWgCAF5ImTRpKkODffy70deOyqnOZNGlSeu+9957ZP126dFStWjWpZ8+enf7zn//IukmTJmn97t+/7/AaLlOmTCnl8uXLpW348OFSrly5UtqDg4OpV69e0sav5+NQx8P7Uds5d+6c1O/duyfLb731lsN+FL1793bYxuzZsx3Wc33t2rWyjt8Dl61bt6atW7fKOm5LliyZ9F2zZo20JUmSREo+Zj1TpkxxODb9fgAA9gO/wQCAF8Jf9q+//jpt2LBBWzauN9b1bSxGenhds2bNRLSY8PBwrf/Tp08dtpEoUSKtzlStWlXKs2fPUuPGjaX+PNFS6I/n5s2bVLlyZSpcuLAs9+zZU9tuvXr1TP0Vzt6nsZ4iRQqH9hs3bkidz9/MmTM10WLq169Pn3zyidafee211xyOzdlxAADsA36DAQDPJSwsTL7sR4wYoQmT8cvfmXRwydLxwQcf0DvvvKOtV+s4T548keVOnTpRuXLlHNY/fvxYyuTJk9Pp06cdtsvx9fUVYWJcFa3y5cvT33//rbU9evRI6jzy1L17d1N/hbP3aawbRUvRo0cPKl68uCZa/L54f3wcenid/ticHQcAwD7gNxgA8FyU2KioNmMfY91Zm3GZy9u3b9ORI0e0NuOIlipVfdy4cVLq17PEMNOnTxexe5Foqe1xeJTpq6++0rbr5+dHU6dONR0zY9zGw4cPTe1G0YqMjJT6G2+8YRrR4kuVq1at0vpXrFjR4djUNgAA9gW/wQCA56L/oue5WqqNhUKlWLFizxUEoyyo5cWLF2t1HqFKmDChLE+YMMGh35YtWxy2q+aM8aU31fbqq69KeeDAARGtt99+Wzs+/bZmzZpFb775ptR5PhTX7969K+v5MqWz41fo21jOeJlTu3ZtrV0vWps2bZL1/L543hajFy2epzVjxgytP7ffuXNH6nxsau4YAMC+4DcYAAAAAMAiIFoAAAAAABYB0QIAAAAAsAiIFgAAAACARUC0AAAAAAAsAqIFAAAAAGAREC0AAAAAAIuAaAEAAAAAWARECwAAAADAIiBaAAAAAAAWAdECAAAAALAIiBYAAAAAgEVAtAAAAAAALAKiBQAAAABgERAtAACwiDuR9xFDHt3/w3iaYszdB3/S77cfIS7kydOnxtMYY249uIEY4gyIFgAAWMTKSVvo/C9XEV3Wz9lhPE0xZtSCg/Trtb8RFxJ555HxNMaYObvH0C/XIhBdnAHRAgAAi4BomQPR8mwgWtbGGRAtAACwCIiWORAtzwaiZW2cAdECAACLgGiZA9HybCBa1sYZEC0AALAIiJY5EC3PBqJlbZwB0QIAAIuAaJkD0fJsIFrWxhkQLQAAsAiIljkQLc8GomVtnAHRAgAAi4BomQPR8mwgWtbGGRAtAACwCHeKVs2qtaUc3He4aZ07MrTft6Y2K+LNolW7YXNTm7P8cvEh7f810tTuLIfP3jW1eTLeIFpJkyWV8r3333NoHz9nvKmvSsTVcFNbbLNm92pTG+fIpcOmtujGGRAtAACwCHeK1o8zfqICQYWkHpyvoJSbV26X8qe5y6lTu64O/SuXryrlsX2ntbaZE+fSuOETKVWKVOTr40eFCxSls+GX6fj+M+SXzZ+SvJ+EalWto/VdvXgD5QwINB1LbOLtohVx4QEdvfiIUqdJT3UataDGzdvT8St/Ubfeg+mVV1+l3EEFaeyUBZpo+QbklHJ1aDhVq92IDp+5I8trtkdI2bxtF/q45We0MexX2nv8N2lLnzELjZu6kIaNm0kDR07W9t+0dScqWLSU7E8JWoWoz8N4nLGJN4jWuJljafWuVVS5ViWau2KO1l6mYmn6btY4qa8IXU4T502g9p+3o68Gf0U7jm0XMdt1YiftPL5D+qTLmI5GTx1Fg8cNpv4j+2vb2bB/PSVMmJAOXjigCVre4Lz0yisJKfSXUJq7cq60129aX/bB63m5TZc29Oprr8py+OUjpuOOTpwB0QIAAItwp2jlCcwnZd2aDSjNh2np8M5jmmg1iPqCr1apBs2YMEfrX7xwCSlZtE4fviCZOGoK5c31z3aO7jlJ5ctUpH1bD9OhHUcpwC87pUieglKlTK315X7VK9c0HUts4u2i9cOyrVL/X6J3aHyU3H7Zf4Qst+30pYhW3uDCDqI1Y8FaEbMTVx+LhCnRWrhqp5QsWr0HjqbJc1fIcvKo8/vz1iNSX7nlMLVo21XbP++jXNTnuOPIJdpz7Lq0FS1ZznScsYk3iNbKHSupUIlCIlqfdv9Ua+cRLR5lOnzxkIjPqCkjaeCYATRs4jARrey5skv7lsObo85jMlq2dam8bumWJdSsbVOHfaTNkFZKJUylypeibAHZtPXc3rB5Q5o8f5LW1qN/D/LP6e/wOlfjDIgWAABYhDtFK6ZhiTK2eTKxFa3IyEit7m7RelEqVqtrantRGjVrZ2rzZLxBtOJznAHRAgAAi/AG0fK2xFa0EiRIQMmSJaObN2/GuWjFh8RGtCIiIuT8BwYGyjJEyxxnQLQAAMAi4kK0mjRoRuG7T5jaVc6EXzK1eTKft/yShgwZEuPwFz0nTZo0XiFa+078bmqLSSbNWW5q4wTkzGNqi02+7jvAdE6jm86dO2vnP23atB4TLb7kaGzjy4J8qVFdTlRp2vZjU9/nJaRlY1ObK3EGRAsAACzCStEa1GcY5cqRW0SrasUaNKD3EMqXO4gK5i+sreN+SrSC8uSnMUO/o0Z1Q7RtVCxXmcqUKCfzs85FXJF5YMMHjKI1P20gn8xZZX5X1QrVTfuOTWI7opU0aVI6efKk1GMqWvOWbaFP2n1O4efvk082fxr1/TwKjDo/+mUWnKACRbXXlK9cizJl8ZUJ7Vxu2X9GXlO5Rn3qO+Q7qlClNuXKGyx9c0Z9Dtxv1qL1MldLv87HN4A+qlST/LIHStT2WbT0/WpHfa7zV4TKcWTMnE3a+g0dTw0/buPQj0vuZ3yPz0psR7QyZcqkLcdWtHjeFM/LyuqflYKLBMsk+SzZskSdoyy0+8QuqQ//frjIUmDenNrr8hfOT5l8Msl8LdVHL1o8gV715ddmyJyBuvTuou3ri2++MO3Lx8+HuvftBtECAAA74U7RavdJB5msvn1tmCyzQIXU/1hEa9uaXdJWrnR5GjV4nLaO7yhUojVn8nzK5uPrIFoRu09QuVIfSX3e1AVSli35EWXNkk3q+jsW3ZXYipae6IpWiTIVKSBKPCfMXKK1pUmXkabNXy13/vGdgyw0xuUBIyZp/Vt92l1KngzP5cFTt6TPhqhzyMu8fTXJndO110AqWbaSCJp+Xcv2UV/mLT7V7lZUk+ZZtPT9eCI+T4Q3ipazfbkyYT42omUktqLFwqR/pEPu/LkpUeJEUs8VlEvuJmSBMo5KcT8u23Ztq/XRi1bK1Cm1vuq1B87v1/ZVtlJZ0764DGkVAtECAAA74U7R4ujvAGzTvL085oFFi4Wof69BMiLVtUMPbR33U6LFj3To3qknbVyxTUawuM0oWjwKNmHkZFq3dLM2omU8htjGE6LF4TsFVX3MlB+pVv2mtGnPSSpSoixljTofLDTGZb1olalQjTL7+Mndhtn8c9D6XcelD99l+PXgsRRcuIRI1OgooeX+LFp89yCPkunX8Z2JXHcmWvp+etHi482S1U9Eq0bdJqZ92VG0eGQpR+4cJtFKkSqF3PnHj3DgOxN5pMkoWvyoBn4911UfvWjtORVGGw9skPX8Wh614rsbjaKl3xe/HiNaAABgM9wtWvEhnhKt2EaNJrkSvgxpbHM1X/QdbmqLTbxFtJ4V9VgGd4QfFTFz6QxTu4o796XiDIgWAABYBETLHLuKVnyJt4uW3eMMiBYAAFgERMsciJZnA9GyNs6AaAEAgEVAtMyBaHk2EC1r4wyIFgAAWAREyxyIlmcD0bI2zoBoAQCARUC0zIFoeTYQLWvjDIgWAABYBETLHIiWZwPRsjbOgGgBAIBFQLTMgWh5NhAta+MMiBYAAFgERMsciJZnA9GyNs6AaAEAgEXM7LeUVk7egujiTtEavfAQTVh2FHEh7hStkeu7i2x5Ot8u+srU5qk4A6IFAADxnGPHjhmbAIg3vPbaa8YmrwKiBQAA8ZyUKVNSjx49jM0A2B7+n4gECRJ49c83RAsAAOIxHTt2pKRJk0oePHhgXA2ArXn33XdlRMubf74hWgAAAACwLTxi681AtAAAAABgWyBaAAAQTS4fGGZsAgCA5wLRAgCAF3BmWyeiu/u03D41k+5c3WXsBgAAJiBaAADwDK6ET6DHNzY5SJY+14/NMr4EAAAcgGgBAIATbp6YahIrZ/n96Hh6cPO48eUAACBAtAAAQMeNkwvo4aXlJqF6Uc7u6GbcFAAAQLQAAIB5dOcs/RYx1iRQruTvyFD66+F146YBAC8xthKt6TuGmf5A4sueKdsH60+RSyz5boPpD6q+7Fk0eq3xNLnEsbCzpm0i/+bgZu+7xPbg5jG6cWyiSZpik6e3w+jivkHGXQEAXkIgWjYPRMu9gWhZG28TrbM7e5gkyZ25e3Ye3bq4wbhbAMBLBETL5oFouTcQLWvjLaJ1+dBo+jtyu0mMrMrViO+NhwAAeEmAaNk8EC33BqJlbbxBtE5v+8wkQnGRyOOT6f6NQ8bDAQDEcyBaNg9Ey72BaFkbT4nWrQsb6e7ZH03y46ncubrTeIgAgHgKRMvmgWi5NxAta+MJ0ZLLdk5kx9O5uLcvPX3yp/FwAQDxDIiWzQPRcm8gWtYmLkXr3m8Hov3QUU/mfNjXxkMHAMQjIFo2D0TLvYFoWZu4Eq0LYb1NQuPNuXdhkfEtAADiCRAtJ0mQIIHD8r4ze019VEZNGWlqi8t4s2hV+qiKVs/hn5OyZsnmsGzsP3HUFFObs3zauqOpzV3xJtEqWay0qa1UsTJanc9n85BPpF6hbCVT35imZdM2prZ8uYNMbTGJ1aLFDx19emePSWSMyZolHfXo/LGp/Xnp2qGxqc2YSh8VMbVFN/ywU74bEgAQv4Bo6fLFN19Q3+F9KHnK5NRzwBdaO9ebtG5CBy8coPArR2j/2X00c+kMqv9xPRGtoEJBNHvZLBozfTSFXz5CBYsVoO1HQ2lF6HKqUruyaT/ujDeKVrlSH9GPMxZLfeOKbVSjSi1NtEoULSXtvHz68AX6MHWaqC+8L6VNL1oFggrRotnLKH3aDPTrgXM0f/oi6tz+c/pp7vKXQrQyZchMw74ZScf2naZdG/ZRwoQJ6eTB85poBfhlN4lWYPZc2usrl6+qyeyA3kOk7PX51zRt/Cyp+2Xzl5LPbZMGzaSeNMkHdDb8sogWb5e3x3Vu83bROrc7ZiNYT27voaN7F1LjehWob89WNH5ED/rjxk76K3I3Pbi+nerWLKv1ZdHi9vRpU1HO7D40qE/7qJ/RobRj/TRZH5THX0Rr1eIxsqy2u3LhKLp54dl/mNpZfguHcAEQX4Bo6ZInOI+ERat1p6h/dGd/J+08otVvRD/aemQLLVy/gHb/upsWb1hEH6b7UERrz6kwKlGuhPTt2PMzqlC9gtSbt29OjVo0NO3HnfFG0apTvR5lzphF6m2at6emjVpoosVf5tzOy1/36Ec5AwJluX+vQQ6idXTPSSpTohyF1P9YllnKdm86QCMHjX0pRCtVilRyjli0eJmFk0slWkneT2oSrY8bNv/39SlTa6KlRPZAaIS2XonWnMnzKZuPr9Tz5sonJctVdv8c0keNbnmzaN2/sNgkKtHJhaM/S9m9UxPq0LoeXTy2inLlzEpXT66lUUO60O1LW0SSVH8WLW7Pl9tP2gsXCKRCwTlp7dJxNHtyPwrM4SOixfL2+GaYtl39NlyJPOz0Ah52CoDdgWjpsnrXKlq2damI1oS546lY6aK0NmyNJlo8mlW1TlWq37Q+pfowFdWoX11Eq3DJwjKKxdt47/33aNH6hVLPFZRLZMu4H3fGG0WLpUiNovCXN8uWEq2tq3dSrhy5KX/eYBm1qlqhOm1YvpX8fQMcRKt44RJUpGAxGj9iEmXMkEnaWAg2r9wuosUjYcb9uiPeIFo8Cqjqh7b/IqVetPj8rV+2xSRaXIbUbyryyqNgetFikeWRRn6t2vaEkZNF6Lp36inL08fPptyBeUWuCuYvTL4+fl4tWpcPjqS/b8bsoaP+vhm1S4csSyxF2f0zU7VKxUWUShTNS+1a1jGJFrfXr1VOlscN70Y9uzajM+HLo85tAcoRkEVEK3/eAIftxlS0VK4cGESP/7xjfPsAAJsA0bJ5XBWtevXqUadOnaRulWjFRfhSorHNHYmJaKnzybhDtOJzXBWtY8eOUY4cORza7lzZTrdPzzIJiZU5dXhp1P8kTDK1x2XObu/mcB68iUyZMkm5bt06wxoAAETLEJ5jxWVMJrkv2fSTqc3qDJjflYYMGRLtBAUFyWT/V155JcaipUZX9HE2gdpZnE2CV+F5Sca2NUs2mtr00e+XR2SM613N2F7TTOfsRVHns1GjRi6L1tB+35ra3B0eudIvq8uRMQ1vT83rUpcloxsWLeP5e146d+4s55eTNm1aunpouElA3JH710LlUuCKBSNN65wlImyBqU0fdVnR2B7bXNo3gIoWLfrc9O7dO87DhISESNmmTRspjX1eFADiK/FetMbPGU9Z/bNScJFgGjdzLP20cTFlzpqZDl08KJf2eg/pTaER2yggMED6s2i17dqWRkwaIZcM06RPQ+Uql6N2UW28vliZYuTjm0WkatjEYbJt3kdg3pzk4+dDc5bPlvV7T+8h3+y+EnUs3fp8LuvKViory/45/aWs2aCGQz9X4uqIVvXq1alx48ZSj41ozZu6gI7uPSXidOrQBRGerh16yPK+rYfl8tXx/We012xbs0vm/fB61Y/FiC8tqsuM6dKkl0uIB7f/Incs8mUsvny1eM5yuWzIl8d4vldwvoLadnm/PB+sfcvPZHv7tx2Rdr7EaDzu6CQmI1rqfDKuihbfKKAujfKcqLVLNtGgPsO0S3wLZy11kFPuz+eR69xes2ptKl+mojbPqnCBolSlQjUaO2wC+Wb9Zx4Wz+fiS398OZCX+Vwd2XWcOrXrqm2X1/O+eZu878M7j0m7+hxUP/7MeXssWnVq1Kfe3fs5vJ8XxdURrYiICG20RBF5bjXdP7/QJCExTcH8Oah9qzoiR6lTJaM7l7dGnc/0sq5U8aCon8uUUi6bP0LaeJ6WXrR8s2aQS4h8iVDJ1eUTq2XelnFfscmpLZ86nAdvo0WLFlI2bNiQFixYYFgLwMvLSyFaqp47f2568603qVT5UlS0VFFpS5shLWXyyaT1YdEa/v1wGdHSP9YhQ+YMUrJocZn43cSUIlUK2ZbaB8/j4nL0tNE0dsYYSpk6pSz/sGoerdm9WlvHr+N6SKsQmVj/zaj+2npX46po6YmpaKVMnlK+3HlkhOf98J2ELDwsOS1CWtLSeSupY9suDq95/733peQvctVPjUCpEbLE7ySWkuWL523xl7wa8Zk0eprMJ+K5WSx5aru83xEDx9Drr7/uMdHS46poqYn9c6f8KHcF8pyr0sXL0ugh30l7r259qM8X/bX+syb9QGfCL1F42Ak59yxILFtq/d4th0S0+Fzx+p5dvpJ5XXwXqJK3Hev2yL70osXred/GCfTqc+B6hnQZpeTtsWiFbTro8F6iE1dF63mcD+trkpGY5N7VbbQ/dI6IVqO6/9wlyHO1hvbvQJ+2qkuHdsyTfryeSyVa7yZOJMszv+9Lb7zxumkuFk+SN+4rJrl+ZBT9ce+S8e0DAGzCSydaHK736N9DShYtnuCu+rBo8WteJFo8AsZtRy4ddhCtwxcPUcTVcHl9toBs0s6ixWKm1vFIGj8Ogu9i3HFsu0iZnUSLxYjFgOssVXz3IAsPyxePZil5aFC7kXaZSj0Tir/IVT+jaL3937el5Nf3+3IAzZgwR0SLJ9efi7giAtaobojIhDoWdenwf/9LJNv7JexXGY2xi2jxYxp4BC989wlZZoHhxyrw++X3WSi4iLSPGTZeysb1msidglznc89ypCbEc1g6WbT4MuzpIxdpzU8bRITXLd1MrZq1lT78mbBoVatUQ84xt/F63rdRtNTnoD9m3p43iBbz9MljenR1lUlOXMm8aQNoQO+2mmjxoxh+P7dRBKtj2wYOonXy0BKZ7K5GtELXTpHynURvm0QrtnlwcQn9fmqJ8S0DAGxGvBet6GTYhKGmtmdFiZar4VErY5s74gnRciX8RW1ssyrRfeDp8xLXouVqXiSQPKeNR8GM7d4Sd4uW4vS2TiZRsXMij082vkUAgE2BaNk83i5adou3i5bdY5VoKe7fOGKSFjvlwp5vjG8JAGBzIFo2D0TLvYFoWRurRYv5+697dHnfAJPEeHMeXfmZr4Ma3woAIB4A0bJ5IFruDUTL2sSFaCn4ye53Ts81SY235UxoZ+OhAwDiERAtmwei5d5AtKxNXIqW4tL+oSa58YZcOTiUHj+KNB4uACCeAdGyeSBa7g1Ey9p4QrQUVw6Ppb8jt5mEJ67DDx0FALw8QLRsHoiWewPRsjaeFC3F2R1dTfITF7lzZi7dvrzVeDgAgHgORMvmgWi5NxAta+MNosVc2NvfJEJW5tKB4cZDAAC8JEC0bB6IlnsD0bI23iJawtMndCGst0mK3Bk8dBQAANGyeSBa7g1Ey9p4lWj9P3ev7aFbv043SVJsc27nl8ZdAQBeQmwlWgAAYBX3fw+nyGOTTMLkah7eOmnctGVkyZKFgoODaerUqcZVQseOHY1NAIA4JHXq1PTGG29QunTp6O7du8bVXgFECwAQp1z7ZQr9eX29SaBelAthfeL8oaOLFi2ScsaMGXT58mUqUqSILBctWpS2b98uorVv3z79SwAAcUj58uUpQYIElDx5cuMqrwGiBQDwCNF92OmtkzPo3vW9xpfHCXrRKl26tNQfPXpETZs2pXr16lHSpEn13QEAHoBF69q1a8ZmrwGiBQDwGJf2D6Ont3eZ5ErlypHvjC+JU/SidenSJSpQoADdv3+fqlSpQj4+PjKiFRISovX/89Ytenj9OuJCnj6J21FK4D7+unvWK5I9IJupzVNxBkQLAOBxzu/q5SBY984voJvnY3fjhCfY81VP+uPAPsSFPPrtN+NpBDbhytrqUf/Z5/FU+6i4qc1jcQJECwDgNcif87ExEC3XA9GyLxAtJ3ECRAsAANwERMv1QLTsC0TLSZwA0QIAADcB0XI9EC37AtFyEidAtAAAwE1AtFwPRMu+QLScxAkQLQAAcBMQLdcD0bIvEC0ncQJECwAA3AREy/VAtOwLRMtJnADRAgAANxET0fqkVk1T27Nyb89uU1tMkzV9elMb5/7eMLq+bQvVr1DBob1TSGNTX3cEomVfIFpO4gSIFgAAuInYiNanDRpQvgB/TWjKFixIAz/rQK++8go92LeHVn43jlZPHC/r9syfRxfWr6NGlStRg4oVaMnoUXRr1w5KkyKFrP/ff/8rZbdmTSlTmjR0e/dO6XM3bBe9nzgxbZk+TevzWaOGVLVECTq3bo3s+2HUvgoGBopolcwfJMs3d26nVMmS0ZXNGzVBG/dlT1mfLlUq0/5dCUTLvrhLtDp+0kDK1197zbQuOnmWaOXN6WdqszxOgGgBAICbiI1o5fb1pZxZfTTRGtWjG33RojkFZc8uyz2aN9NE68DCBbR1xjQqlCsXtatfT0SH21mquHw3USIpCwTmpFZ1aktd9alRupRI2vuJ35HlInly09whg6Wu9q1Ei6Vq17w5MsKl1ulFi+t5/f1M+3clEC374k7RenwhjIJy+dNnLepLW9Hg3HRowzy6dngdNalTSdr2rZlNF/b9TIXy5dRey69h0dqzahZ1bdNY2ob26iAl/2meVo1r0LzxA2T50dmd1L5pHQr095G+90+F0sH18yhfoBuFzAkQLQAAcBMxEa0XpU65sqa2FyUmwuOpQLTsiztFi8uk779LPTs0k7oapSqQJwelTZ2C/jq/W0Tr8sHVVCR/Lu21NyI2UPmShWjXiunadoZ99ZmULFqfNKxOM0b1oZvHNoloZcucngoHBUpfFi3u16hmBdMxxThOgGgBAICbsEK04nsgWvbFXaIV3bBoGds4z7p06JE4AaIFAABuwlXR+i10Kx1dvpQGd+poWseX64xtxvw0eqSp7XmJ3BGqXX40hi//8SVDY7sx59evNbXx6/hS5i/LlpjWvSgQLfsS16L1rEC0AADgJcFV0Tq1+mfq176diFZwzhzSVrl4MSqWL6+Iln4+VLYMGSjjhx9SQObM2ut5gvqsQQMph4+PLLesXYs2T5tCRfPmkeU8fn7UsFJFmcxevVRJTbRqlSlDswcP1LbjmzGjTKxXosX98ufIQTXLlKZerVqKQPH8sX0L5kufzk1CZG4W9/XPnEnaePL+123bmN7jiwLRsi9WiFbm9GlMbcaM6tfFYblCqUJaPToT4If37mhqc1ucANECAAAXiIiIcAjPA+EERsmGq6Kloka01k36ni5tXC91o2ix6Kj+fBcilzxhXU1250c/qAnrlYoV1R4FwY9r4LsKua5ES02857a9P/6g7UMvWmpffAw8KZ9Hz/jOyJ1zZ2uT5x/t3ytldEbCnpX9oaGmc4rYI5snlaKIzQtinRF9Omt1no/F86g2LBhP+9fOpeUzRkjblsWTZHnaiN7UvV0TmczeqWVD+qpjCypZKJ8mOixaR7cupMa1KsjEep67xfO4/ji3U+Z5pU+TSkTr+pF19Fv4epo9th9Njdom/w7z649tW2SWJ1fiBIgWAADEAv4HOkmSJDRr1qxYiVa+gACpVylRXOosWvOGDiG/TBmfKVrDunYW6fFJn06WWbR49KpUcH5Z5jsWeSSL26qV/HdEq3i+fJQ9SxZtezxKxo95eJZoLR0zmsoXKSwjaCxpXT9uIiNsqk9sRAsjWvbFXSNafHehqqdMnlTuClw4aYgsTx7eS6Rq44IJssyyxJPXyxUvIMu5ArLS779s1F7PosUi1qF5PbpzYivVqVKGurUNoauH1spIGN9hqEa0Ni/6nqqXLyGyxfvktt0rZ5iOz6U4AaIFAACxYMKECVo9pqL1MgeiZV/cJVr6qEuHLFpKftRjG7JmSiclCxOPVIVv+lHmZxlFix//wLLFy7UqlaKCeXPQk0t7qEShvFS/WjkRrey+mWU9r/ume1uIFgAA2AGIluuBaNkXK0QrtuHLkMa2OI0TIFoAAOAmPCFarvxpHH5YqbFNH/Xg0bgMRMu+eKNoeTxOgGgBAICbsEq07uzeKZPb+c/d8MNI9cvqT+NwP/WneaZ/04++/7q3zLUK+2Gedocgixb/mR+13cK5c0u5ffYs7c/08LyvmQMHSPvVLZuk5DlkPBlezd06/NMi0zHGNBAt+wLRchInQLQAAMBNuFO0KhQpQrXL/vNUeH521fCuXUSYeATLuKxeo/40D99lyLKlxEj9gWgWrbb16mr9b4Ruk/Lbz7tKyaL1688rNMHiOxr5bx2qOyHV9kJnzTAdb0wD0bIvEC0ncQJECwAA3IQ7RUsflh1+tlbdj8ppf/hZv6zvW65QQXkmV592baPE60dp04sWl63r1JFnb+kfMMp3HrJo8fOwSgQFSZt6Hpe6ExKiBfRAtJzECRAtAABwE1aJVnwORMu+QLScxAkQLQAAcBMQLdcD0bIvEC0ncQJECwAA3AREy/VAtOwLRMtJnADRAgAANwHRcj0QLfsC0XISJ0C0AADATUC0XA9Ey76c+iGdyBbyb5wB0QIAADcB0XI9EC0Q34FoAQCAm4BouR6IFojvQLQAAMBNQLRcD0QLxHcgWgAA4CZ+nTOL9nzdC3Ehf96+bTyNAMQrIFoAAAAAABYB0QIAAAAAsAiIFgAAAACARUC0AAAAAAAsAqIFAAAAAGAREC0AAAAAAIuAaAEAAAAAWARECwAAAADAIiBaAAAAAAAWAdECAAAAALAIiBYAAAAAgEVAtAAAAAAALAKiBQAAAABgERAtAAAAAACLgGgBAAAAAFgERAsAAAAAwCIgWgAAAAAAFgHRAgAAAACwCIgWAAAAAIBFQLQAAAAAACwCogUAAAAAYBEQLQAAAAAAi4BoAQAAAABYBEQLAAAAAMAiIFoAAAAAABYB0QIAAAAAsAiIFgAAAACARUC0AAAAAAAsAqIFAAAAAGARLonWH/cuIAjiofz54JrxVxIAAICX45poXVtDdHcfgiAeyNWDA+nm2RXGX0sAAABeDEQLQWwSFi2pAwAAsA0QLQSxSZRo3TwxzfirCQAAwEuBaCGITaKNaP1/InEZEQAAvB6IFoLYJEbR4kSeXWn8NQUAAOBFQLQQxCZ5eGlZlGwNMuXh7ePGX1UAAABeAkQLQWyeP+5dNP6qAgAA8BIgWghi80C0AADAe4FoIYjNA9ECAADvBaKFIDYPRAsAALyXGIlWwfw5pNy3bbbpH31Xc+rwUin/itxtWqdy+9IWU5sxwwd0NLVFNw+ub6c/f99lej+VPipi6mvMrYubacq4r0ztap2xjfe1P3SOvKfAHD6m9ZyuHRqb2p4X/XGvXDjKYd2hHfNM/fPm8nvucRtTrVJxU1t0w+9X1bP5pDetd3dqVStlajNm1JAupjY+h+rn7FnnUP2sqvB5NG7neVmxYKSpjRPdz+FZgWgBAID34rJo/TDt31vM+cupeJE8UucvJ/6iKl0iiJ7c3iNfsA+v76C0H6aQZe6ze9MMKSeO6imS8fTOXu3La8Py8dSxbQMKyuOvCU6BoH+Ejr/QmjSoJPVVi8fQ/OkDaUDvtpQjIIu2PxYtlrUPkr5HY4Z9Ln3vXwulg9vnUb7c/3wh5szuQ4P6tKcd66fRp63qavtjsVk0e6i8n8c3w2j5jyOkvzqOqyfXipgULhCovc9Hv+2k9q3qUIBfJvmiVPvs1jGEShTNS6Frp8g6da44vPzWW29InbfF52D25H409bveWh/e7ruJEzlsT+1LnQN+X3qB4uPmc30mfDkVK5yb/rixU84FfwZbVk2SY+F+FcoWkpLPpzruzBnTyPY3rZwobUneTyznR22bpYRFq2rFYg7bTZkiKd28sMnh/ek/+749W8l2enVrrp0PFq0l84bLNlKl/EDO+8+LRmuvf+WVhJQwYULZD/9s8GfKcqKEZsLIL+inucPo4rFVpvPG4c+SRYtL/fkzCtHIwZ1l23wsV35dI58nn0P+TIznMH3aVNo51IsW70Ntd/LYXlLyedKfO97P55+FOOxb/3OsfjaVaP1965/fE1cD0QIAAO/FZdEqX6ag/ON+dO9C2rNlFmVIl4oiz2/SRgFqVi0pYvL7uY2yzF/k/KXJdf5S5XrWLOnkS43b9KI1dng3+bJXgqMEib/QWNj4i4+FqFBwTvlCvXtlm7Y//uJkSUqdKhmVKh4kr2Mh4bJR3QpScv/G9SqQb9YMsqz2pxct/rLjY+H16jhYKPj98PGo98lywuKghEXtk4WodfOa8gXO6/iYuF2Fl1lelGiF7/7R4cuYR9aSJnnXYXtqX+ocqPelwp8D9zl/dCWVLRmsiRUfMwtZmg+Ty3LFcoWl1IsWb5ePifuxePJ5vXZqnfQ7eWgJ5c8bIALx5efNHLbLfdX+1Wik/rOfMbEPtWxaQ0RLnQ+fzGlp3bLv5GeABYbPu15e+HzwzwvX+XMY0q8DLf3hW01oBvf9VD4/rhvPG4ffEx//jbMbHM6fUbT4/PPPEB/LpeOrZF98DvkzMZ7DdxK9rZ1D/bHyvtR2+WePBfPNN1+n/r3aaH1Y4IyjVfqfY17mn02IFgAAxF9cFi3jP/JWxHjJzvhF6e7wl7GxDYl+5k79xtRmVTq1+1fw7BYWR2ObOwLRAgAA78UrRQtBkOgHogUAAN6Ly6LlbKJ2TEec+PLJiEGdHdr4UtZrr73qMHF60pgvTa/VJ0GCBFJ+VPqfy5ocvoSl6s+a3ByTOHv/Knw5iS+pjRvezbTOlajLclzGZiI68nIEogUAAN6Ly6JVvXIJmVTO861y58xG965u00SL577wPBOe16NkpkPrejK5mOuqH8+B4UnKLFoLZw0xfXGoeTo8CZm38/Z/35I5MLxfnrTNsqPms/D+wzbPlLoSrc0/f6/NAfPLllEmIPMcJjW5nrfJE+m5ztvy980o87X4/fBkf94Pr2seUpVy5cxKuzZOl8nPPIlfvX+ev8Rzio7smk/fj+4pl8/0oqXmZvF8sJ5dm8l+eFvqPfJ54RsJ+Nh5Ozz5uk6NMjLRX4nW6SPLRLRaNauh3XRwfP9ikUieL6a/ow95eQPRAgAA78Vl0VIjOkUK5qKtqyc5TFbu92VrKVlWWjSpJnU1IZjlQD3WgO+2ypg+tYiW8c41jl60tq2ZLKNb7Vr+M4+KZUU/qpTof//V9q8f0eKJ7Yd3/iB1FqS1S8dRRNgCWebj4bsPua62xXLEktP2k9qyzBOW+b3xBGg1usbbUf15kjffEcdSxNKX3T+zg2gtnjNU3jPLJ0uRceI3T8yvUqGoTArn5YZ1ylOeQF+RLt7GjzMGSTvv+87lrQ6ixeV333anWZP6adtDXt5AtAAAwHuJsWgN/LqdjLbw6A6LDo8QlStVQEZZsmRKqz0iQYkWj0jxyBILU7o0KalZ4yoOlw71l8iUaKlHPfDdbCwzLCIbV0xwEK150wZIyZKnFy3uyyULUOf2DeW2/e6dmtCCmYNlREtNTDaKFq/nuyK5TYkWj5DxXWy8L9WfR/T4Lj6+y5G3y+JmvHT4+OZuebRB/VrlTKLFx1qmRH4ZLePzxyNaJYvlk/PI2+jyaSPpx+eFz9cXXZrKyBuL1i97Fohwcp0fBaG2ibycgWgBAID34rJoGf+Rj23UZT9vDj9vST1qAkG8LRAtAADwXjwuWgiCxC4QLQAA8F4gWghi80C0AADAe4FoIYjNA9ECAADvBaKFIDYPRAsAALwXiBaC2DwQLQAA8F4gWghi80C0AADAe4FoIYjNA9ECAADvBaKFIDYPRAsAALwXiBaC2DwQLQAA8F4gWghi80C0AADAe3FJtC7uHxiVwQiCeFGe/P3I+KsKAADAS3BJtAAAAAAAQPSBaAEAAAAAWARECwAAAADAIiBaAAAAAAAW8X8Zx3JJPf/4XQAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,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azwJKWj6TG1vm3asD+5aAFAIEC2AiIBokcIG0QJIPYgWQERAtEhhg2gBpB5ECyAiZJJo1ahXw+reUjf2ePTsUfarX/0qbr4Bo/rbHfffEVd+qDzfrKl1H9ItrrwoMuX7yXZtnWviyoO58qor48oyMYgWQOpBtAAiQqaJ1nklzos9fuXdl+34vxwfN18yopVJQbQA4HAgWgARIdNEq96tde3TL/u6x5KR6nWrWdvuH9hlZS6zCldfaa06t3SiddFlF1qlayq58omLJtiIKcOtZNnLrEq1Knbvo43d8994/w27usZVVr5KeXvy5Set82ed85SNnTfGLWfOmtnW4J4GTt5mr57lyoKv6a2jll/xmop2wSUX2C133eLWoWzFsm5az6E97KKSF1mp8qXsvY7vurJzzj/HylYoY2cXP9u9xt0P3eVE66xzz3TL0mt1G9zNenze3R548gH3HPW+tfmkjRMtrVvN62tah97t87zH4LYryiBaAKkH0QKICJkmWhKM+5+432aumGFVa1V14vVep/ecTI377lsnH060DgqNnvPEi487Eeo7oo999nU/VyZ50a2k5Nv5Y938nmj5y4aO/9zq33GTDR47yKpdd62Vq1zOLUNCFHxNbx0lVoPGDLSBowfYpaUvdWUSoWEThlrJK0rahAXjnRydfvbp7vbUM05x8vbsG8+693XhpRc60frzCX9y5V9OHeGWk59oNXqgkT33xnOu3P8eMymIFkDqQbQAIkKmidbX07+yytdWtk59O1rTN5s60Wrd9X2rWLWC1alfx66odIWTpIaNb3PPea3lq/ZuhxY25NvBrqdJ0nPSqSe5aV0HdHG9S+oB8kTLXzZ88hfW8qP3nNjUuam267169vVnnOQEX9NbR4nW9OXTDq7n127dVHbLnTfb4IOvf/JpJ9uNDW+MZcaK6bHerjdbv2HNP2zuXlui5ZUr5198fh7R0vvWOpS4tIRdU/satyyV+99jcNsVZRAtgNSDaAFEhMwTra/thttucIcNv5r2pZMZCcfsVbNszJzRMdHyztHyREvP8Q45nnvBue5WAqXb9j3bxUTLX3bfY/fa+AXj7MxzzrSnXnnKHXLUIT31ZAVf01vHQ4mW16Ol5zV5qomblp9o/fmEP7seL73HMleWsd5f9IrJo+ROoqXDm3pcunxpJ1n+95hJQbQAUg+iBRARMlG0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ooM1fbKRzZ/SN24diyL7N461jfPb2do5bRllPkC2i9bsz/o5uTnjn/90jyUpWw++n++HfW6N6tR2ZfffeKPN6vepXX7++bFlqOdrSJv384iWeqTUE6beqw1jR9ttNWvYTddUtYvOPstJmUSof8v33PM1bfmI4bHlSbTGdO3sZOvNhx9y63NPvbourx0UOK3TIwdF67Li51mrp59yz3nx3saul0uv+8ZDD8aWH1x2NgTRAoCk2bJqtK2c+mrGjeaeSLTUo6Vzsl5t2tgd9pMwqfzeOyVev5ysf8mFZ7tbidaeH385kV2itWHZV3E9WuoVe+W5xtapTVPr0/VNa/HGw25640bXxUTLL1Pqxap85WXu/n8e8wfXWxZcx6KMG2V+TivXK7lv94bgR52TZLto3V23rru96Oyz3e2hREs9WrpVj9Y5p5xi337SNY9oTe3dy144KD/tXmhq3Zu96XqZ9Py76l4XE61BrVu5sqAMSbTef+Zpd9hPvVdlLizhynVIsONLL7rX0jIkceppWzZ8mBMszdPtzTdioqXlB5edDUG0AOCI0WjuK6e+bluXZOZo7olEa8LXnV2P0qDeLfKI1ogBbVyP1g11KjsR0jlcQdHSrQRNVzC++PRdsXO0dq371vVgLZ0z0KpdXcYto369q90J+B+0eMr1cvnXQed56VwuPd8Ts0yLRplfXQSjzNevX99OOOEEd/v0009b27Ztbfny5bHpGzZssAcffND3jF/o37+/9e3bN1icErJdtD7/oI3Vq1LZXYnYs3mzQ4rWFRddZDdcfbVVvryk61VKdI6WzqVSD5YESedPadl6jpZxONHS+Vze+VWSLp17pZ4zHT5c+dUI9/jGqlfbc3ff5ea5udq1B5d9ld15XR0niogWAOQEu7YsttWzWrnR3A/k0Gju6n3S4T5dNdi/x9tx06OYohhlvkqVKrH7r7zyii1evNg6dOhgderUcQIm0Zo7d641atTIPR42bFhMtD7++GPfko6cbdu2WdeuXfOUZaNoJRvvpPgwItGSzAXLcyWIFgAclr071ti67zrb+nltbF+Ojuauw4FPPXJbxh3yCzv/O8r8lOBukXISidbll1/uHvfr18+J1uTJk23FihW2du1aa9iwoROtJ5980urWrRt7bjL06tXLjjrqKDvvvPNiZbkkWjo8FyxLVbq89qo7HBgsz5Ug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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAloAAAHZCAYAAABel5UBAAB3EklEQVR4XuydB7jUxPu2pYp06UjvCogIgopU6YKIFCkiUkWsSFFQpP2kCCgiKPyRolKkC4iAShNQijQBERFBpUgX6U3m83n9JmZzsrB7NtnN7j73db1XkkndzOTMfSbJ5CZFCCGEEEJc4SZrAiGEEEIIcQaKFiGEEEKIS1C0CCGEEEJcgqJFCPEk7733nrrpppskzHTp0sVItwb48ssvVbJkyXzSixYtqv766y+Zj+mSJUuqqlWrJljfvB1rGqJ58+YyL0uWLOq+++7794D+YcSIETL/6tWrftdFVKxYUeXOnVuVLl3aWHfr1q0yr3fv3jKNedb1ELt27TLW0eh54OLFizLerl072/nW7enAfnE+rOkI/XvnzJkjv9k8L3v27D7HZF0XkTJlSmO+dbmJEycaaVeuXEmwLsK8zuzZs41pM8jHb775RsaxXM+ePWX877//TrCd//3vfwn2oZcHOu3jjz/2SRs/fryMV6tWLcH6Y8aMkXnHjx9PMA8xduxYn22bI3Xq1GrlypUJ0nUsXbpU9o1xMw0bNkyQptcxn1eA8oQyZyV//vyyf+I+FC1CiCe5//77jcrj/PnzRroWrY8++kgqoiVLlhjLgdtuu03G33rrLfXFF1+oli1byvQLL7wg8zEOsdi0aZOsj0Ba+vTpjWm9HLal0xDbt2+XeWbRmj59ukqSJImqUaOGTAO9/B133OGz3e+++y4g0cL29ToLFy6U+fjdVsy/W4sWjmXDhg0J5pt/K0JP79mzxxAt8281/97kyZPL/GeeeUYq8scee0ym8+XLJ/P1vszH3KJFC2PfGsiu3r/5fI0bN07SmjVrptatW2fk4R9//CHzMW4nWvrcaDCuxQnHiunXX3/dZ362bNnUq6++KunIC+v6iJw5c/qkadHS83EsECgcJ2QSx6lFq27duj7n8MCBAz7rIm3u3LmqSZMmMv3nn38ayw4ePNhYBnHixImARMvfeQX+RGv06NEJtkvcgWeZEOI5+vfvL5XA4cOHVdasWdWjjz5qzNOiBUHQlC9f3qg0dIWzf/9+Y/6pU6cStGiZQRrkxppWuHBhnzSNFi0tSdbtabCMdbuBiJa1YoQ8tW3b1icN6N8KtGilS5cuwbkwY5emRcuOnTt3yryuXbv6pOP8m/PAuv65c+cSpKFF6O67705wDB06dJDfOHXqVJm+du2a5NmlS5dkGsvaiRbSU6VK5TMN0YIMYhzb0bz//vsJjgcgbdCgQca4Dt1ah3GzaOE4dcul+Ti1aOG32GH9zTrNjP6nwUwgoqXP6/fffy/pI0eONObZlSdNo0aNRO6IuyQsdYQQEmHMldKqVat8KhW7W4doVdAVxunTp1WvXr185qOF4vPPPze2bRUjpFmFyLoPhK58rbfRXnrpJZ91NYkVLet+0XJih54PtGih0setUhyTeb7dOhp/tw7xe4cNGybjX3/9tbG8eRm7NB0LFiww5r/55puStm/fPjVgwAAZ/+WXX4z5Dz74oOSjef0zZ87IPIz7Ey1zS595XQiRmerVq0vropU8efIY+aHX/emnn2Q4f/58GWrRwm0+HKd5P48//rgcp79bhxprOgIthWYSK1oYx3nV4+Z51xOt1atX8/ZhGKBoEUI8ByqKm2++WcbRamCuOOxEC4GK1MzevXtFXiA7mJ8mTRpJx3igomW9dYhWGqBF684770xQsZlxSrTwzJkd5n1r0QKLFi0ybvdZj80uzd+tQ/xeyBLmmZ/9MR+bXZqOl19+2ZivzxX4+eefZXzgwIHGfID9oeUpY8aMMl+3omHcn2jp1ig9jcAtSAwhTJqOHTv6HK8GcoeWHWD+TRgWLFhQhlq0NHgm7Mknn/Q5Tn+3DjV62+YwiygIRbTM4+bp64kWRNq6beI8PMOEEE+BlidrhYR49913Zb7drUNz5WKtaKxpGAYqWje6dQjWrl2rUqRIIa1IVuxEq3bt2nK7CxUzGDVqlOwLz3oBu4oR81EJWzH/LrNoAXPrkBm7tOvdOgR261jTrPOtgqCXtwaoUKGCtCxdvnzZWP6ee+6Rlwf0uv5EC61j5mn9jNbw4cNlGtIFDh06JNNHjhwxlsczUEjTZcl8THggXk+bbx3iOM0gDceZmFuHVuxEC+XLnIZ8zpUrl7r99ttlukePHsa2zbFt2zaZb1eeNDt27EiwP+I8PMOEEE+Bh6ghIqh0dKtAjhw5DLG5kWjdeuutMj5kyBC1efNmeWge02nTpjWWDVS0UKHhdpEOffvMLFpAV+rmZ4KAnWhpsbrrrrvUrFmz5LgwffDgQZlvVzFiPpa1Yv7dVtGCcJjna+zStGiZf6v592ppw4sFkI569erJrTnzdqzbxPNWOk2/AVi2bFkjT83z0SqFcbRK4jkj3frUp08fmY9xf6L11FNP+Uxr0dItodZjxG3kfv36iaBBmqzz9TTW1y9kWB+GR0sUzo/5OLVo4dyYzyF+j3Xb/rATLf2sG24Fz5gxQ1WuXFmmu3fvLucVZdTuvOrzgPKE5xyteQvwhq61fBLnuX6uE0JImEElMWnSJJ+0xYsXSzpuNdmJFiobpGlZwW1DiEyGDBlkiFtVGiwXqGhZQz9TYxUtkDdvXpU0aVJ501FjJ1pg3rx50rKF52PwkLt+vgb4Ey088G9FHxewipZ1/vXS/D2jZX6GCG/WoUsASBdkGC1Dbdq0MeZbt2m+LYXfiHHkixmk6a4ZIAh4/gm3jPFwNwTZvJydaGFZnHMNljN31/Dtt9/Kb0BXFLpstGrVSpUqVUp+M36HGbtzg2ktWngIHseJty0ROE50TQH8PaOl3wK027YVO9ECR48eFZnCiw7Y54QJEyTd33l95ZVXjO3Y3YrW8ypVqmRsi7hHwhwlhBBCogC0FkG00LJDggPPz9lJHXEenmVCCCFRS6dOndS0adOsyeQGoHUMrbDEfShahBBCCCEuQdEihBBCCHEJihYhhBBCiEtQtAghhBBCXIKiRQghhBDiEhQtQgghhBCXoGgRQgghhLgERYsQQgghxCUoWoQQQgghLkHRIoQQQghxCYoWIYQQQohLULQIIYQQQlyCokUIIYQQ4hIULUIIIYQQl6BoEUIIIYS4BEWLEEIIIcQlKFqEEEIIIS5B0SKEEEIIcQmKFiGEEEKIS1C0CCGEEEJcgqJFCCGEEOISFC1CCCGEEJegaBFCCCGEuARFixBCCCHEJShahBBCCCEuQdEihBBCCHEJihYhhBBCiEtQtAghhBBCXMKvaJ07d47B8BtPPfWUtcjEFM+9vUKdPHuFwYj5iGXe7zZNXTh1mcEIS/iDosVIVFC0GIzYiFiGosUIZ/iDosVIVFC0GIzYiFiGosUIZ/gjINE6depUgrBWvIz4ingSraGjpyYo/0izVlgMRjRGLGMVLet1jLBWlgxGYsMfMSlaN910k0Tq1KlVxYoVfdJ0IC1p0qTq22+/NeZv3LhRxqdOnarSpUunHn/8cbVr1y5ju3Xr1lWZMmVS1atX99mXdTxDhgzGdlu1amVs98iRIypVqlTqk08+8TneaAyKVnhEa9XaTVKu9HSGDBll2LbDU2r56vUy3nfAIPXR1Bkyrst32rTp1Pc79/hsq0jRYjLv1lszqSaPtVAHjpzy2bY5kL7710M+29Qx9O13faa7v/KqLNey1ZNyfBUeqOSzHR1VH6yh9vx+WFWvWVumf/7tD/XH8TMqRYoU6u4yZX32X6hwETVqzHhZDr/PenyIKtWqJ0hLTFjPgb9zG0o0atJM/XHirOrR87UE8yIdsUw8ihbKc++erydIf6V7L3VniTtlvEH9R9T82Z/JeP269Y1x1E9YX6+T8Z/red2qDTL+RMvWatO6rT77efbp53ymzeOPPtIowTHEevgjINH6Ze8+nz+YmLZWvF4KHOOaNWtk/Pbbb1fHjx9XyZMnT7BcsmTJZFm9DoQIBa148eKSNmbMGFW0aFEZv+OOO9TWrVtlfP369ap79+7Geub9YgjRwvj06dN9RKt27dr/VIBpVZo0aRIcS7RFvImW9RrwsmjpZbNlz+GzLYgWhhAoLOdPtA6fPKfuva+Cqlylmk96wYKFjHHrek89/awaOfr/ZHznz7+pHDlvE4kyL4fxhxs8KqJ1W67cImhvDB4m42bROvbXRUPesA5+H4aQlXTp0qsNW35QP+09IGn/N+EjGU+fPoPKmy//f/v55488ZBLjnZ978Z9rLq2qW+9hmV+oUGF18803q1Hvf2D7W/yd25q168r+S91VWqYLFCionn3hJVXmnnJq6cpv1Ykzl+Wcp7rlFvXl8jWyTMNGTUUwERAtpJW79z6f/UU6YhmraFmvY0xbK8toD/wuq2itWf6t8ZvNy61f/Z1PWtp/rpP7/7n2Tx7+S6YhWnq+WbQGDRisatX49x8m8/buKlVanTt5UcYpWv8RkGitX78pQVgrXi+F+UJC+EsrVKiQSNPgwYMlDUKE4eTJk33WWbVqlbFOtWrVZLxChQrGMub9YgjRwnbRYmYWLcxHaxYEz3rM0RbxJlrW8h9u0TIH0v3JgHm5BYuX+mxLt2ghIBr+RKtx0+aGjA1/Z7SRbhUtHRAM/CNj3gbSx384xWe5Bg0bqyN/nhfRGjT0bWl1y5M3nxo4ZLiPaH0wabLImt6OFi1MQ8IgNnrerl/2y/CH3b+qr1Z8o55o006mtWRi/Pku3USEML73wFH1zYatcm4wvWn7T8a2dfg7t3eXvUf2j+PW20arYednXzC29d3WnWrqjLkij0dPXRCpwvnJlCmzIVrW/UU6YhmraFmvY4S1soz2QPmyitZt//zjg9asZzo9q7as3yZpLZs/LstO/fATmR79zvtqxpRZav+eg6rxo00kDaK14ZtN6s2BQ31EC+thWLJ4SRErnQa5ypEjpzFuPbZYD38EJFrLV6xJENaK10uBTG7Xrp3q37+/WrJkiaTZtWhBtDDULVBatPr06SPpXbp0kekDB/797xlp48ePV6+99toNRQvDtm3byu1Gs2j16NFDZcuWTR07dizB8URTxJtoWct/uEVLT2fOnEWGkIFlq9bJeJ/+AxO0aG3ftVelTpPGqNwREK1XXu0jYrN+8w5b0Tp49C9Z77U+A2RepcpVjXlW0TKvh3kQCvN8LTfYZ5duL8stQvweiJaeh/hi2Wof0Xr19f7GtjDfLFoIvax5HzpwvBjWb9DQWAa3OrVQHT99SSQTt08x7U+07M4tRBFDSBSGkCcMx47/ULYB2cMwd568ssy2H39RHZ7qLMtUq16TohUBrKJlvY4R1soy2gPlyypaSCtf7l71WJNm6vVefSRt+6adkq5FqUqlqurlbj1Vv979VZrUaSQNoqWHD9Wp5yNaWA7b/GrRMiPtx+93y/WFcYrWfwQkWtEWyGR961AHWpf69u1rBNK0aEHIsA6EaOjQoTLepk0bqRjwTBaWWbFihRSgFi1ayK0/LVpY5rHHHlM1a9ZUBQoUkDQtWvpY9HanTJkiabt371aNGjVKcNzRFPEkWpEMf6L19bcb5TYWpAUtpBAkpGNZSFKb9h1V1mzZ5TagXlffOtShRQvLIwYMfFPVe/gRlSRJEpmP23LmfV9PtH7Zf0SusdZt28t+J3z0r4ial8M4pAnHjGe1IENly5WXeWbRguToW296HfN2zKKFli+0NEF20LI0bMQoSddShHGzaE38eJrcQoTMYRrCaf0t/s6tVbSwHm6vYlk8U9auQyf1YtceImo4B1gG5/Lx1m1kWYpW+LGKVjwEylfVytVEhNBadeb4eVX89uI+8zev+16dOvLvrX2kDRvyljGul8FQi9aAPv+TNIjW+jUb1dMdOxvLZvunrOvbhZg+sv+4jFO0/iNuRAtp5kCaFq0TJ05Imm55wq1DPEs1a9YskTC9jVq1ask6ELXOnTtL2qJFi+TBebRS7dixQ9LMopU3b17Zbvny5dXhw4eNdDyof/ToUZ9jjKagaIUn/IkW4r77H5AKHc8B6TRdvm/5p3xpWdHhT7R04Pkv/DOhb83hYXXIk17+eqKFeKz54/Ks1P0VKtouh3GIiRYtiB3kCPPMooVnu/q/McRYx59o1arzkPpo2ky5fYfbeWhJ0uv4Ey2IJ1rsdMtXv//9+9iA+Xcg7M6tVbTy//OPVafOz4ksrtu0XfaB36/FCq1tVao+qCpWqiK/W4tW0WK3J9hfJCOWiVfR0vFwvQZqwZyFquuL3X3mv9bzdR/RQssUGg30MrjNePzQn4Zo/Xn4tMr7z/UF0er+0stq3qwFPtv7YuFXxrZ0GkXrP2JStBjuB0WL4WZAcvCskzXdS2EWz0Bj8LAR8uyWNT2SEcvEo2gxIhf+oGgxEhUULQYjNiKWoWgxwhn+oGgxEhUULQYjNiKWoWgxwhn+oGgxEhUULQYjNiKWoWgxwhn+oGgxEhUULQYjNiKWoWgxwhn+oGgxEhUULQYjNiKWoWgxwhn+8CtahFyPeBAtQkh0A9EiJNJQtEiioGgRQrwORYt4AYoWSRQULUKI16FoES9A0SKJgqJFCPE6FC3iBShaJFFQtAghXoeiRbwARYskCooWIcTrULSIF6BokURB0SKEeB2KFvECFC2SKChahBCvQ9EiXoCiRRIFRYsQ4nUoWsQLULRIoqBoEUK8DkWLeAGKFkkUFC1CiNehaBEvQNEiiYKiRQjxOhQt4gVcF60Bnz2lfji8g+GRcAqKFiGRg+UzMEIVrVDXJ9GFW/lN0YqzcAqKFiGRg+UzMEKtOENdn0QXbuU3RSvOwikoWoREDpbPwAi14gx1fRJduJXfFK04C6egaBESOVg+AyPUijPU9Ul04VZ+U7TiLJyCokVI5GD5DIxQK85Q1yfRhVv5TdGKs3AKihYhkYPlMzBCrThDXZ9EF27lN0UrzsIpKFqERA6Wz8AIteIMdX0SXbiV3xStOAunoGgREjlYPgMj1Ioz1PVJdOFWflO04iycgqJFSORg+QyMUCvOUNcn0YVb+U3RirNwCooWIZGD5TMwQq04Q12fRBdu5XfMi1beAnl9pm+66SY16N2BCZZr2a5lgrTrxc0336w27v0uQbrXwykoWrFJ+/bt5Rrxx8svv2xNsqVnz55q27Ztqk6dOurUqVMqY8aM1kX8MmTIEGuSqlSpknryySfVtWvXfNJbtWqlkiZNqpInTy7X5Jo1a9S8efPkNyRLlkzVrl1bHThwwFje+tvGjx+v0qRJo958802fdK8Tr+UzWEKtOENd3wsMGDBAro8kSZLIcOrUqdZF5FoNBvN1hOutdOnSprnRi1v57f8vqkN4QbSe7vq0jG/+bZOq+GBFEa2Jsyeo1GlSqzz588i8Bk0fVtXrVldVa1VVyzYvVV9+94VKnyG9ypT5VmNb2XNmVw/WeVBt2rdR1oVoVahyv8qVJ5caOeEdlSJFClmuSo3Kxv5WbF2uipUoJsuP+vDdBMcX7nAKilZsct9996nFixfLOKSlYsWKMr5u3Tp1/PhxkZKWLVuqlStXqhw5cqjHHntM5jdp0kQVKFBAde7cWV29elWWw3T9+vUN0Tp9+rQqU6aMLH/XXXeptGnTyh9pULNmTZU/f341Z84cNXz4cEkz069fP3XnnXeqH3/80ScdomUWM8iW+Q//hAkTjN9w4sQJ9euvv6r9+/fLdIYMGYztLVmyxPgt0UC8ls9gCbXiDHV9L9GmTRsZ1qhRQy1dulTG8Y8QRAzXKq73Zs2aqSxZsoiMbd26VVWtWlWVLVvWvJkE1xFF68bEhWgVLFJQxkd/NEpkCqIFOdp24Hs1ZPQQmZcseTI1Z+lsEadOXZ5SDZs1VJt+3aQWrvlMfb1tpVq9Y5WMly5XWvUf3s8QrcdaP6ZGjH9bJKxEqeKyrZy5cqrtB7epyfM/luk33vmf7KtAofwJji/c4RQUrdhkzJgx6sqVK2rz5s0JRAvgDy+AOEGounfvLtMQrWPHjqns2bPLH3H8MYeMmUULMtWrVy9ZfuLEibKfYsWKyXSnTp3UrFmzVO7cuW1FK2/evCJbVsyihQqgcePGPn/4q1evbrRWjRs3ToZvv/22DEuVKiXDaCRey2ewhFpxhrq+l/AnWgDXql7m4sWLKlOmTCJa+Ifp8uXL/27g/2O9jihaNyYuRKtr75fU9/u3/iND2QzRgvwULlZY1axXQ5Zr0aa5DHsPfk1uI85YMl3lzptLVatdTS38ZqHMK1m6pLRoocVLi1aTVk1U7ny51etDXlcfTB+nBo8arDq+0FGmsS7Wy/+PYGFfWbJlSXB84Q6noGjFHjNmzJD/ZhH58uXzEa21a9fKUIsWlilZsqTEoUOHRLRA8+bN1ezZsxOIFm41QKIWLFggyxUtWlSVKFFCWsVAx44dVcGCBdX777+fQLQ+/fRTdeTIEXXvvfeKkJkxixZEr2nTpj5/+EeMGKFy5colx4hbjDhuHMvevXt9ROvs2bNq7NixxrTXicfymRhCrThDXd9L2IkWbq0DXKu4BvSteVxTEK3ixYv/u/L/x+46omjdmLgQLQzL3ldWDRs7zBCtdBnSSavTEx1byXz9jJYWrYy3ZpTpd8aPUJ+u+FTN/GKG+nT5XBEytHZp0Wr/XHtp6cI0lk+TNo1atf1rGZYqU0rNW/mp+nbXN7KvDBkzJDi+cIdTULRiC8hQqlSpjGk8D4XnNm655RZ14cIFVblyZUnHrUWQLVs2denSJdW7d2+ZthMt3I4zt2jhjzhuHW7fvl1an9Aihv+cwSuvvCK38XA70SpakCXcpsC2MN+M9dYhZM78h3/06NGybxz3tGn//hGdNGmSzB80aJBUJPgdEEvrfr1MvJXPxBJqxRnq+l5Ci1ajRo3UCy+8oD7//HPjWStcqwDPaKIFK3PmzCJa+EfKjN11RNG6MXEjWilTplQb9qw3RKtVh8fl2an/jfifatO5TQLRQssUbvW1e6attGRh3q2ZblUPVHtAnrvSolXirhJyq7DPm31kGdySxBCtXE+92FHGIW3YV/E7i8u+rMcYznAKilZs8eGHH6py5coZ03hWCiLUo0cPlS5dOnn2ChQuXFj+UH/22WciMBAqYBWtoUOHSmuVWbTAihUr1J9//il/yPGcFsSrW7du6p577pHbg7h1aRUefSsDYrRq1Sp1+PBhY55VtPDfNv7w48FfiCNuTaISwfOT2C84evSoLAfxGzlypEqdOrUc799//21sx+vEW/lMLKFWnKGu7yW0aG3YsEFVqVJF3X777XJrHeBaXb16tbQIZ82aVU2ePNlWtOyuI4rWjYl50WL4hlNQtAiJHCyfgRFqxRnq+iS6cCu/KVpxFk5B0SIkcrB8BkaoFWeo65Powq38pmjFWTgFRYuQyMHyGRihVpyhrk+iC7fym6IVZ+EUFC1CIgfLZ2CEWnGGuv6NePHFF+UZp4YNG1pnXRd0PGqlS5cu6p133rEmJxq8dazfMrYDL5Fs2bLFmhwQu3fvlqFdly124I1ivKCzc+dO6yxHcSu/KVpxFk5B0SIkcrB8BkaoFWeo69+IX375xRCtHTt2SFckeCkDQwReSAHos6pQoULyFu3DDz8sbwtCdNA9A7pawAPuWrTwIDteAkFXDOnTp5eOgM1geQgeOinFSy05c+Y0XgQxdySM+ehHC2Ac3a/o7h/Qlxa6g8HLLoGgjwUv2QD0v4eOkfH2Mt5qRvcu6EAY/eABdE6M49BitXDhQvXdd9+53qmwW/lN0YqzcAqKFiGRg+UzMEKtOENd/3p89dVXMoTU4C1A/VagWV5q1aolwy+++EKGeCMQoEULknb+/HmZRr90EK3WrVvLG8Sgb9++6qeffpJxMxAtdKWCbUKsgF4HIoVt4i1E3aL1xBNPGOvqXuLR5QqwEy3IoBXrseiOjtGihS9G4M1k9Db/wAMPSDredkYrlgaiBaxvQTqNW/lN0YqzcAqKFiGRg+UzMEKtOENd/3qgNQlAtNAy1bZtW9WuXTsfecHXFIDu0kR38AvRMn+OCl9ygGgNHjxYpOvjjz9WP/zwg7RULV++XFqUNBAtbE9/wQFAtLCMbkEyixY+y6NBqxtAFy7AKlroMgJfh8AQ8qjRx4JWLezHLFqoS3R9gt+vW/HQ0qU7TNWihU6L3cSt/KZoxVk4BUWLkMjB8hkYoVacoa5/Pfbs2SNDfevw4MGD0mcdPk+F74qePHlSvpQA7EQL4oKvGUBM0E+dvnWI7aHj3nr16klv7xCyffv2yXrAn2hZOxKGaKGDUtwihBzhePr37y/L+xMtYNeipY8FtwNxLFq08PF53C7s06eP2rVrl/Svh981d+5c+USXvu2pRQvz3cSt/KZoxVk4BUWLkMjB8hkYoVacoa5/I5x8eD3WgYzNnz/fmuwobuU3RSvOwikoWoREDpbPwAi14gx1/Rth1yJE7GnQoIE1yXHcym+KVpyFU1C0CIkcLJ+BEWrFGer6JLpwK7/DIloM74RTULQCB9tiMJwOcmNCrThDXZ9EF27lt+uiRWITihYhxOuEWnGGuj6JLtzKb4oWSRQULUKI1wm14gx1fRJduJXfFC2SKChahBCvE2rFGer6JLpwK78pWiRRULQIIV4n1Ioz1PVJdOFWflO0SKKgaBFCvE6oFWeo65Powq38pmiRREHRIoR4nVArzlDXJ9GFW/lN0SKJgqJFCPE6oVacoa5Pogu38puiRRIFRYsQ4nVCrThDXZ9EF27lN0WLJAqKFiHE64RacYa6Poku3MpvihZJFBQtQiIHy2dguFVxEhIMFC2SKChahEQOls+E/Prrr+qWW27xSaNoES9A0SKJgqJFSORg+UwIROumm26SSJ06tRo+fDhFi3gC10Xrxw/+2cWhjQyvhENQtAiJHCyfCTGLVpo0adSwYcMoWsQTULTiLRyCokVI5GD5TIgWrVSpUolkAYoW8QIUrXgLh6BoERI5WD4Dg6JFvABFK97CIShahEQOls/AoGgRL0DRirdwCIoWIZGD5TMwKFrEC1C04i0cgqJFSORg+QwMihbxAhSteAuHoGgREjlYPgODokW8AEUr3sIhKFqxQ+nSpY3xbNmyqe+//94091969uxpTRIyZsxoTboht99+u3rvvfesySpLliwqWbJkKnny5BJ4iywYcCzvvPOONTkoduzYoV5++WVrsueIp/IZChQt4gUoWvEWDkHRih20aC1cuFBt3GhfRmrUqGFNEhIjWsuXL1fp06dXFy9e9EmHaG3dutUnzR+XLl2yJjkiWmvWrFFVq1a1JnuOeCqfoUDRIl6AohVv4RAUrdgBopU2bVq1ePFin7STJ0+qMmXKyLQWrY4dO6rz588bnzqB3OzZs0fdeuutIj8tW7aU9JdeeklduXJF+jWyUqhQIfXZZ59Zk21FC+tDngYMGCDTDRs2VHv37pXxNm3aqC1btqhMmTLJtFm0mjRpoi5cuCDrv/nmm6pZs2aqb9++qlevXnL8P//8s1q3bp2x7Ndffy2taBSt2CJU0cL6jPgKN0j4V9Bh3BCtpEmT/vNHMZkqUaxggnmhRpP61WX7yZIlVc+0aaqu/L4+wTJRHQ5B0Yod0Iv2H3/8oTJnzmykPfLIIyIcJUuWlGktWuXLl1cFChTwkZvu3bur/v37yzQ6i9QiBMqVK2eMgxdffFEEqEuXLqpUqVI+8+xEq1ixYjLctWuXDCFa4OzZs+ratWsyPmTIEBlaRQtAnsCHH34oYoZrG78J0bt3b5mH3w5y5MhB0YoxQq04Q12fRBdu5XdUitbogS/L8JsFE9W7b/RIMD+UgGgN79NFXTv4ncqeNZMaM6RXgmWiOhyCohU76FuHU6ZMUadOnZJxnb/t2rWToRatSZMmieAULFhQpiE3+KZchw4dZDplypTq6tWr6vjx4zKdJ08eGWq0uCE9Z86cPvPsRAvPcwGraIEDBw7I8LnnnpNhIKKVPXt2mQb79++X4eHDh2VI0Yo9Qq04Q12fRBdu5XdUixYiRYrk6uCWxerWDOnVhkUfq6daNZJ0tHZd+m2t6tKxpUw/UruKOr/3G5Uzexa1buGHKkumjNJa9fXccerir98a29OihXEsO/J/3VXG9OnU6nnjVffOTxjLHNuxVB3Z9qVaOvN9VaRAXjVn/FDV8fFH1dX9G9SH7/ST+Sd/XK4+GTNIlr+3TEk1b9JbcisD++3b7SnZVsXypdWfu1aofLlzqjXzJ8g00nGM1t/tSDhE2bJlje+KhSOqVatmPQRXiaeKzPwwPFqqFixYoO644w7VuHFj9fbbb6vffvtNDR06VK1evVpkBK1MnTp1kuX1M1ozZsxQWbNmVUePHpXp2rVry4P1d999t7FtgNYu3Gb89NNP1cCBA9Xff/9tzINoQdTQKoaYOXPmdUWradOmqnDhwmry5MkyHYho/fXXX3JcuXLl+ncjyle0cLsU2/Q68VQ+QyHUijPU9Ul04VZ+R71o5ciWWW1cMlm1b/GITEN+0BpV5f4yIjt6ObR+YQgR6/Z0KxEtPe/4D8uMcUgRbkumTJFCtWveQF3+bZ2qWflemXdg8yJ1evcqWUYvP/uDocYtzN3fzBXRwjKY/nXDZ2rsm6/K8mgZg/glSZJE5rVp9rAMF015V4Zv9X0pqkQr3C1akK1wwoosNL755hsZ5s6d2zKHOAHLZ2CEWnGGuj6JLtzKb9drL7dFC61OEKsOLRvKNKQJcrTpiynqwr5v1TsDukk6Wr0w/GXtfLV/06LripZu0dKBlioM9fNaVtEqeXshGd/z7TwRLcicbiXTojV97CCZB4lDuhatxVP/FS0cJ0Srwj2lZHrSiL4+x+BYOARFi5DIwfIZGKFWnKGuT6ILt/Lb9drLDdGCrKS6OaUqXvS/h+FnjB2sihbMqx6tW02mZ/7fEJUubWpVukRRmX6iyUMqW5ZMcisQ08GI1mcfjVB3FCmgalQqbyyj50G01n/+kbRq6W1v/nKqypsrh2pc70F1W/as1xWt11/qoArlzy23EiGMPZ5pLcfd+ckmPsfgWDgERYuQyBHp8vl///d/6vfff5fxp59+Wp65Q+vliRMn1NKlSy1LO8Ps2bONFxgCJdSKM9T1SXThVn67Xnu5IVpeC0gTZA3PaVnn3SjQCmZNczUcgqJFSOSIdPmsVauWevfdd2UcogUJunz5snTDEYpooUsQf1C0iNu4ld+u117xIFqhxJmf/32eK2zhEBQtQiJHpMsn3kbFywd4+UGLFt4CRZ9ldqKF7jyAfnEBPPPMMzLUfa/hhQXQqlUrWa5r166qTp068sIEXs6gaBG3cSu/Xa+9KFoeC4egaBESOSJZPvHm5n333adKlCihHnroIUO0NNcTLd1JLLj//vtleObMGRmiWxCwZMkSWQ5dhkCw0HKGfVG0iNu4ld+u114ULY+FQ1C0CIkckSyf6G8NQLjwKaXEilaPHj1k2LlzZxnaiRZat0CGDBkoWsR13Mpv12svipbHwiEoWoREDpbPwAi14gx1fTeAgOJrDpoxY8ZIH3HXA33l4YPpVsz90gH0XQfQ/53uPNjue6a6s2B/DBs2TD3wwANGayU+06XZvXu3+vjjj41pL+FWfrtee1G0PBYOQdEiJHKwfAZGqBVnqOu7AUTrscceM6bx1QaIFjrbxTc9ixQpoqZOnSrzcMsVHfRiCNHSLYL6s1VW0cI3SgE6D0YnxSBFihTy2Sy0XELYIEkQrddff12+7mBuzdTgG6lomdTHYRYt8MYbb/hMewW38tv12oui5bFwCDvRMn+6ZPTo0TIcO3askQZ0D99A9/r9559/qlWrVklP37h98PzzzxvLgB9++MEY138ggHU5J2FFRrwMy2dghFpxhrq+G0C08Nkr/I2dOHGi/B2EaKVLl874rBRux5oFCC1ggYgWvsxw8eJF+buNdfAB9p49e0r3HboTYvzth2jp1qqHH35YffDBB+bNqJdfflmG+uPzEC187QHSFu5/moPBrfx2/RdTtDwWDmEnWmnTppX/eBDBiNbmzZvV+vXr5bM++NDw9u3bjWUA3j7S4A8Etp83b155RuTmm29WP/30k3w2BUN8NgZ/eObNmyf9+owfP141atRI1atXT9ZH0zgesMUfiTvvvFPt3LlTtW3b1ti+hhUZ8TIsn4ERasUZ6vpuoEUrf/78IkB4KxOihb+/5u9/zpkzx1gnWbJkIlqvvvqqTD/55JMytIoW0tFyBfCh+I4dO6rTp0/LN0IPHjwo6b/88ovsBx92B9iGfmMU4Jaj/uC77gLE2qKFT3Z5Ebfym6IVb+EQdqKVmBYtfGT4nnvukWlcnN99953Pd+jQAaK5mVn/J4b+dvA9O/2dPi1tn3zyiZo7d648aItl8UcJx4I/Ss8++6wsU6BAAVkXH0aeNm2aSJkVVmTEy7B8BkaoFWeo67uBFi3c5tPfHIVotW7dWrVv317+Uc2cObN8IH7+/PkiYvj0G0SrfPny0tEs5gOraOGj8WjVAmvXrjXG0UIGCYMw4XYhRAutVrgDgW+XHjt2zNgGWsA0+/btk3lW0cI/wF7ErfymaMVbOIRTomXmhRdeENlatGiRkYY/Jvq/I2C+dYgHNitWrCjjhQoVUj///LOqX7++TOtXx6tUqSJD3SpWqVIleV4BrWFFixZVhw4dsn1LihUZIdFPqBVnqOuT6MKt/KZoxVs4hBuihf+a7rrrLlWtWjUjrXv37qYl/rt1iJaw5cuXG6K1evVq+W9NP7fVrVs3Gb7yyisyxAOjECysg9fTsZ/3339f5lG0CIlNQq04Q12fRBdu5TdFK97CIexEK5agaBES/YRacYa6Poku3Mpv10WLxCYULUKI1wm14gx1fTfAs1f4riS6bcDjFngGKxR0Z7L+0M/BWtm2bZsMFy5cKMPjx4+bZ18XPFivny/zEm7lN0WLJIpwi1a4XwmmaBES/YRacYa6vtPonvXx2AO6xcGzqebvRyaGxIrWypUrZagfhA9GtIB+89FLuJXf4a29SMxA0SKEeJ1QK85Q13cSvIF92223GdO//vqrPOe6adMmIw3PxuKtQrzkg/6tRo0aJS8EofsFPJcKKRo3bpwsi+dYL126pJImTSqShB7g8Rah9blYiBbWxxCdoqIzUqBFS7doobNUPAOLriRwbOg3C31y6ZYrdMFz5MgR6SoCoCUO872EW/kd3tqLxAwULUKI1wm14gx1fSf56quvVOXKlY3pESNGyFvUkBeNfgkJfPrpp9LnFbq2wdvYuuWrVq1aIlbojBTgRaEJEyaomjVryjS6bkDfWRoIFqZxyxIChU/rAKtoffnllzJEdw8QOBwX5LB58+aS3qtXLxmiY2rNxo3OPTfsBG7ld3hrLxIzULQIIV4n1Ioz1PWd5LPPPlN16tSR8RYtWsjwo48+8pEvs2itWbNGxEiLlv4YOIQKAoTP6gB0FI3vJaJzUoA+Cs1AtPD3Xv/Nb9eunQytoqVvHeLzPeifULd8adGaPn26zzTQvc17BbfyO7y1F4kZKFqEEK8TasUZ6vpOg69aAEgSOg595plnDGEC/kQLt+nQKzw6g9YihW500HGpvlUIkcPtQ7RwmYFo4esd2De+vPH222+r3377TeXIkUO61bETLbR+YTvofgfLoRNpq2jd6MPUkcCt/A5v7UViBopW4GBbDIbTQW5MqBVnqOs7jflTN9FOnz59rEkRx638Dm/tRWKGWBItfPgUn7Qww4qMeBmWz8AIteIMdX030B9zjmbwUP3evXutyRHHrfx2r/YiMU0siRa+Uo/tI7R0sSIjXoblMzBCrThDXZ9EF27lt3u1F4lpwi1aeJ5Ay5DTcfPNN/tMQ7ZYkREv42T5tF4Pbkc4CbXiDHV9El24ld/hLfUkZgi3aLkJWrQQ6PdF42RFRojTsHwGRqgVZ6jrk+jCrfymaJFEEUuihRasYcOG+aSxIiNehuUzMEKtOENdn0QXbuW366K1pElDhofCKWJJtOxgRUa8DMtnYIRacYa6Poku3MrvsIjWxc0bGR4Jp6BoERI5WD4DI9SKM9T1SXThVn5TtOIsnIKiRUjkYPkMjFArzlDXJ9GFW/lN0YqzcAqKFiGRg+UzMEKtOENdn0QXbuU3RSvOwikoWoREDpbPwAi14gx1fRJduJXfFK04C6egaLlL7ty51bp162QcvSjrD7k6CT7nYf2umeaNN96wJvmAb6eZqVevnqpUqZIxje+jmcFHbPH9M3xPzUqXLl1kiO+yZc2a1TLXnuXLl1uTDJo0aSKdzl67dk1lz55dPpjrBP369bMmCbNnz7YmuU6ky2e0EGrFGer6JLpwK78pWnEWTkHRchezaOFTFe+++65I0dKlSyWtTp06Mpw4caJ8JLZYsWIynSxZMvnIbN26dWUagob56ChSr6sxi1bv3r1lOGTIEBnXotWmTRt18eJFtWXLFvXjjz/KR2dbt25tbAOMGzdONWvWTDVs+N9brVbRAvfee69tuhYt/E58KBd07NhRnT9/Xrre+OOPP1Tq1KnV6dOnVYUKFWR+2rRp1axZs0RC9+3bp3766Sdje1q0ALY3cuRIOW58AFd/QBfLHDt2TB05ckTOS5EiRdScOXNkvzhXX3zxhdq/f7/s86233pJ1IFo4Z/gN2O8nn3wi6UWLFhWRzJQpk3zIFx/SBTr/sDz2VaZMGVnHuu/EEOnyGS2EWnFifUZ8hRtQtOIsnIKi5S4QrZQpUxq91gM70UKrDYQkR44cMn3//ffL8L333pMhhATkypUrQaUeiGilS5fOWH7QoEEiLJAuM+i1f9GiRWr69OlGmlWoIGk4xl69esmyZiBayZMnV0mSJDEEEbJ49epVlT59erVr1y6VIUMGSdPgd61YsUKtWrUqQesaRAbbw/mDaF6+fFnVrFlT5h04cEDkCcto0CJVokQJGd+9e7ec7yeeeMKYX7ZsWRlCtLAuWubQ+jZ27FhJf/XVV2X46KOP2ooWlgcPPPCArGPdd2KIdPmMFtyqOAkJBopWnIVTULTcxdyiBTp37ixS9OWXX8p0vnz51KFDh9TOnTtlWovW008/LUNU6JAw3dt9njx5ritaWhaefPJJH9HSogYGDhwoonX8+HEjDTRv3twYHzx4sAzNooXl0SIFIEaNGjUy5gHdogUgT2DSpEly/AULFhTRggChFahVq1YyH8f1+++/yzgkbubMmXoTPi1aGrRUAbTuAavslCxZUsb37NkjooUWOs2OHTtkCNFCuddlX4uWliVsE6KlW93wGwCWR6sgpI+iFV4oWsQLULTiLJyCouUuVtGCYEBQXnjhBfX555+LDGzfvl1uWaHlB7etgFm0QIsWLaTFB61F1xOt8uXLq7Nnz6rMmTP7iBZuE6JFCPtC2InWtGn/VWZasMyipY8P28HtOd26pNGihd8C0QPLli2TIX7ntm3b5BYgZOWZZ56RdIgWevM/ePCg3MbDb9HYiVa2bNnU2rVrjZY7q+zkz59fnh/D9rHPGTNmiMhi2/3795flevbsqRo3bqz69Okj8ofbuXp9vU0cK253ovWtcuXKko7lAc4t1rHuOzFEunxGCxQt4gUoWnEWTkHRig70A9wQN9z2IvbgWTQIJETQ3wsCXiJWyqfbULSIF/C0aNWtVFE9cPfdCdLvKlZUbZ41M0G6jtUff5QgzRx63UMrlqnnW7ZUFzZ9J0OkPVSpkgx3LpinmtaqJeNDXuoiw1UfTVKjXu3ls61lEz7wmX6n58syXDlpoir4T+WG8bSpUyfYX6miRdW6aVPV93Nnq6L588l8/C69nd2ff2aMb5g+TYb7l36pXmnfTv259huffQYTTkHRIiRysHwGBkWLeAFPi1a6NKlVqpQp1S+LF8l08UIFVdZMmWQIWSp9ezGVKUN6dd9dpVT5O+9UObNmleXKFi8uw/aNGql7ShRX9atU9tmuWdJ+XrRQ/fbVFwlEC6EFSIsWokPjRj7berHV4z7TWrQQi8a8L1KlRcu8v5daP2GkTXlzsAxvJFo6rLIXTDgFRYuQyMHyGRgULeIFPC1a80e9qyYPGaTKlSyhPhk21EhPc8stIkvZM2eW6ZfbtTXmQVC0aN1bqpQMR/Z8xWe7WBcClzxZMnV7gQKSpkUradKkMi9lihRqz+LPJQ3LIQ3id2bDOp9tDXjuWZ9ps2ghvp06WZ75sO5vxcQJqlmd2iKOaKVCWqCiZZbBYMMpKFqERA6Wz8CgaBEv4FnRGt69mzHe8MEH1fTh/4lWsn9kCLJULH9+me7Vob0xzyxaHZs0luHo11712bbdbUe7Fi0d5hatG4VZtJb835gELVo61kz+2BhfPPZ9GQYqWmzRcp/nWJERD8PyGRgULeIFPCtauBWoxz/o11cdWbVSzR7xtjq/cYO8QeUF0cJzXNY0LVoQqSL58sq4nWjh922ZPVP9/tWX6tHqD0rajUTrjxXLVe9OT/EZrTDwHCsy4mFYPgODokW8gGdFi+FOOAVFi5DIwfIZGBQt4gUoWnEWTkHRIiRysHwGBkWLeAGKVpyFU1C0CIkcLJ+BQdEiXoCiFWfhFBQtQiIHy2dgULSIF6BoxVk4BUWLkMjB8hkYFC3iBShacRZOQdEiJHKwfAYGRYt4AYpWnIVTULQCB9tiMJwOcmMoWsQLULTiLJyCokUI8ToULeIFKFpxFk5B0SKEeB2KFvECFK04C6egaBFCvA5Fi3gBilachVNQtAghXoeiRbwARSvOwikoWoQQr0PRIl4gLKLF8E44BUWLEOJ15r+/TGSLEVzUq9A4QRrjxuEP10WLxCYULUIIiU1uuolq4CQ8myRRULQIISQ2oWg5C88mSRQUrcDBthgMp4MQt6BoOQvPJkkUFC1CIgfLJ3ETipaz8GySREHRIiRysHwSN6FoOQvPJkkUFC1CIgfLJ3ETipaz8GySREHRIiRysHwSN6FoOQvPJkkUFC1CIgfLJ3ETipaz8GySREHRIiRysHwSN6FoOQvPJkkUFC1CIgfLJ3ETipaz8GySREHRIiRysHwSN6FoOQvPJkkUFC1CIgfLJ3ETipaz8GySREHRIiRysHwSN6FoOQvPJkkUFK3oJ2PGjGrHjh3qzJkzKkOGDGrz5s1qy5Yt6tixY9ZFVY0aNXymsdyBAwdU7ty5fdJvBNazUq9ePVWpUiVjeuvWraa5iaNLly4yfPXVV1WpUqUsc/9FLxONxEP5JJGDouUsPJskUVC0oh8tWuC1115TzZo1U/Xr11cLFy5UY8aMEfl65JFH1IABA1SaNGnUmjVr1Lhx49Qdd9why0G0cuXKpXLmzKkKFy4s2+ndu7cMhwwZIuOrV69WadOmVffcc4+kYz0zJ06cUOnSpVOpUqUy0iBaHTt2VE2bNpX177zzTmP9CxcuqBw5cqjSpUvLNI4TsofjPHfunLENLVHFixdXR48elfGVK1fKutineZlatWqprFmzqn79+qmrV6+qTp06qSxZsvy7IY8SD+WTRA6KlrPwbJJEQdGKfsyitWvXLhEiLVqQLEiNRrdojRgxQoZatJIlS2Ys88EHHyQQrSpVqvi0kFlFq1q1amrRokVq+vTpRtqzzz6r9u3bJ+NYv0ePHsa8PHnyGOPdunWT45w6daqRpoFElSlTRs2YMUOmJ0yYoGrWrCnjSZMmVadPnzZEC78TrXnp06dXK1asUPnz51d///23sS0vEg/lk0QOipaz8GySREHRin7MooWWoyJFihiiNWfOHGllQksR0KI1c+ZMGWrRQkuQ5o033jBEa/DgwTK+bds2dcstt6jy5csb65mB9GTKlEmOZe/evZJWsmRJ1bVrVxnH+ri1iPWvXbsmy2M+AtvHcZYrV06O8/fffze2C4mC4KFl6vDhw9JahXG97qFDhwzRwrYbNGggx4F94Hfceuut6tKlS8b2vEY8lE8SOShazsKzSRIFRSv60aJ1/vx5GUerjhYt3A68ePGieuaZZ2RZLVqzZ8+WoRYt/EHG7bbly5eL2EBazp49qzJnziwihFaiK1euqClTphjrmZk2bZoxrm8H4tYhJKhx48ay/ty5c431O3fuLMe7Z88euRWI4/z+++/lONu0aWNsS0vUX3/9Ja1gkLBs2bKJPKEVzbzMsmXL5HfhtwwbNkxavk6ePKk+/PBDY3teIx7KJ4kcFC1n4dkkiYKiRUjkYPkkbkLRchaeTZIoKFqERA6WT+ImFC1n4dkkiYKiRUjkYPkkbkLRchaeTZIoKFqERA6WT+ImFC1n4dkkiYKiRUjkYPkkbkLRchaeTZIoKFqERA6WT+ImFC1n8Xs2UZEyGP7irbfeshaZmIIVGfEyLJ/ETShazsKzSYgNrMiIl2H5JG5C0XIWnk1CbGBFRrwMyydxE4qWs/BsEmIDKzLiZVg+iZtQtJyFZ5MQG1iRES/D8knchKLlLDybhNjAiox4GZZP4iYULWfh2STEBicrMmyLwXA6CHELipaz8GwSYgMrMkJIvELRchaeTUJsoGgRQuIVipaz8GwSYgNFixASr1C0nIVnkxAbKFqEkHiFouUsPJuE2EDRIoTEKxQtZ+HZJMQGihYhJF6haDkLzyYhNlC0CCHxCkXLWXg2CbGBokUIiVcoWs7Cs0mIDU6KlrWjSQbDiSDELShazsKzSYgNrMiIl2H5JG5C0XIWnk1CbGBFRrwMyydxE4qWs/BsEmIDKzLiZVg+iZtQtJyFZ5MQG1iRES/D8knchKLlLDybhNjAiox4GZZP4iYULWfh2STEBlZkxMuwfBI3oWg5C88mITawIiNehuWTuAlFy1l4NgmxgRUZ8TIsn8RNKFrOwrNJiA2syIiXYfkkbkLRchaeTUJsYEVGvAzLJ3ETipaz8GwSYkM0V2S///67SpIkiTX5upw6dUoNGTJExqdNmybD7t27y3Dr1q3GclYOHz6s3nvvPWO6Ro0aprn/0bNnTxnWqVNHhvny5VPffvut7BP7DgZ9XJqDBw+qXLlyqSeffNInHcybN8+aFBNEc/kk3oei5Sw8m4TYEM0VWZkyZdSSJUvU1KlTZXr06NGqXLlyKlu2bGr//v1q3759qlatWipr1qyqX79+sgxkZ/jw4Wrx4sWy3IgRIxKIVtOmTf/dgQmIVteuXVWzZs1kWotW7969RX5eeeUVNWDAAJUmTRq1Zs0aVb9+fdWnTx9VsGBBtXbtWh/RwnGPGjVKLVu2TKVNm1YVKlRI0g8dOqTSp0+v5syZI9NW0XrttdfU5cuX1Z133umTDqyiNXLkSJUuXTp17733ynThwoVVlixZ1BtvvCHT27dvVxUqVDDm47dj+2XLllUdO3ZUGTJkUI0bN5Z5+F0FChRQnTt3VlevXv13B2Eimssn8T4ULWfh2STEhmiuyG677Tap+Bs0aCDTEK1NmzapCxcuiAC1adNGpOHHH39Ut9xyiyyjRQto6TCLVt++fdXFixdl2gxE68yZMypPnjwyrUXrrrvuknn33HOPTzpEC6xbt06GWrQgSr169ZK0/PnzqytXrqjJkyfL9LPPPiv7zp07t0xbRev48ePq/vvvN6TRjFW0UqVKJdt6+umnZRqi9eeff0oL22effSbT48aNUx999JEcE3770KFDZbx06dLq5MmTIoR63WPHjqns2bOrpUuXmnfjOtFcPon3oWg5C88mITZEc0WGFhu00uD24aRJk0S0NM8995zasGGDKl++vIhYpkyZJP16olWyZElVt27dfzdgATKlefXVVw2h+vrrr2WohepGotWyZUu1YMECSZs4caIqUaKEatSokUyfOHFCjvP999+XabNoffrpp9KSBYFEK1T//v2NecAqWt26dZPWvWrVqsk0ZAlgOzhGnQ5mz57tc9v0kUceUVWrVpXzAT755BMZNm/eXJYNJ9FcPon3oWg5C88mITZEa0Wmn4UCuEWYPHnyBKKVOXNmuT0HOdB/UK8nWlo2cMtsx44dsl2NWbTeeustQ6juvvtuaWmC0IEbiRbQtw4zZswoLXIvvviipNerV0+dPXtWbidi32bRwi1O7AstS9i2FjyNVbQefPBB2V/FihVlGqJ1+vRpuZWJW5O4XQnRw3NqaPkyixZuee7atUvOH5g+fboMKVok1qBoOQvPJiE2RGtFhttuZtDaYxWtjz/+WOXIkUP16NFDderUSdLNorVixQoZt4oWWpXwMLtZdMyiBTnSQoXWLTyjhX0A3H5bvXr1dUUL+0VL3AsvvCC3HidMmCAtUHhuCq10Y8aMkeXM+4cM4SF4/M5BgwbJbVMzKVKkkNuFiLZt28rxQbLw/NrcuXNFtCBXuDV67do19f3338ttSC2IZtG64447RDbffvtt9dtvv1G0IoB+YQPcd999pjn+0beJNQ899JDRWhoK2C6eO4xFKFrOwrNJiA3xWpHdiJkzZ8oD9bGCvnUYbcRr+YRobdmyRaQX6LdYIc8Q9i5duoiAQeSRBhmyihZaPatXr+6ThmnI/cCBA2Uarai4XY7b1rglDfmuXbu2KlKkiMg9/oHQogV5x/N77777rgj/xo0bfbaHVlC8YIEXUHCM5u2dO3dO1tUtrHrepUuXzIcXdihazsKzSYgN8VqRxRsLFy60JkUF8Vo+IVpotcQzecAqWi1atFA///yzvNwAgQFW0UqaNGmCW8p4KeTo0aPybOC2bduk9RTPN+LZQb2d9u3bSwsw3ujFc3patPDCB17ewLpoLX7ppZd8tofb27NmzZIWV7xoYd7eqlWrZBxdnQA9Tz+vGCkoWs7Cs0mIDfFakZHoIJLlEy8MoCKOROhbh/pFBC1apUqVEtGaP3++TOO5OzvRat26tbQWodVo/fr1Rjqe3QN4xhGS9ddff8mtZLxRq7eDfWNdyBNadrVo6eci0ZqG6Q4dOvhsD12cNGnSRG4545a8eXsQfTwPuHLlSknT86ZMmZLgt4czzC+FkNChaBFiQyQrMkJuRCTLJyriSGF+Ritv3rzyvB5alLRooTUJt+/wPKCdaP30009yG+/xxx8XGfr7778lHWm43ae7CMGzhJUrV5ZnEM1iBNDSBa4nWubtQf7Q4oZWOPS7Zt4eWt9wmxLzsK5ZtEjsELkrhhAPE8mKjJAbEcnyGUnRcgv0LRco6NftRgSzPRL7xN4VQ4gDRLIiI+RGRLJ8xqJoEeImvGIIsSGSFRkhNyKS5ZOiRUhw8IohxIZIVmSE3IhIlk+KFiHBwSuGEBsiWZERciMiWT4pWoQEB68YQmyIZEVGyI2IZPmkaBESHLxiCLEhkhUZITcikuWTokVIcPCKIcQGJysybIvBcDoiBUWLkODgFUOIDZGsyAjxMhQtQoKDVwwhNlC0CLGHokVIcPCKIcQGihYh9lC0CAkOXjGE2EDRIsQeihYhwcErhhAbKFqE2EPRIiQ4eMUQYgNFixB7KFqEBAevGEKIJ2AFHh0wnwgJDl4xhBBPwAo8OmA+ERIcvGIIIZ6AFXh0wHwiJDh4xRBCPAEr8OiA+URIcPCKIYR4Albg0QHziZDg4BVDCPEErMCjA+YTIcHBK4YQ4glYgUcHzCdCgoNXDCHEE7ACjw6YT4QEB68YQognYAUeHTCfCAkOXjGEEE/ACjw6YD4REhy8YgghnoAVeHTAfCIkOHjFEEI8ASvw6ID5REhw8IohhHgCVuDRAfOJkODgFUMI8QSswKMD5hMhwcErhhDiCViBRwfMJ0KCg1cMIcQTsAKPDphPhAQHrxhCiCdgBR4dMJ8ICQ5eMYQQT8AKPDpgPhESHLxiCCGeIFIV+P79+1XJkiXV3XffLdOHDx+2LKHU6NGjrUnXBdsLlBo1aliTVKtWrdTWrVt90iZPnuwzHSkilU+ERCu8YgghniBSFXiLFi1keO7cOfX555+ra9euWZYIXrROnz5tTfLL2bNnrUm2ohWMvLlJpPKJkGiFVwwhxBNEqgJftmyZqlWrlho5cqRM6xat8ePHy3DBggUiWo0bN5bpefPmiRwVK1ZMXbhwQYZHjhwROUKrU9euXQ0punLliurTp4+M7927V4a7d+9W9erVk/GZM2f6tGitW7dOXb58WaVIkUJEa9asWZI+btw4Y5s9e/aUYcuWLY31wkmk8omQaIVXDCHEE1SrVk0q8XBHp06djGNo3769IVoXL16U4ZQpU0S0Jk2aJNMQLdC5c2cZokVs8eLFasmSJSJKHTp0MKQI6ZUrV5bx1157Ta1evVpt3LhR/fXXXyJlvXv39hGtd955R4Y4FxCtJk2aqEWLFqnhw4cb2yxXrpyaNm2aql+/foLfEq4ghAQOrxhCSFxzzz33yPDq1auqf//+fkXr77//FknSooWWLCyTL18+WccqWseOHZPWqZw5cxq3ErH8+vXrpdULVKpUKUGLFlrBUqVKJaK1Z88eSX/zzTdV8eLFZVy3tNWtW9dYL5xQtAgJDl4xhBBCAoaiRUhw8IohhBASMBQtQoKDVwwhhJCAoWgREhy8YgghhAQMRYuQ4OAVQwghJGAoWoQEB68YQgghAUPRIiQ4eMUQQggJGIoWIcHBK4YQQkjAULQICQ5eMYQQQgKGokVIcPCKIYQQEjAULUKCg1cMIYSQgKFoERIcvGIIIYQEDEWLkODgFUMIISRgKFqEBAevGEIIIQFD0SIkOHjFEEIICRiKFiHBwSuGEELIdRkyZIgIVpIkSYzhoEGDrIsRQmygaBFCCLkhdevWFcnSQQgJDF4thBBCAoKiRUjw8GohhBASEJQsQoKHVwwhhJCAOHfunCpUqJA1mRByHShahNjw27q+aueixxgMBoPBCCj8QdEixAa5aC4eYjAYDAYjsPADRYsQGyhaDAaDwQgq/EDRIsQGs2gNHT3VNhJcZAwGg8GI3/ADRYsQG6yiderUKZ+gaDHCHfqNv9tyZlePPlLXSP9q0QyVLFkydfTAdvV0x9Y+XTCMfmegsS6WsW4TcWfJO1TjR+upC6f2+aRXrVxB1tu6YanKdVsOde7kL5KeP18eNX3yWJ/9IObNmpQgDcsP7N9Tlb6rhCpSuIDq81pXn9+CKFG8mNqwZpGx31SpblZzZ0wwpn/YslJlyZxJ3VuujFow5yNjfevvYDAiHn6gaBFig1W0Dh8+4hMULUa4A3LRoW1LkSKM/33+gKS3b9NCpseOflMt/PRj1a93N5EVDLXAmMXHGsWKFpJ5H45/xyfdLFoY9v1ne0iHaO3YvEK2f3uxwqrri51kHKL1YNWKMq5D77t8ubtVwQL5jGPAENvBNvV88+9s/tgjMn75zG8qT+7bVOennlQ5smdTyZMnN5ax/g4GI+LhB4oWITZYRWv7jp0+QdFihDsgF+tWL5TxlV/NUb17dZEWHi0m5harjBnTG+NY5v/eGyrLHP79e9vtPtOpjSFuOsyiBblDqxLSIUh6mYYN6qgDezfLOESrxoOV1Bv9XpGY/ckHqlOHJ9T2Tctt94ntYxzyVLf2gzJ+4o+dqkWzhjIf62P6lltSqS7Pd1R7d63zWd+6TQYj4uEHihYhNlhFa/36TT5B0WKEO8yihdtpbVs3EymBYM2ZPt5HPsyihWVwWxHLvP/uYJ9tQrwgOm8P7SetXyf/+NGYZxYttKThNuR33yy+rmhheR1NGtVXD9WpLvvWx49Yunimz3JFixQ0BBBCiNuG+E2PNWkgacuWzFQpU6aQZXELUm/L/DsYDE+EHyhahNhgFS27SHCRMRguhlm00MKDFh+zsCC0sGjRsj5LlTRpUp9t4pbdtQsHRXas8mIVLX0M+KC0XsYqWmjJMm9j0fwpqlaNKnILEC1mjRo+ZIiWbtHCOKTs0K9b5PjMx7tmxXy5PYnlTh/brVKkSGGsY94Pg+GJ8ANFixAb2L0Dw2uh5QPPKj3ycG116sgun2ebjh3coapUul/GtWjdfHNKn2WsonXm+M9yS/CFZ9urNwf29mnxshMt3AY036K0ipZZkrQM9X+9uzzwjue3du/4Rm1a+4WPaKVNm0alT59O3Ve+rCFSiFJ33qHOntijfvx+lcqeLasqfkdR9dabfWUeRYvhyfADRYsQGyhaDAaDwQgq/EDRIsQGihaDwWAwggo/ULQIsYGixWAwGIygwg8ULUJsoGgxGAwGI6jwA0WLEBsoWgwGg8EIKvxA0SLEBooWg8FgMIIKP1C0CLFhz4pnRLYYDAaDwQgk/EHRIsSG6100hBBCSKBQtAixgaJFCCHECShahNhA0SKEEOIEFC1CbKBoEUIIcQKKFiE2ULQIIYQ4AUWLEBsoWoQQQpyAokWIDRQtQgghTkDRIsQGihYhhBAnoGgRYgNFixBCiBNQtAixgaJFCCHECShahNhA0SKEEOIEFC1CbAhVtKzfwGJ4M0LBui1G7EcoWLfF8Ga4AUWLEBvcuuCId2Aek2BgeYl93MpjihYhNrh1wRHvwDwmwcDyEvu4lccULUJscOuCI96BeUyCgeUl9nErjylahNjg1gVHvAPzmAQDy0vs41YeU7QIscGtC454B+YxCQaWl9jHrTymaBFig1sXHPEOzGMSDCwvsY9beUzRIsQGty444h2YxyQYWF5iH7fymKJFiA1uXXDEOzCPSTCwvMQ+buUxRYsQG9y64Ih3YB6TYGB5iX3cymOKFiE2uHXBEe/APCbBwPIS+7iVxxQtQmxw64ILJ3///bfKly+fOnnypHrjjTdU2bJlJX3evHkyvHTpkrr11lvV66+/bqyTP39+tWbNGmNac+HCBZ/p+vXry3DPnj2qWbNmMo7tNmnSRA0fPlxdu3ZNrV27Vo0ZM0ZlyZJFbdy4UV28eFFNnTpV/fDDD+ZNRYxYyONgQR6hXCxevFj99NNP1tkJ+PXXX61JBlu3bpW8BUeOHFG5cuWyLPEvVatWtSZFJdFWXr788ks1adIkdeLECTVo0CCVKVMmScc1a+brr7/2mbYDfz/69evnk9aqVSspH4sWLVI5c+aUtJUrV/osYwbXv9dxK48pWoTY4NYFF25KliypZs+e7ZOmRatly5aGCGn8idZTTz3lM61FC39oH330URk3ixaAXI0cOdIQrcuXL6uZM2eqLVu2GNuJJLGSx8GAPLp69apUjn/99ZekTZw4UU2ePFkVK1ZMPfvss6pTp05q1qxZMk/n5UcffSRi/vjjjxvbMosWGDBggAxRhq5cuSLbBFq0kK73FY1EW3lJnTq1z/TevXvlH6BKlSqpU6dOyT9huB6Rh1988YUqWLCgOn36tKpcubIs/9JLLxn/jNmJFpZ/7733fNK0aLVp00bECnKHcpImTRq5/lOlSqW2b9+unn76aSln7dq1k7Ly4YcfqqVLl8q6Q4YMkXKaO3du86bDglt5TNEixAa3Lrhwc+bMGXXffffJH9fVq1dLmhatzJkzS2sX/uhp7EQLFTOkzEzSpEnlj2bKlCnV77//LmlatJInTy7p6dKlkz+u+EOOaaRnz57dZzuRJFbyOBiQb8iHm276708/Kl/IT44cOVTfvn1V7dq1jXlatHr06KGOHTtmpAOraI0dO1aGBw4cUOfPn08gWkjX+4pGoq28FC1a1Gca1/Eff/whkg3eeustEWfk4RNPPKEGDhwo6dOmTRP50SKOVmg70UI+1q1bVwQdLWdAi9b+/ftl2LlzZyknkDWAlk/w/PPPq+bNm6u0adPKNIBo/fLLL1J2gPX4w4FbeUzRIsQGty64cIL/Eh966CFjumLFijLUoqUrRtxKwm0+YCdaL774ojp48KBPmm7RMmNt0dLoFi2vEQt5HCw67wFu+R46dEjt3LlTZBmihdu6Z8+eVcuXL5d5yEtU0AC3j4sXL26sbxUtyDzWueWWW2RaC7gWLaTrfUUj0VZeChQo4DMNiQa4bQzeeecdaXlCHqIsQKjA8ePHpSXr3LlzMo0yYBUttGRDxjS9e/eWoRYtSDV47rnnpJygZR2UKVNGtv/xxx+LaOGfNQ1E68cffzSmN2/ebIyHC7fymKJFiA1uXXDhBP+94j9J/Gf6+eefG5UiKlvcOtB/DEGXLl1kaCdaTZs29ZkGFK3oRIsWWg7w3A5u4+AZHsg0bvPUq1dPvfLKK1Lh7du3T/ISIj537lypWFE+NGbRwjbwjBa2lzFjRpEzbBOgRRUgXe8rGom28oKWqylTpsj1P2zYMKM1GeKLlm7c+luyZInk4YwZM9Rdd90lLdy1atWS5Xr16iX5iJZviFbPnj3Nm1cdOnSQvzGQc7RqAWwPtG/fXlqzsa5ZtB588EFJxz99jRo1Ui1atJDyBcmDaGEc/wAuXLhQyku4cSuPKVqE2ODWBUe8A/OYBEOslhdzq2S40a1kuNWI58MijVt5TNEixAa3LjjiHZjHJBhitbwMHjzYmhS3uJXHFC1CbHDrgiPegXlMgoHlJfZxK48pWoTY4NYF5wYjRozwmfZ3K8D6jMWNCPQZCTzv5W+f/sAD1+YHswG6EAgn4chja97ECqVLl5aHqfWzfYnl5ZdftibZYi2Luix3797dJx3gAWuUL/OLINcj0HIXjvLiBLgeg2Hbtm3WJB/MD6yHgl1e481FcxcR48ePl7diEfp5QOuLOG7iVh5TtAixwa0LzmnwUGuNGjV80vxJj3W5G2Gt3PyRGNHCQ7ZW0cJDunjbKVyEI4+DPedexC5PnBKtQDsztZZFfV53797tkw7wxiTKFyrrQAj0GMJRXkJl3bp11qQbcr1ORvECBM6nE9idZ7x8gbdVNRAtgIfi8YA+XsgAeFs1HLiVxxQtQmxw64JzGlR4u3btUitWrJDX8yFeWnowD30f4ZVqoCunjh07Sl81eN0ebw1p8Ko30vHGGdJRueENIbx9BKwdUeruAPCWEvaJ5bD+zz//bPzBR0XctWtX6bcJQoY3nYBu0cJDsPo/12+//VbeSgoX4chj5A3e7sTvx7lEx5DoSwjnAb9ddw6JtzWRV5iHt6+KFCmi5syZI3mFdfE6PB4WRuuDfpVed/BYp04dGSIPkD8QDHQWifzHW2Q6/60gf9G3mm4VGj16tNq0aZN044B9NGzYUNbFNseNGyfygk4u8TvMooX96nxev3695DPKIzB3Prljxw75LehLS3c1Ylf5AmsZxbHWrFnTKIu6LOPYsV1UzACdbKJvJpQvLVrWcnv33XfLeUmfPr30jo9yFwjhKC+hgDc6b7vtNhlHXqIbDXRa+vDDD6tRo0apKlWqSJcvKGf4/Z988oksC9HCeX3kkUfk2tW9vLdu3VrKnLmvKzPWPMK+sHyFChVk/v333y/5grxHmbDLa3QrgXL29ttvy7QWLZRftDTqL1Lofrjcxq08pmgRYoNbF5zT5M2bV4aoqPFHFGjRwh9O/JHTr1bryql8+fLSxw5e54cIaDZs2CDpDRo0kHRUiuiodMGCBTIfvXqXKFFCXssGen9o2sc+0Rkm9oXQMnD48GERAr1vyBzQotWtWzep8DTo5DRcuJ3H6FMKQLSyZs1qpONVeQiLPlcA+adBT/76FXv0ZYR8gNhorKKlOxjV+Q4BRl9FyH9UbnofVrC8PgYcKypnDfo/QgWInsPxqr0GUofjs4qWzmcNygYqcL19BIRIdwOgj8mu8gXWMopzgLKsy6JZtMBrr71mtG5ZRctabnH+IbroNFO31ulOMq+H2+UlVNDRKOQI6LyE0KK7FvR7BeGEyOM84rzrfvSQT7h20UeauUwePXpUhv5Ey5pH+McAtxlR7rBNCJje3vz58xPkNcoc1oVE6w50zaKFDlW1QEMWw4FbeUzRIsQGty44p8EfM7QQoNLQr0rrChefzcEfLHzmAujKCb04Yx1UNmbRQk/MSAdIxx9YtF6gckSLgLUjSr2/zz77TPZp7vVd9wx9I9ECbdu2lSEqu5tvvlnGw4HbeYzWRZxPiFayZMmMdFQm5s4hgVW0dGWH79KhEtLiBbRo4Vt2ANIGrKKlP5uk898KWiSA7njSTrRwLOY+0HBc33zzTUCiZe18EqJ1++23y/SNRMtaRlEW0cKhRc0qWjieoUOHyrhZtOw6UNWtuFgHIolyp8v99XC7vIQKrkPduulPtPTfBGAWLVy7+lko9LEGdNn0J1rWPILoorUM30BE3qNVFiDv0dJlzWuUH42WYC1aAPmie5K/9957jXQ3cSuPKVqE2ODWBec0qCzNn9TAH1N9K+6OO+6QFi80y//2229SEeFWESpiVFj41li5cuWMbeH2FNLxuRWk6+dicBsIlekLL7wgnRpOmDBBWqKwP/x3jO8lYp/oGDFbtmw+HxcORLQA5qNzRbsHZt0iHHmMvIFo4ZwjChcuLOloVcmTJ4907AisooVbcGiFwbciIZ+4bYdzi/OkX8fHrSCIS/Xq1WXaKlrI/8aNGxv5j9t4ZlAxYxmdN/5EC+A2EFoftHQFIloAxwipWrZsma1o4XzgNrP5k0DAWkbNZfHPP/80yrIWLSyH8wW0aOH40WJlLbdosUUrKj4PA8lEuQuEcJSXUEF+An+iBenB3wSUC9xmRLnAuca1i8/w4NpFmQNm0Qokj3D7EfmkW1ghX7jlh7wHuuwDPHuVIkUKYxqtZ5Azs2gBdLQK0HoWDtzKY4oWITa4dcG5ASqMWCDYtyJDJRx5jLyBaAX7gVy0FuD5Lbw5h0oSIoNnixCJBfLmRdDqNH36dGty2Ai03IWjvIQKbrXp221OEsk80s9phQO38piiRYgNbl1wbqD/84x29Edsw0U48hh5g1sgeEaFeJNAy104yosT4JZ1LIEH98OFW3lM0SLEBrcuOOIdmMckGFheYh+38piiRYgNbl1wxDswj0kwsLzEPm7lMUWLEBvcuuCId2Aek2BgeYl93MpjihYhNrh1wRHvwDwmwcDyEvu4lccULUJscOuCI96BeUyCgeUl9nErjylahNjg1gVHvAPzmAQDy0vs41YeU7QIscGtC454B+YxCQaWl9jHrTymaBFig1sXHPEOzGMSDCwvsY9beUzRIsQGty444h2YxyQYWF5iH7fymKJFiA1uXXDEOzCPSTCwvMQ+buUxRYsQG0K94LA+w/sRCtZtMWI/QsG6LYY3ww0oWoTY4NYFRwghJL6gaBFiA0WLEEKIE1C0CLGBokUIIcQJKFqE2EDRIoQQ4gQULUJsoGgRQghxAooWITZQtMiNsL6txGAwoj/cgKJFiA1uXXCEEEK8iVt/9ylahNjg1gVHCCHEm7j1d5+iRYgNbl1whBBCvIlbf/cpWoTY4NYFRwghxJu49XefokWIDW5dcIQQe0qXLm1NCgsdOnRQ7777rjE9ZswY1aZNG9MSCfF3rPPmzfOZ7tKliwx//fVX9cEHH/jM0xw/ftyaRCKEW3/3KVqE2ODWBUcIsccqL/v27VO33nqrypo1q0xv2bJFhg888IBasGCBqlWrlszr16+fpGfJkkXlzp1bjR49WqZHjhyp0qVLp+69916ZbtKkiSpQoIDq3Lmzunr1qqQBiFalSpWM6Ro1aohonTx5UjVr1kwVKVLEmFeiRAmVLVs2GYKVK1eqHDlyqMce+/fvhT/RAr1795ah9bjfe+892d6oUaNkumPHjipDhgyqcePGMr169WqVNm1atXPnTmN9nBe9PnEOt/7uU7QIscGtC44QYo9VtI4dOyZCtHnzZrVr1y4RLKCl5sKFCzIvffr0Mg3RApAYtBIdOXJEnThxQj3//POSDtECTZs2VbNnz5ZxANHq1q2bCNrEiRNleYgWJG3//v2yzKBBg3zWSZMmjZowYYKqWbOmTB84cECdPn06gWglSZJEJU+eXIYXL16UNOtxf/nllzKEPOG4T506JS1g+vdWqVJFzoUG6+O86PWJc7j1d5+iRYgNbl1whBB7rKK1YcMGaYFq0KCBiBZaeSBO06dPl/nly5eXeZkyZZJpLVpoYYKwQJ7KlSunqlWrJulatJo3b55AtNatW6eqVq2q6tWrJ61UEK2kSZOqa9euyTLPPfec0VIG0MqFFiXss2TJkhKHDh36f+2dC9xm1bzHk8tpBklRdBlJTRc0mi5ypDQooouRSExMzFRSyrhMNKGIdBNCuk41TBimiG4TXSaT3IpIxEQuuaZO51Sns/mu+fyfs2a9a7/v+4xn+7zq+/18fp/9PPvZt7X22mv99tpr/58hRit6tDBKe++9d/pcHvcdd9yRpmyL4959993TsbBNuOGGG5px48al44r1yZdYXwZHV/W+RkukQlcXnIjUKY3WGmuskaaYIswGPUiYqODyyy9Pv6200rJmrDRaU6ZMSb1D2223XZo/nNGCQw89tJk5c2b6jNGaNm1as99++zU33nhjEttauHBh88ADD6Qeqttuuy09Rrz33nt7jwXbjBYGkUd+UB53jNEKozVnzpxkLEk/+6Ln6v7772/WX3/93voQ68vg6Kre90yJVOjqghORFePuu+9OY5VEuqKrel+jJVKhqwtORFYMBrfHmCiRLuiq3tdoiVTo6oITEZGxSVf1vkZLpEJXF5yIiIxNuqr3NVoiFbq64ERkeA455JA0iPykk04qf+pBOIWcO++8s1myZEkaNF9juG2NBo4nf+swuPrqq8tZrTC4/cwzz2xuv/329MbgzTffnAbYo5z11luvueeee9Lbh8BblrfeemuK73XggQc2++67by+mlgyWrup9jZZIha4uOBFph7fzIIzWhAkTUuDS2bNnJ/Nxyy23pFAMGK3DDjusufjii5vx48c3119/fbPVVlv13izkDT3e1Nt4443Td7ZFvCq2ddZZZ6U3HAlIOnny5PT7hhtumEIwrLXWWs1ll1227GCaZTGseKuQUA8YrVVWWSW9gbj//vun38NoEfcq5sebi7kJwyhFqIj4znHXjBZBUoHjg8iTI488Mr0FyZuIxNySwdNVva/REqnQ1QUnIu1ceumlaYrRIrwCpgjo5QmIj4XRuuuuu9L3XXfddYjR4neMWYSDYFsEIAUCi5ZBQTFykAczJdQCxgroTcJoEQQVIghqmCnMWMwnfETJokWLlvtOwFFCRNSMVoSbwChyrPEZ80gvGESMLRksXdX7Gi2RCl1dcCLSzoUXXpimGK1jjjmmmThxYjN37tzU0xQQrR0jRbgH2GOPPZYzWgQOJcAnhNFiW/fdd1/a1owZM5Jg+vTpaRpBUPMYW/QkxXa23HLLZLToAcOAsR0IozVv3rze/JrRohdq/vz5ve/0TmEQa0Zriy22SNPFixenKb1fxBDLib8VksHSVb2v0RKp0NUFJyLDQy9OPkaLKOmMwSI46DrrrJPmYbT22WefZpNNNkmPD8serYMPPriZNGlSMkb0gOXb4u9vNt100/RfgieccEKzdOnSqtECer0YWzVr1qxktOjZwvSdd955zYIFC9LjvalTpyazFPPD3K222mq97QCPPAlaSjpijFXNaJEWHpmGCdx2221TcFLEI0/STnR4GTxd1fsaLZEKXV1wIjI8/8zA9TBaD2aIHE+Eehk8XdX7Gi2RCl1dcCIyPDEOaUWgl+vBDo8SpRu6qvc1WiIVurrgRERkbNJVva/REqnQ1QUnIiJjk67qfY2WSIWuLjgRERmbdFXva7REKnR1wYmIyNikq3pfoyVSoasLTh48UEaUUg8udYFGS6RCVxeciIg8tNBoiVTQaImIyCDQaIlU0GiJiMgg0GiJVNBoiYjIINBoiVTQaImIyCDQaIlU0GiJiMgg0GiJVNBoiYjIINBoiVTQaImIyCDQaIlU0GiJiMgg0GiJiIiIdIRGS0RERKQjNFoiIiIiHaHREhEREekIjZaIiIhIR2i0RERERDpCoyUiIiLSERotERERkY7QaImIiIh0hEZLREREpCM0WiIiIiIdodESERER6QiNloiIiEhHaLREREREOkKjJSIiItIRGi0RERGRjtBoiYiIiHSERktERESkIzRaIiIiIh2h0RIRERHpCI2WiIiISEdotEREREQ6QqMlIiIi0hEaLREREZGO0GiJVFh67RHNTRftpZRSSjU/u+KAspkYNRotkQpcWM3frldKKaWWtQkriEZLpIJGSymlVCjahBUxXBotkQoaLaWUUqHl2oQ+0WiJVNBoKaWUCg1pE/pAoyVSYchFpZRS6iGrWpsw2seIGi2RCrWLSiml1ENTrW3CKNBoiVRovaiUUko95DRcmzBSz5ZGS6TCcBeVUkqph5ZGbBOGQaMlUmHEi0oppdRDRkuvmZXaheHUhkZLpIJGSymlVF9qQaMlUkGjpZRSqi+1oNESqaDRUkop1Zda0GiJVNBoKaWU6kstaLREKuRG61mbT2wePX5c8+H3Hzz0wvqHdtnpuUPmoR8uOX/IvEHopA+/rXnrga8ZMn84HTSzbhz73c6/QlttsdmQeeiGaz+Xpl/5/ElDfkORlrt/d9UKp+uvv/5G84Q1VhsyP36LY/v+NfOG/D4a7bnHC5pHPOLhzZpPXL058E2vTNtE/Pbwh6+cflt/wtrpO+WH72jypE1629j3NS9r/ucPi5uHPexhaZ0J6z6p+e87FqffOPZY59MfPTzNW/i5E5rVHvfY5hmbPa154K/Xpf2ttNJKzQuev01ajs+xDsuxzXHj/qO54qufHnL8oRXN33+1Rjqf8XndddYc8nsuztsXzjl2yPx/Rl/+7PFD5g1S8874wJB5iPpsNOV3ww3W633ea+qL0vR//3JdqgvLZc897agh83LddtNXm1e+/IW971HmKGtvnrFX2m65TpfKz/1A1YJGS6QCRutPSxc1j1v1Mb2L6Otf+lia/uKHFzSPX23V5olPeHz6TqVBI3b5hZ9sHvPo8c3Tnrpu88dfXt489SlrN6955YvT/EnPnJjmU7l+/Lh3NFtP3iw1tr/68UW9beQXLBU/+/6v31+dvu/8guekhvG6b8ztGa0X7rhNb/nLLjglTb947rHN7352SarE4jcqsde9epdmj5c9v9n1Jdsvt59oMDfe6CnNH35xWfOqV+yUGqbzTj86zeczIi27v3SHVOHSWG+68VPT8bFebGvihhOaqbtNSduhYXr/u/dvnvykJ/QqUdLAtkgDJuK5205KebDt1s9c7pgwM/n6B7xxz/SZY7j6ktOXM1pLb/pKypedpmzbvHrPndK83GhFuvbf7xXNk9Zao5l76vt76SKPOSd8P/FDh6XvH3rfW9Jv5TlGpdF60+tfnhoPlmX/+bInHLNse5zrPG2kKz6/4bW7LWe0rr/ynN5vnz3jg8sZddL521suTp/j3OTbeuxjxjc3ffvzy5kK8osGMDeuM6dP7RmtmBfGDmG0Yr/vfvv0VB7it1yl0YqyT/nmWOOcM68s/2yf64Jzv+grn1ou/947e0Zary3/2srjjd+a3/znszdvnr3VM3rL5ucTI0oZwGTE73lju87aazZHvPONyVxgqFh+rTVXT2X8nt9fk/L6fYfPTMuxHdYhTZFmvr9ox2envOQaZH3KR6yfp4H5z3z6hs073jotfSftlLVIe9t18YrdpzRbPmvTZrvnPKv56fcWNEcfcWDvt/e8Y7/mqotPS9vlfFMW2AblukxLGK0ov3m9le/vKes9OZl00rPZJhuk6/aTJ85O+YxxIl+59liWcsbxccy1G0xuFPJzs8oqj+p9ftmLn7dcWjjnm0xcP+UJ1yuf45o/+SNvbzZYf51e3nFspK2s7ziePK/K8xHn/m+/ubL52D/2l5dR5pdltExPq1rQaIlUwGhduvCUZvNnbDTkYnr9Prumi/XH138hNX5xkVPJ3v/nJc05n1nWmGMKYv4Zp8xJ82n4qUi+c9W56eKngmSZb1x0am/7v//5JWnbVAKnnvzuNI8GgwqdxmM4ozVt75emaVnx8P17V89LjUGeFrZzycJPpMaO76SN3pLVH79q+k5l+n93frs57KB9miVXnJ0qOXo6aKjv+9O3mou//PF0vD/7wZdTRTzjDVNTBUXDRKPFb3FspIFGkTRQkbENto2Jyo8pjFasT0XK/Mij3GjtsN3k5m1veW3ztQUnNyuvvHKaF0YrTxeNMucM4xbp4lx982unpvRiwn503fmp0eO38hyzTmm02DfrsiyVeL4sx8/28/MQ85liqjiWmtE6/+wPpXOVN1hvP2Raz7zE8rnRmrLD1smAhdHi3NDjhZGnUSPv7v3jtb31R2O0rvz6Z5qNnjah91uu0mhF2Q/jfc2lZ6QpZbQs/2yfMsy5pyHM84+eNNbL8488jv20lUfKCtfK2Z9+X0o78/LzOfttb0hl4Jbvf6n51qKz0rZyo0V+sE3K8/hxqzRnfeq9yaD/+bZFyfRyPNxIcAMV1wZpytOMif383A+n8s36GJpYP8+r7Z87ufn5DQt7vWiknbJG2ik/bdcF8zGBGD5MRGm0nr7pBin9nJt99npJ7/cyLWG0ovyW9VaIntN3Hfb6dKNzyAF7p+0xj7x8zjabp2uZOol8xNhgejg2jiPfDkZn7Sc/MZ3zmBdGi3RyfX/7m3N7v1E/YuR+89OvpxtDyj3HyrnhfFMvkocsS33H97K+43jyvCrPB8dMOYn6MC+jfC/LaJ6eYdWCRkukAkaLHqzcaNGAc3FiKLij3m2X7ZuffOeLvYucC5VKhl4dvofRYn709tCg53fpbY/06PGiMqLCoZGkxyw0nNG649ZL07SseHhMxeeyh4DtcIdOhUL6mDIfU8Q0Gu7YPo0ilVbee0MFPOvg1/W+c9w0TNHAUOGVaaAiiwaKPMyPKYxWrB89VTWjlZsEGiymYbQiXYg78tg3y+Q9PzSepInPt9/8tV6vW36O+S03WmyHhpnPLLvNlk9fbtkwXJzv2A/KzVFsszRaoVrPQH53nW+LnoXcaNV0640XpDSN1mjRQzJaoxVlP9K7xaSNU+NNY1mW/zxd5GOef2Fi8vzj/MTybeVxx+236i1DeYu8ifOJCY8yEDc3udHKyzOmAoOPEXr+87ZsPnXS4Wl7GGB+j22TpjzNlD+MwCknvCutj7GL9WPb6Jc/ujBNo2eStHNeSDvlp+26yB+90ftSGi0erb905+3S9rhW4vcyLRiOvPyW9VaImxTMH714XFM8MnzkIx/R3PXbK9P8uJ7o9cofHXJs5AXml95Ner/pceU8nPnJI9MyudHicwwLQHkdld+scvz0suXXcVt9Vx5PeT4499wQhtnNyyjfyzIan0dUCxotkQoxRuuDR7453TnTG8BFzrw1Vn9cmlKhU0HEXTeNFBc5FTW/RyXBfB5DMp/KtGa0YlnE3d0PFn+211vCnSOVAwaDbYXRolLgt69+4aO9hicapWiw6GLnmGI/NaPFlAqHu+r9pu2ezGSksa1ho6FmuzT8v/7JRemulV4Y7n55nENj9Lkz/99oRRpYJxpzHgnwe9mghNGK9cNoxaPb3GhRcZJGGhbGezAvf3QY6eJOvOzRim2QZ8y/+bsL0mMMGt3yHPO57NFiHzwuYVkePeTL8viW6aCNVt7YxrZouKOBKI0WZYO0UZbIF8zGaIwWecXn7151XuoxCAMeyo0Wj+2i7Ee541F1pL0s/2UjludfHFeef6MxWjzyobFkXBJppTzk55NySRmg5zUMe9mjRTmiPPPIivPKfMomj6vI6xijxWfSTJryNL/z0H1TrxyP4Vh/zrve1Fs/9oMwhfQ0Rr6T9jgGyk/bdcHvmBrqJG4A2S7nlJsxjNaqj310s+C8jySTwbbDaJVpiR6tKL9lvZWLPItenmPee1DqWeUz5411uBYxXuzzgvnLji1/RIjo5Y7P1JX0ruWPDum1Ou3jR/S+txmt+Wcdk0wTvVL0VDK/rb7jePK8Ks9HnHvKNY8O8zLK/LKMxucR1YJGS6RCGC0uRO7IeJxw7FHLBsMzboC7Tiodep4Y+0SDfvD+r04VwemfmJMeZ1Eh0AAyn8aE+YxVqBmtcowWDQoXP3fkfKfrnAueSjmMFj0BVDBUzKXR4hEC63NsozFaGBYqZhpyGqaoXNsaNhpAlA+Y5Y7w5bvumO4yS6MVaaARIw0rYrTYH70sudHCZNBw8egsetVyoxXpouFnvMVHj52V5pdG6/gPHprOIWNQqNTLc8xypdHi/JL/LMux5ct2YbT4PXoaEb00j3rUI5v11l2rNw6oNFqI/GJsCunHaIxktNgm5T0Gw/OoLX98hzC1NJbRYEbZp3xT9jl3sY+y/JeNWJ5/PH5jfr9GixsTHmfRmxPL5ufzztu/mcoAvTPxe260KLs8bqNM8ogKg8lLBjTQPPYqjRZT0pSnmbLBOuyT9ak3Yn16dmJf01+3W+pBCgNGGilrpJ3y03ZdMMYR40g6MXQYA84pZRCjRY8bPWMYKR77cv6O+8Bbh6QljFaU37LeyvdJD1TUQQx3iGuPY+NaDhOCseFxHtc4j0XzbWD24zNjyLjhyo0WPWv0xMX3NqNFXcy1TBnghpD5bfUdx5PnVXk+frhkfm8fbC8vo+RBWUbj84hqQaMlUsHwDsMrutyVqgnD/oE5y3pU1GD02lftMmSeqmuktyA7UwsaLZEKGq3hRbd8OU+pEL2M9JiU89WK69rLzxwyT9UV4+D+5WpBoyVSQaOllFKqL7Wg0RKpUBqtfDzHoJTH9OlH8Zp/TSMFQSzDDfQrxnas6HEPp5Hy94377jFkHvlQu8tnW4zXKOePJTEguByDNVoxXmqkRyMj5Wcu3sZiSjgMxuQw9odBxAwmZ355vsl3Bl2zHo8HebuTAc2M4Yk380odOXtGGptHXLi999y5F2qifHuR8TsMvmecIGPtYn6M92Lfsa5SY04taLREKoTRIuAfAzFjEDIDWBlwytstMVA+D9zJG00MLOXNOxqsWnBSBsISbiHizbAOA2JZnu+8pcPyvO7OdwbX5sFL8waIN47yYKZhtGjEGcRMw8RgT4IxMp8Gi4Yq9hkRn3ljigGpHG/sP443D6hYGi2CbsZnBrXyWjdxcRh0GoEeya88cCmDhxn4XAYDZRoBBMt8xGiRjwze/cuvrujlQwxUzY8xjFZsi9/z4JLkTRkUMgKi8nYax8l5Zz5BO8tgh3HM5BXpY78Mys4DK+b5wHcG8bP/GEzPchwHcYo4hnjzDGFaSBfnKQ/ySt4zuJ+4QGWASAYJR9gCppGf5HUtIGMuYhFRlstQDhHctjRaxJdjykBlBpFT9hdftixuVu3NNQZH83p/Po+XD5iWRovzwpTQJRHZnIHk+SB2wieU+1BqTKgFjZZIBYwWb+pxJ84FFG+/xABfGgEavAgpgOgNiAB4hDzgrbDyDcN4c4leCeLS8JZLrMPymAPelOH7J45/ZzITNPDxFysoN1q80h2NP40eRgIDR8PPPN484g2kWJ4erXyfHCf7jF4Njjf2H28qsm/MB/sqjRbrcjy8zRZ/78J8GsyIPxTLkvYITEg4iPzNN9ZjsG+8AVfmY96jFY1ubrTyY2RbTPO36TAS5FPEceLNOuYT1JIpQRiZMoib48QYkCaWJ41sk3EfeUwk8ioip0eexT7zfGDK21j0YsW6YbR4NZ435mpvNmFQ8nNL3mPq+B49WsSqYl7NaJGfEZaBfORzGZQSEdIAsY98PgFPiWdVGq34Kyr2nZ9D8i4vmyFeq89f8UdxY1IarQhYisHFuEdIgXgTD2FYy30oNSbUgkZLpAJGC5OQB7JkmgfMo7ehDNxJ70P8jkqjlX+nB4EemHwdAjzGK+7RqBNxOYKX8j1vzPLAgQijxevJGA1+p3EliOJbZr4q9ZBgtGr7zAOaxv7DaOUBFUujhRgYz2vkfMaw8UYi260Zrehxo3euNFp5AMEyH3OjRdBEprnRyo8xwhfkb0bmwSUxOGVQyDw4KseJ0SNNPBYrgx3GNsmr+DuWiB4dRivPB74TH4lzFeEHwmjxmWksl6sM8kreEweL38qAjDWjRX4S24h5ZUDGXAQyxdSV/2GH2aT8cL6Jc0QoDx4Nxr8VMNg9HkWzn9I0hTD25f+B8uo9U9YhzlGECeHVe6a8bn/Uew5INzPclORGi+PKexaVGjNqQaMlUgGjRUPHIy96S6JhoFHDmPCoir93KAN38jiKcUM0drx5VRotGkCMCQ0jPQaYJ9bBBEV062i8adTpAYqAk9FLlRutMDQRzDSMDMaQhvkjRx+SPvPICtNIw5jvMxrnPM5W7D/m5QEVa0YLsxnxjei9YEpMmgj0GMthYNjnheefmIxdabSYRgDBMh8xWvx9CgaNx20smxut/Bjj0WFsqwwuWYvhlcfs4jjpzSJN9NqUwQ7jmIczWnk+0NOH8WVbYZBGMlqc7zLIK3kfy5UBIjkuTFwErywfHZYBGXNFL9dFXzw5bZeYU5SbiP1Unu8o7/TmxV+ufGnecemYSSPLxF8fhQ6fNT31rLIMjypjudKc8ViQgLnkPb19MT83WsRiYhp/86PUmFELGi2RCuVg+DYZT2qZyRhtuAcaWoIM0kuX/4XQiqo0KIPUaNP0766+/sttlMKolfMGpfh7HqXGnFrQaIlU0GiNTvRM0FuSjyEbSUSQ5lHSIGLdxGD2QYtI0v2k6d9Z5Z8eD0LxIsWgxZuN5Tylxoxa0GiJVBit0VJKKaWSWtBoiVTQaCmllOpLLWi0RCpotJRSSvWlFjRaIhU0WkoppfpSCxotkQoaLaWUUn2pBY2WSAWNllJKqb7UgkZLpIJGSymlVF9qQaMlUkGjpZRSqi+1oNESqaDRUkop1Zda0GiJVNBoKaWU6kstaLREKmi0lFJK9aUWNFoiFTRaSiml+lILGi2RChotpZRSfakFjZZIBY2WUkqpvtSCRkukwtJrj0hmSymllBqN2tBoiYiIiHSERktERESkI/4OUp/0VKMDUnIAAAAASUVORK5CYII=>