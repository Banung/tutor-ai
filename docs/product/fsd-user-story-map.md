# Pemetaan FSD → user story → acceptance criteria → implementasi

Tanggal: 14 November 2026. Acuan: **FSD Tutor AI v0.5, 6 November 2026, status Draft**, bagian 5.1, 5.2 dan 9. Ini dokumen turunan untuk diskusi, bukan revisi atau persetujuan FSD.

- Sumber primer yang dibaca: [FSD versi teks](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/FSD Tutor AI - Revisi Bahasa.txt>).
- Dokumen asal: [FSD Revisi Bahasa DOCX](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/FSD Tutor AI - Revisi Bahasa.docx>).
- Analisis terdahulu: [gap FR](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/research/analisis-gap-fr-tutor-ai.md>), berbasis kode 8832f46. Status di sini memperhitungkan perubahan AI dan feedback terbaru.
- Cakupan pemeriksaan kode: branch lokal `feat/lecturer-answer-corrections`, termasuk run tracking commit `394bef9`, feedback mahasiswa commit `86c4871`, review dosen commit `0636d72`, dan implementasi koreksi berversi. Tidak mengaudit branch `feat/admin` yang terpisah.
- **Sebagian** berarti ada implementasi namun masih ada gap; bukan lulus UAT. **Belum ditemukan** dibatasi ke branch/area yang diperiksa. Tidak ada klaim seluruh FR telah diterima.
- User story adalah parafrasa. AC di bawah disalin dari bagian 9 FSD. Prioritas mengikuti FSD, bukan urutan delivery backlog.

## Ringkasan user story

| FR / AC | Pengguna | User story | Prioritas FSD | Status lokal |
|---|---|---|---|---|
| FR-001 / AC-001 | Admin | Sebagai admin, saya ingin mengelola profil mata kuliah, agar katalog kampus lengkap dan mudah dipelihara. | Wajib | Sebagian |
| FR-002 / AC-002 | Admin | Sebagai admin, saya ingin menampilkan atau menyembunyikan mata kuliah tanpa menghapus interaksi, agar katalog hanya menampilkan layanan yang ditawarkan. | Wajib | Sebagian |
| FR-003 / AC-003 | Admin | Sebagai admin, saya ingin mencari akun berdasarkan identitas akademik dan menetapkan peran, agar pengguna memperoleh akses yang sesuai. | Wajib | Sebagian |
| FR-004 / AC-004 | Admin | Sebagai admin, saya ingin membekukan akun bermasalah dan memutus sesinya, agar akses tidak wajar dapat dihentikan tanpa menghapus data. | Disarankan | Belum ditemukan |
| FR-005 / AC-005 | Admin | Sebagai admin, saya ingin mengambil data prodi, mata kuliah dan dosen dari SIAT/PIPP atau berkas impor, agar data kampus konsisten tanpa duplikasi. | Wajib | Belum ditemukan |
| FR-006 / AC-006 | Admin | Sebagai admin, saya ingin menetapkan dosen pengampu dan menghubungkan modul yang tervalidasi, agar setiap mata kuliah memiliki pengelola dan konten yang sesuai. | Wajib; bagian AR perlu klarifikasi | Sebagian; AR ditunda |
| FR-007 / AC-007 | Admin | Sebagai admin, saya ingin melihat penggunaan agregat serta mengekspor laporan per periode/prodi, agar pemanfaatan platform dapat dipantau tanpa membuka identitas pribadi. | Wajib | Sebagian |
| FR-008 / AC-008 | Dosen | Sebagai dosen, saya ingin mengunggah, mengaktifkan dan menonaktifkan materi mata kuliah, agar tutor hanya memakai bahan ajar yang disetujui. | Wajib | Sebagian |
| FR-009 / AC-009 | Dosen | Sebagai dosen, saya ingin mengatur identitas, sapaan, topik dan batas jawaban tutor pada mata kuliahku, agar perilakunya sesuai tujuan pembelajaran. | Wajib | Belum lengkap |
| FR-010 / AC-010 | Dosen | Sebagai dosen, saya ingin membagikan dan mengganti kode kelas, agar akses peserta baru terkontrol tanpa mengeluarkan peserta lama. | Wajib | Sebagian |
| FR-011 / AC-011 | Dosen | Sebagai dosen, saya ingin menautkan modul AR tervalidasi dan petunjuknya ke mata kuliah, agar peserta dapat menemukan praktikum yang relevan. | Di luar tahap ini | Ditunda |
| FR-012 / AC-012 | Dosen | Sebagai dosen, saya ingin melihat partisipasi dan topik populer per periode pada kelasku, agar dapat mengenali kebutuhan belajar mahasiswa. | Wajib | Sebagian |
| FR-013 / AC-013 | Dosen | Sebagai dosen, saya ingin meninjau jawaban ber-feedback negatif dan menyimpan koreksi, agar jawaban serupa berikutnya dapat diperbaiki. | Wajib | Implementasi koreksi lokal; belum UAT model nyata |
| FR-014 / AC-014 | Mahasiswa | Sebagai mahasiswa, saya ingin mencari dan menyaring katalog mata kuliah yang dipublikasikan, agar dapat menemukan kelas yang relevan. | Wajib | Sebagian |
| FR-015 / AC-015 | Mahasiswa | Sebagai mahasiswa, saya ingin bergabung melalui kode atau tautan valid, agar kelas terhubung ke akunku tanpa pendaftaran ganda. | Wajib | Sebagian |
| FR-016 / AC-016 | Mahasiswa | Sebagai mahasiswa, saya ingin bertanya dan melanjutkan percakapan yang menyertakan dokumen/halaman sumber, agar dapat memahami sekaligus memeriksa jawaban. | Wajib | Sebagian; diperkuat PR AI |
| FR-017 / AC-017 | Mahasiswa | Sebagai mahasiswa, saya ingin membuka, mengganti judul, menghapus, menandai percakapan dan menambah catatan pribadi, agar dapat melanjutkan belajar. | Wajib | Sebagian |
| FR-018 / AC-018 | Mahasiswa | Sebagai mahasiswa, saya ingin memberi atau mengubah penilaian dan catatan atas jawaban, agar jawaban yang kurang membantu dapat ditinjau dosen. | Disarankan | Kode mahasiswa + antrean dosen lokal; belum UAT |
| FR-019 / AC-019 | Mahasiswa | Sebagai mahasiswa, saya ingin membuka modul AR yang tersedia dari kelas, agar dapat mengikuti materi praktikum melalui aplikasi AR yang sesuai. | Di luar tahap ini | Ditunda; spesifikasi konflik |
| FR-020 / AC-020 | Mahasiswa | Sebagai mahasiswa, saya ingin melihat skor dan kesalahan setelah latihan AR, agar dapat memperbaiki langkah praktikum. | Di luar tahap ini | Ditunda |
| FR-021 / AC-021 | Mahasiswa | Sebagai mahasiswa, saya ingin melihat kelas, aktivitas pribadi dan saran belajar, agar tahu aktivitas serta langkah belajar selanjutnya. | Disarankan | Sebagian |
| FR-022 / AC-022 | Mahasiswa dan dosen | Sebagai mahasiswa dan dosen, saya ingin menerima notifikasi materi baru dan pengingat sesuai preferensi, agar tidak melewatkan kegiatan belajar. | Disarankan | Belum lengkap |
| FR-023 / AC-023 | Mahasiswa dan dosen | Sebagai mahasiswa dan dosen, saya ingin mendapat jawaban dari materi aktif atau pemberitahuan bahwa bukti belum cukup, agar informasi yang tidak didukung tidak disajikan sebagai fakta. | Wajib | Sebagian; diperkuat PR AI |
| FR-024 / AC-024 | Dosen dan admin | Sebagai dosen dan admin, saya ingin menyiapkan pertanyaan/jawaban acuan, menjalankan uji dan melihat kasus gagal per versi materi, agar kualitas tutor dapat dievaluasi. | Wajib | Sebagian; tooling pengembang |
| FR-025 / AC-025 | Mahasiswa | Sebagai mahasiswa, saya ingin bertanya melalui teks/suara dan mendengar avatar menjawab, agar bisa belajar lewat interaksi bersuara dengan fallback teks. | Wajib tahap 2; sesudah tahap 1 stabil | Sebagian; tahap 2 |
| FR-026 / AC-026 | Dosen | Sebagai dosen, saya ingin melihat progres pemrosesan materi dan mencoba ulang kegagalan, agar tahu kapan materi siap digunakan tutor. | Wajib | Sebagian |
| FR-027 / AC-027 | Mahasiswa dan admin | Sebagai mahasiswa, saya ingin mendapat penjelasan sesuai S1/S2/S3 agar kedalamannya sesuai kebutuhan belajar; sebagai admin, saya ingin mengatur panduan tiap jenjang dan mode agar gaya tutor konsisten. | Wajib | Sebagian; implementasi tersedia |

## Detail acceptance criteria dan gap

### FR-001 · Mengelola katalog

**User story:** Sebagai admin, saya ingin mengelola profil mata kuliah, agar katalog kampus lengkap dan mudah dipelihara.

**AC-001 — FSD asli:** Jika admin membuka formulir katalog, saat admin menyimpan data lengkap dengan kode unik, mata kuliah tersimpan dan tampil pada daftar katalog.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** CRUD course tersedia; prodi/fakultas, kode MK unik, capaian pembelajaran, validasi lengkap dan arsip yang menjaga riwayat belum lengkap.

**Bukti / area kode:** [src/lib/services/course.service.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/services/course.service.ts>).

### FR-002 · Mengatur publikasi

**User story:** Sebagai admin, saya ingin menampilkan atau menyembunyikan mata kuliah tanpa menghapus interaksi, agar katalog hanya menampilkan layanan yang ditawarkan.

**AC-002 — FSD asli:** Jika mata kuliah berstatus ditampilkan, saat admin menonaktifkannya, mata kuliah hilang dari katalog publik tanpa menghapus data interaksi.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Toggle isActive tersedia; pemeriksaan kelengkapan, audit dan pemisahan publikasi dari akses peserta lama belum lengkap.

**Bukti / area kode:** [src/lib/services/course.service.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/services/course.service.ts>).

### FR-003 · Mengelola akun dan peran

**User story:** Sebagai admin, saya ingin mencari akun berdasarkan identitas akademik dan menetapkan peran, agar pengguna memperoleh akses yang sesuai.

**AC-003 — FSD asli:** Jika admin mencari akun berdasarkan NIM, saat peran diubah dan disimpan, peran baru berlaku dan tercatat pada log audit.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** CRUD/role tersedia; audit perubahan, identitas dosen, dan proteksi perubahan role sendiri perlu dilengkapi dan diuji.

**Bukti / area kode:** [src/lib/services/user.service.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/services/user.service.ts>).

### FR-004 · Membekukan akun dan memutus sesi

**User story:** Sebagai admin, saya ingin membekukan akun bermasalah dan memutus sesinya, agar akses tidak wajar dapat dihentikan tanpa menghapus data.

**AC-004 — FSD asli:** Jika akun terindikasi spam, saat admin membekukan akun, pengguna tidak dapat masuk dan seluruh sesinya diputus.

**Status:** Belum ditemukan. **Prioritas FSD:** Disarankan.

**Gap / pekerjaan berikutnya:** Autentikasi tersedia, tetapi tidak ditemukan model pembekuan dan alur freeze/unfreeze/force logout khusus.

**Bukti / area kode:** [src/lib/auth.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/auth.ts>).

### FR-005 · Sinkronisasi akademik

**User story:** Sebagai admin, saya ingin mengambil data prodi, mata kuliah dan dosen dari SIAT/PIPP atau berkas impor, agar data kampus konsisten tanpa duplikasi.

**AC-005 — FSD asli:** Jika endpoint SIAT tersedia, saat admin menjalankan sinkronisasi, data prodi, MK, dan dosen tersimpan tanpa duplikasi.

**Status:** Belum ditemukan. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Konektor, identitas eksternal, preview/pemetaan, konfirmasi dan log sinkronisasi belum ditemukan pada branch ini. Branch admin terpisah tidak diaudit di sini.

**Bukti / area kode:** [prisma/schema.prisma](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/prisma/schema.prisma>).

### FR-006 · Memetakan dosen dan modul

**User story:** Sebagai admin, saya ingin menetapkan dosen pengampu dan menghubungkan modul yang tervalidasi, agar setiap mata kuliah memiliki pengelola dan konten yang sesuai.

**AC-006 — FSD asli:** Jika MK dan modul AR tervalidasi tersedia, saat admin menyimpan pemetaan, relasi MK–dosen–AR tampil pada detail MK.

**Status:** Sebagian; AR ditunda. **Prioritas FSD:** Wajib; bagian AR perlu klarifikasi.

**Gap / pekerjaan berikutnya:** Relasi banyak dosen per course tersedia. Pemetaan AR belum tersedia; AC-006 masih meminta AR sehingga tidak bisa ditutup hanya dari assignment dosen.

**Bukti / area kode:** [src/app/api/admin/courses/[id]/instructors/route.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/app/api/admin/courses/[id]/instructors/route.ts>).

### FR-007 · Melihat penggunaan dan laporan

**User story:** Sebagai admin, saya ingin melihat penggunaan agregat serta mengekspor laporan per periode/prodi, agar pemanfaatan platform dapat dipantau tanpa membuka identitas pribadi.

**AC-007 — FSD asli:** Jika data aktivitas tersedia, saat admin mengekspor laporan periode tertentu, berkas CSV/PDF terunduh dan sesuai filter.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Statistik jumlah dasar tersedia; filter akademik/periode, tren dan ekspor CSV/PDF lengkap belum ditemukan.

**Bukti / area kode:** [src/app/api/admin/stats/route.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/app/api/admin/stats/route.ts>).

### FR-008 · Mengelola materi sumber

**User story:** Sebagai dosen, saya ingin mengunggah, mengaktifkan dan menonaktifkan materi mata kuliah, agar tutor hanya memakai bahan ajar yang disetujui.

**AC-008 — FSD asli:** Jika dosen mengunggah PDF 10 MB, saat dosen mengaktifkannya, dokumen menjadi basis pengetahuan dan teksnya terekstraksi.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Upload dan pipeline PDF tersedia; jangan menyamakan konten text/link dengan dukungan RAG yang setara. Versi materi, format dan ukuran perlu diselaraskan.

**Bukti / area kode:** [src/app/api/dosen/courses/[id]/sessions/[sessionId]/materials/route.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/app/api/dosen/courses/[id]/sessions/[sessionId]/materials/route.ts>).

### FR-009 · Mengatur tutor per mata kuliah

**User story:** Sebagai dosen, saya ingin mengatur identitas, sapaan, topik dan batas jawaban tutor pada mata kuliahku, agar perilakunya sesuai tujuan pembelajaran.

**AC-009 — FSD asli:** Jika pembatasan topik aktif, saat mahasiswa bertanya di luar materi, asisten menolak dengan sopan tanpa mengarang jawaban.

**Status:** Belum lengkap. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Prompt global per jenjang/mode sudah ada, tetapi bukan konfigurasi course milik dosen. Nama/topik/toggle dan versi konfigurasi per course belum ditemukan.

**Bukti / area kode:** [src/lib/services/tutor-prompt.service.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/services/tutor-prompt.service.ts>).

### FR-010 · Membagikan dan merotasi kode

**User story:** Sebagai dosen, saya ingin membagikan dan mengganti kode kelas, agar akses peserta baru terkontrol tanpa mengeluarkan peserta lama.

**AC-010 — FSD asli:** Jika kode kelas aktif, saat dosen mengganti kode, kode lama tidak berlaku bagi pendaftar baru dan mahasiswa lama tetap terdaftar.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Enrollment key tersedia; rotasi kode, tautan enroll, kedaluwarsa dan audit perlu dilengkapi.

**Bukti / area kode:** [prisma/schema.prisma](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/prisma/schema.prisma>).

### FR-011 · Menautkan AR

**User story:** Sebagai dosen, saya ingin menautkan modul AR tervalidasi dan petunjuknya ke mata kuliah, agar peserta dapat menemukan praktikum yang relevan.

**AC-011 — FSD asli:** Jika modul AR tervalidasi, saat dosen menautkannya ke MK, modul tampil pada ruang belajar mahasiswa kelas tersebut.

**Status:** Ditunda. **Prioritas FSD:** Di luar tahap ini.

**Gap / pekerjaan berikutnya:** FSD bagian 5.1 menempatkan fitur AR di luar tahap ini. AC-011 tetap ada; jangan menjadikannya syarat rilis awal tanpa keputusan scope baru.

**Bukti / area kode:** [prisma/schema.prisma](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/prisma/schema.prisma>).

### FR-012 · Melihat aktivitas kelas

**User story:** Sebagai dosen, saya ingin melihat partisipasi dan topik populer per periode pada kelasku, agar dapat mengenali kebutuhan belajar mahasiswa.

**AC-012 — FSD asli:** Jika kelas memiliki aktivitas, saat dosen membuka dashboard, partisipasi dan topik populer tampil sesuai periode.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Statistik dasar dan daftar mahasiswa tersedia; analitik percakapan/topik, filter dan ekspor belum lengkap.

**Bukti / area kode:** [src/app/api/dosen/stats/route.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/app/api/dosen/stats/route.ts>).

### FR-013 · Mengoreksi jawaban

**User story:** Sebagai dosen, saya ingin meninjau jawaban ber-feedback negatif dan menyimpan koreksi, agar jawaban serupa berikutnya dapat diperbaiki.

**AC-013 — FSD asli:** Jika terdapat jawaban dengan umpan balik negatif, saat dosen menyimpan koreksi, koreksi menjadi acuan jawaban berikutnya.

**Status:** Implementasi koreksi lokal; belum UAT model nyata. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Antrean/review FB-04 serta draft, persetujuan, pencabutan dan retrieval koreksi berversi FB-05 sudah dibuat. Pengujian PostgreSQL nyata dengan provider stub memverifikasi pemakaian versi di service tutor/run; kualitas jawaban dan pertanyaan variasi dengan model nyata belum diuji. Lihat docs/ai/answer-corrections.md; AC-013 belum dinyatakan lulus UAT.

**Bukti / area kode:** [src/lib/tutor-ai/feedback.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/tutor-ai/feedback.ts>).

### FR-014 · Mencari mata kuliah

**User story:** Sebagai mahasiswa, saya ingin mencari dan menyaring katalog mata kuliah yang dipublikasikan, agar dapat menemukan kelas yang relevan.

**AC-014 — FSD asli:** Jika katalog memiliki mata kuliah ditampilkan dan arsip, saat mahasiswa mencari kata kunci, hanya mata kuliah ditampilkan yang muncul.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Pencarian course aktif tersedia; metadata/filter akademik dan perilaku katalog publik belum lengkap.

**Bukti / area kode:** [src/lib/services/mahasiswa.service.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/services/mahasiswa.service.ts>).

### FR-015 · Bergabung ke kelas

**User story:** Sebagai mahasiswa, saya ingin bergabung melalui kode atau tautan valid, agar kelas terhubung ke akunku tanpa pendaftaran ganda.

**AC-015 — FSD asli:** Jika mahasiswa memiliki kode valid, saat bergabung ke kelas, kelas terhubung dan tampil pada beranda tanpa duplikasi.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Enrollment melalui kode dan unique course/user tersedia; tautan, semester dan UX sudah-terdaftar perlu diselaraskan.

**Bukti / area kode:** [src/app/api/mahasiswa/courses/enroll/route.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/app/api/mahasiswa/courses/enroll/route.ts>).

### FR-016 · Bertanya dengan sumber

**User story:** Sebagai mahasiswa, saya ingin bertanya dan melanjutkan percakapan yang menyertakan dokumen/halaman sumber, agar dapat memahami sekaligus memeriksa jawaban.

**AC-016 — FSD asli:** Jika Tutor AI aktif dengan dokumen aktif, saat mahasiswa bertanya, jawaban memuat sitasi dokumen/halaman.

**Status:** Sebagian; diperkuat PR AI. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Chat, streaming, follow-up retrieval, sitasi, histori dan penanganan gagal tersedia. Akurasi live belum diukur; limit 8000 berbeda dari FSD 1000, rate limit 20/menit belum ditemukan khusus.

**Bukti / area kode:** [src/lib/tutor-ai/service.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/tutor-ai/service.ts>).

### FR-017 · Menyimpan riwayat dan catatan

**User story:** Sebagai mahasiswa, saya ingin membuka, mengganti judul, menghapus, menandai percakapan dan menambah catatan pribadi, agar dapat melanjutkan belajar.

**AC-017 — FSD asli:** Jika mahasiswa memiliki riwayat, saat menandai penanda dan menambah catatan, keduanya tersimpan dan dapat dibuka kembali.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Riwayat/rename/delete tersedia; bookmark dan catatan pribadi belum ditemukan. FSD Wajib, walaupun backlog delivery menaruh bagian tambahannya belakangan.

**Bukti / area kode:** [src/app/api/courses/[courseId]/tutor/sessions/[sessionId]/route.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/app/api/courses/[courseId]/tutor/sessions/[sessionId]/route.ts>).

### FR-018 · Memberi feedback jawaban

**User story:** Sebagai mahasiswa, saya ingin memberi atau mengubah penilaian dan catatan atas jawaban, agar jawaban yang kurang membantu dapat ditinjau dosen.

**AC-018 — FSD asli:** Jika jawaban asisten tampil, saat mahasiswa menekan jempol ke bawah, umpan balik masuk ke daftar koreksi dosen.

**Status:** Kode mahasiswa + antrean dosen lokal; belum UAT. **Prioritas FSD:** Disarankan.

**Gap / pekerjaan berikutnya:** Model/API/UI mahasiswa serta antrean feedback negatif dosen telah dibuat. Status, peninjau dan riwayat perubahan tersedia; migration dan UAT database belum dijalankan sehingga AC-018/BR-040 belum dinyatakan lulus.

**Bukti / area kode:** [docs/ai/student-feedback.md](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/docs/ai/student-feedback.md>).

### FR-019 · Membuka AR existing

**User story:** Sebagai mahasiswa, saya ingin membuka modul AR yang tersedia dari kelas, agar dapat mengikuti materi praktikum melalui aplikasi AR yang sesuai.

**AC-019 — FSD asli:** Jika perangkat mendukung Web-AR, saat mahasiswa memilih Mode Pandu, modul termuat dengan panduan langkah demi langkah.

**Status:** Ditunda; spesifikasi konflik. **Prioritas FSD:** Di luar tahap ini.

**Gap / pekerjaan berikutnya:** Detail FR-019 menyebut tautan aplikasi AR terpisah; AC-019 masih meminta Web-AR Mode Pandu. Keduanya perlu diselaraskan sebelum diimplementasikan.

**Bukti / area kode:** [prisma/schema.prisma](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/prisma/schema.prisma>).

### FR-020 · Meninjau hasil latihan AR

**User story:** Sebagai mahasiswa, saya ingin melihat skor dan kesalahan setelah latihan AR, agar dapat memperbaiki langkah praktikum.

**AC-020 — FSD asli:** Jika mahasiswa menyelesaikan Mode Latihan, saat sesi berakhir, skor 0–100 dan daftar kesalahan ditampilkan.

**Status:** Ditunda. **Prioritas FSD:** Di luar tahap ini.

**Gap / pekerjaan berikutnya:** Metode/runtime dan scope AR harus diputuskan sebelum penilaian/progres dibuat; bukan fitur AI yang sedang dikerjakan.

**Bukti / area kode:** [prisma/schema.prisma](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/prisma/schema.prisma>).

### FR-021 · Melihat ringkasan belajar

**User story:** Sebagai mahasiswa, saya ingin melihat kelas, aktivitas pribadi dan saran belajar, agar tahu aktivitas serta langkah belajar selanjutnya.

**AC-021 — FSD asli:** Jika mahasiswa memiliki kelas terdaftar, saat membuka dashboard, kelas dan statistik pribadi tampil.

**Status:** Sebagian. **Prioritas FSD:** Disarankan.

**Gap / pekerjaan berikutnya:** Dashboard kelas/aktivitas tersedia; statistik belajar pribadi dan rekomendasi terstruktur belum lengkap.

**Bukti / area kode:** [src/app/mahasiswa/page.tsx](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/app/mahasiswa/page.tsx>).

### FR-022 · Menerima pemberitahuan

**User story:** Sebagai mahasiswa dan dosen, saya ingin menerima notifikasi materi baru dan pengingat sesuai preferensi, agar tidak melewatkan kegiatan belajar.

**AC-022 — FSD asli:** Jika mahasiswa tidak aktif 14 hari, saat sistem memeriksa aktivitas, satu notifikasi pengingat dikirim.

**Status:** Belum lengkap. **Prioritas FSD:** Disarankan.

**Gap / pekerjaan berikutnya:** Feed aktivitas bukan pusat notifikasi. Penyimpanan notifikasi, read/unread, preferensi dan scheduler pengingat belum ditemukan.

**Bukti / area kode:** [src/app/api/mahasiswa/activities/route.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/app/api/mahasiswa/activities/route.ts>).

### FR-023 · Mendapat jawaban yang bertanggung jawab

**User story:** Sebagai mahasiswa dan dosen, saya ingin mendapat jawaban dari materi aktif atau pemberitahuan bahwa bukti belum cukup, agar informasi yang tidak didukung tidak disajikan sebagai fakta.

**AC-023 — FSD asli:** Jika jawaban tidak ditemukan dalam materi, saat mahasiswa bertanya, Tutor AI menyatakan bahwa jawaban belum tersedia dan tidak mengarang jawaban.

**Status:** Sebagian; diperkuat PR AI. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Isolasi retrieval, fallback bukti kurang, validasi identitas sitasi dan run snapshot tersedia. Dukungan semantik klaim perlu evaluasi live; laporan pertanyaan belum terjawab untuk dosen belum ada.

**Bukti / area kode:** [src/lib/tutor-ai/service.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/tutor-ai/service.ts>).

### FR-024 · Menguji kualitas tutor

**User story:** Sebagai dosen dan admin, saya ingin menyiapkan pertanyaan/jawaban acuan, menjalankan uji dan melihat kasus gagal per versi materi, agar kualitas tutor dapat dievaluasi.

**AC-024 — FSD asli:** Setelah dosen menjalankan 10 pertanyaan uji, sistem menampilkan tingkat akurasi dan daftar pertanyaan yang gagal dijawab dengan benar.

**Status:** Sebagian; tooling pengembang. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** 25 fixture questions dan runner CLI tersedia. UI/bank soal dosen, scoring/review produk, rerun saat materi berubah dan laporan per course belum lengkap. Belum ada skor kualitas live.

**Bukti / area kode:** [docs/ai/evaluation.md](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/docs/ai/evaluation.md>).

### FR-025 · Berbicara dengan avatar

**User story:** Sebagai mahasiswa, saya ingin bertanya melalui teks/suara dan mendengar avatar menjawab, agar bisa belajar lewat interaksi bersuara dengan fallback teks.

**AC-025 — FSD asli:** Jika perangkat mendukung mode avatar, saat mahasiswa menggunakannya, jawaban diucapkan dan avatar bergerak sesuai keadaan.

**Status:** Sebagian; tahap 2. **Prioritas FSD:** Wajib tahap 2; sesudah tahap 1 stabil.

**Gap / pekerjaan berikutnya:** Avatar, STT/TTS dan fallback browser tersedia. Kesetaraan fakta chat/avatar, izin/perangkat, kegagalan suara dan batas audio masih perlu UAT serta penyelarasan.

**Bukti / area kode:** [src/components/tutor/tutor-avatar-panel.tsx](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/components/tutor/tutor-avatar-panel.tsx>).

### FR-026 · Memantau pengolahan materi

**User story:** Sebagai dosen, saya ingin melihat progres pemrosesan materi dan mencoba ulang kegagalan, agar tahu kapan materi siap digunakan tutor.

**AC-026 — FSD asli:** Saat dosen mengunggah PDF dan pemrosesan berjalan, sistem menampilkan perkembangan proses hingga selesai atau gagal.

**Status:** Sebagian. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Worker, status/progres/log/error tersedia; endpoint retry ditemukan pada admin, belum alur retry dosen yang setara. DOCX/TXT dan batas berkas perlu diselaraskan.

**Bukti / area kode:** [src/lib/material-processing/jobs.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/material-processing/jobs.ts>).

### FR-027 · Menyesuaikan gaya per jenjang

**User story:** Sebagai mahasiswa, saya ingin mendapat penjelasan sesuai S1/S2/S3 agar kedalamannya sesuai kebutuhan belajar; sebagai admin, saya ingin mengatur panduan tiap jenjang dan mode agar gaya tutor konsisten.

**AC-027 — FSD asli:** Jika mahasiswa dengan jenjang S2 bertanya, jawaban mengikuti panduan penjelasan untuk jenjang S2.

**Status:** Sebagian; implementasi tersedia. **Prioritas FSD:** Wajib.

**Gap / pekerjaan berikutnya:** Profil jenjang dan editor prompt enam kombinasi tersedia; run lokal menyimpan snapshot. Regresi live enam kombinasi, penerapan perubahan dan kebijakan fallback tetap perlu diuji.

**Bukti / area kode:** [src/lib/services/tutor-prompt.service.ts](</mnt/B47ED1067ED0C272/magang/pipp-brd/tutor-ai/tutor-ai/src/lib/services/tutor-prompt.service.ts>).

## Yang tidak boleh dianggap sudah selesai

1. **FR-018:** feedback mahasiswa bukan keseluruhan penerimaan. AC-018/BR-040 mensyaratkan feedback negatif masuk daftar koreksi dosen; FB-04 kini tersedia dalam kode lokal, tetapi migration dan UAT masih diperlukan. FR-013 kemudian menuntut koreksi memengaruhi jawaban berikutnya.
2. **FR-024:** runner dengan 25 kasus bukan otomatis fitur evaluasi dosen/admin. Dataset per course, penilaian, pelaporan dan pemicu rerun masih diperlukan. Tidak ada klaim akurasi 90% sudah tercapai.
3. **FR-009 dan FR-027 berbeda:** konfigurasi course milik dosen berbeda dari panduan jenjang/mode milik admin. Editor global tidak menutup FR-009.
4. **FR-006 dan AR:** penugasan dosen tidak memenuhi seluruh AC yang masih mencantumkan relasi AR; scope yang ditunda perlu dipisahkan secara resmi.
5. **Kode lokal bukan rilis:** migration fitur sudah diterapkan pada Docker lokal dan smoke test feedback/review serta integrasi DB koreksi telah dijalankan. Fitur belum di-PR/rilis; UAT lengkap dan evaluasi Gemini nyata masih diperlukan. Screenshot hanya memverifikasi tampilan komponen dengan data contoh.

## Elaborasi PRD/backlog dan keputusan di luar rumusan eksplisit FSD

| Hal | Hubungan ke FSD | Posisi yang tepat |
|---|---|---|
| Persistent runId/requestId, tahap/status, metadata model/token dan deduplikasi request | Mendukung FR-016/023/024; bukan FR baru bernomor dalam FSD | Desain teknis untuk keterlacakan dan reliability; implementasi lokal tersedia |
| Snapshot prompt dan full evidence per run | Membantu membuktikan konteks FR-023/024/027 | Sudah di kode lokal; tidak sama dengan workflow publikasi versi prompt |
| Draft → evaluasi → publikasi → rollback prompt admin | Elaborasi backlog AI-05/AD-01; FSD FR-027 hanya eksplisit soal admin mengubah panduan, FR-009 menyebut versi konfigurasi course | Usulan workflow produk; jangan menyebut semua tahap sudah diwajibkan FSD |
| Alasan feedback terstruktur | FR-018 eksplisit rating dan catatan; reason enum adalah tambahan PRD/backlog | Pilihan implementasi; alasan/catatan tetap opsional |
| Feedback dalam dialog di chat | User menyetujui UI ini. FSD FR-018 alur awal menyebut klik jempol menyimpan; implementasi meminta konfirmasi Simpan di dialog | Keputusan UI yang diterima pada percakapan, perlu dicatat saat penyesuaian spesifikasi/UAT; berbeda dari arsip mockup halaman terpisah |
| Sandbox terisolasi, gate berdua dan matriks evaluasi | Mendukung FR-024; proses gate dan tooling adalah elaborasi backlog | Jangan menganggap dry-run/stub sebagai bukti kualitas model live |
| Worked-example card interaktif | Mendukung penjelasan FR-016; bentuk kartu bukan fitur eksplisit tersendiri di FSD | Tambahan presentasi yang telah dibuat; tetap perhatikan BR-036 yang melarang menghasilkan soal/kuis/kunci jawaban |
| Dashboard error/latensi/feedback admin | Lebih spesifik daripada agregat penggunaan FR-007 | Elaborasi backlog; definisi metrik, denominator dan privasi perlu disepakati |
| Akun/profil/login dan struktur pertemuan | Enabler untuk FR-003/008/015/027, bukan satu FR baru untuk setiap elemen UI | Jangan menambah nomor FR seolah berasal dari sumber asli |

## Perbedaan dan keputusan yang perlu disahkan

- **Urutan delivery vs prioritas:** FR-005, FR-007, FR-012 dan FR-017 adalah Wajib pada FSD, meskipun backlog memprioritaskan AI/feedback dahulu. Menaruhnya belakangan bukan otomatis menghapusnya dari scope kontraktual.
- **FR-018 Disarankan, FR-013 Wajib:** koreksi dosen yang wajib bergantung feedback negatif. Sepakati feedback minimum sebagai dependensi rilis koreksi.
- **AR:** ringkasan menunda FR-011/019/020, tetapi AC dan bagian FR-006 masih memuatnya. FR-019 detail tautan aplikasi existing bertentangan dengan AC-019 Web-AR Mode Pandu. Jangan memilih salah satunya diam-diam.
- **Sitasi:** BR-033/050 menyebut setiap jawaban bersumber, sedangkan sapaan, pemberitahuan bukti kurang dan error tidak memiliki sitasi materi. Tentukan pengecualiannya secara eksplisit.
- **Input dan format:** FSD pertanyaan 1–1000 karakter versus API 8000; FSD audio 10 MB versus endpoint 25 MB; FR-026 menyebut PDF/DOCX/TXT sementara unggah RAG dosen masih PDF.
- **Batas perilaku:** BR-036 melarang menghasilkan soal/kuis/kunci jawaban. Bedakan contoh penjelasan yang diizinkan dari fitur pembuat soal/evaluasi mahasiswa.
- **Kelas/semester:** BR-031 meminta enrollment per semester; model saat ini unique course/user tanpa semester.
- **Privasi:** dosen perlu detail jawaban/konteks untuk FR-013, sedangkan NFR membatasi akses dosen ke agregat. Putuskan akses untuk kasus yang dilaporkan, audit, dan retensi saat chat dihapus.
- **Avatar:** BR-057 menyebut isi sama dengan chat; implementasi memakai gaya dan panjang berbeda. Sepakati kesetaraan fakta/sumber versus teks identik.
- **Target kualitas/performa:** 90% dan 5 detik adalah target FSD yang perlu metode ukur dan validasi live; lulus unit test bukan bukti target terpenuhi.

## Rekomendasi urutan implementasi, bukan pengganti prioritas FSD

1. Verifikasi dan delivery kode run tracking + feedback lokal: migration dev, akses, retry, simpan/edit/reload; perbarui status backlog.
2. Baseline live FR-016/023/024/027 dengan materi contoh, lalu review dosen dan gate kualitas yang disepakati.
3. Lengkapi FR-026 retry dosen dan FR-009 konfigurasi per course sesuai pembagian tim.
4. Lanjutkan UAT browser dan evaluasi Gemini nyata untuk koreksi FR-013/FB-05, termasuk pertanyaan asli, variasi dan tidak terkait.
5. Lengkapi FR-024 sebagai fitur dosen/admin dan gap wajib pengelolaan/analitik/history sesuai keputusan scope. Scope admin adalah pekerjaan terpisah dari branch feedback mahasiswa.
6. Stabilkan tahap 1 sebelum penyempurnaan FR-025 tahap 2; AR menunggu keputusan resmi.
