# Tutor AI
> Mini LMS Berbasis AI Personalisasi dengan Teknologi Retrieval-Augmented Generation (RAG)

![Next.js](https://img.shields.io/badge/Next.js-16.2.2-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2-blue?logo=react)
![Prisma](https://img.shields.io/badge/Prisma-7.8-1B222D?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green.svg)

## Visual Preview

Tutor AI menyediakan antarmuka pengguna yang terintegrasi untuk memberikan pengalaman belajar terbaik melalui percakapan kontekstual dan rendering avatar 3D.

![Tutor AI Avatar](./public/result/avatar.png)
*Tampilan Avatar 3D interaktif yang memberikan pengalaman belajar personal.*

![Tutor AI Chat Interface](./public/result/chat.png)
*Antarmuka obrolan yang mendukung rendering Markdown dan persamaan matematika secara langsung.*

## Table of Contents
- [Fitur Utama](#fitur-utama)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Dependensi Sistem](#dependensi-sistem)
- [Panduan Instalasi & Quickstart](#panduan-instalasi--quickstart)
- [Penggunaan dan Pengembangan](#penggunaan-dan-pengembangan)
- [Lisensi](#lisensi)

## Fitur Utama

1. **Mini Learning Management System (LMS)**
   Manajemen terpadu untuk mata kuliah dan pendaftaran mandiri menggunakan kunci registrasi (Enrollment Key). Dosen dapat mengatur sesi pembelajaran secara terstruktur.

2. **AI Tutor Berbasis Retrieval-Augmented Generation (RAG)**
   Sistem mengekstrak teks dari materi PDF secara otomatis (termasuk penggunaan OCR untuk materi berbentuk gambar). Jawaban AI selalu merujuk pada basis pengetahuan dokumen yang diunggah, meminimalisir risiko halusinasi informasi.

3. **Personalisasi Profil Mahasiswa**
   AI menyesuaikan kompleksitas jawaban berdasarkan jenjang studi:
   - S1 (Sarjana): Menggunakan analogi sederhana.
   - S2 (Magister): Berfokus pada teknis dan implementasi.
   - S3 (Doktor): Penjelasan analitis, formal, dan berorientasi riset.

4. **Interaksi Multimodal**
   Dukungan untuk Text-to-Speech (TTS) melalui ElevenLabs, konversi Speech-to-Text (STT) untuk masukan pengguna, serta dukungan Markdown dan LaTeX untuk formula matematika. Pengalaman diperkaya dengan integrasi Avatar 3D yang dirender via React Three Fiber.

5. **Pemrosesan Asinkron (Background Processing)**
   Proses pemotongan (chunking) dan embedding dokumen yang berat dipisahkan dari server utama menggunakan background worker untuk mempertahankan stabilitas dan latensi sistem inti.

## Arsitektur Sistem

Arsitektur sistem dibangun di atas infrastruktur modern dengan pemisahan tugas yang jelas:
- **Frontend Layer:** Dibangun dengan React 19 dan Next.js 16 (App Router), menampilkan UI dinamis dan Avatar 3D interaktif.
- **Backend & API Layer:** Memanfaatkan Next.js Route Handlers untuk menjembatani komunikasi ke layanan LLM dan database.
- **Authentication:** Menggunakan Better Auth untuk implementasi Role-Based Access Control (RBAC).
- **Data & Storage:** 
  - Relasional Data: PostgreSQL via Prisma ORM.
  - Vektor & Dokumen: Supabase (pgvector) untuk manajemen data tidak terstruktur.
- **RAG Pipeline:**
  - File parser menggunakan Tesseract OCR dan PDF.js.
  - Chunking menggunakan LangChain TextSplitters.
  - LLM Inference dan Embeddings menggunakan kombinasi model Google Gemini dan Groq SDK.

## Dependensi Sistem

Berikut adalah library utama pendukung sistem ini:
- **Core Framework:** Next.js 16.2.2, React 19.2.4
- **Database ORM:** `@prisma/client`, `@prisma/adapter-pg`
- **Authentication:** `better-auth`
- **AI & ML Integration:** `@google/genai`, `groq-sdk`, `@langchain/textsplitters`
- **File Parsing & OCR:** `pdfjs-dist`, `tesseract.js`
- **User Interface:** `tailwindcss` (v4), `shadcn/ui`, `lucide-react`, `react-markdown`, `katex`
- **Multimodal & 3D:** `@elevenlabs/elevenlabs-js`, `three`, `@react-three/fiber`, `@react-three/drei`
- **Development Tooling:** `concurrently`, `tsx`, `typescript`

## Panduan Instalasi & Quickstart

Langkah-langkah berikut akan membantu Anda menjalankan proyek ini di environment lokal Anda.

### 1. Prasyarat (Prerequisites)
Pastikan environment pengembangan Anda memenuhi persyaratan berikut:
- **Node.js**: Direkomendasikan versi 20 LTS atau yang lebih baru.
- **pnpm**: Package manager (dapat diinstal melalui `npm install -g pnpm`).
- **PostgreSQL**: Server database aktif, baik lokal maupun cloud (contoh: Supabase, Neon).
- **Supabase Project**: Dengan ekstensi pgvector yang telah diaktifkan.
- **API Keys**: Dapatkan kunci akses dari [Google AI Studio](https://aistudio.google.com/), [Groq Console](https://console.groq.com/), dan [ElevenLabs](https://elevenlabs.io/).

### 2. Kloning Repositori
Lakukan kloning repositori ke mesin lokal Anda:
```bash
git clone <url-repositori-tutor-ai>
cd tutor-ai
```

### 3. Instalasi Dependensi
Instal seluruh package dan dependensi dengan perintah:
```bash
pnpm install
```

### 4. Konfigurasi Environment Variables
Salin contoh konfigurasi ke dalam file `.env`:
```bash
cp .env.example .env
```
Buka file `.env` di teks editor dan lengkapi konfigurasi berikut:
```env
BETTER_AUTH_SECRET="your-secure-random-string"
DATABASE_URL="postgresql://user:password@localhost:5432/tutor-ai"
GEMINI_API_KEY="AIzaSy..."
GROQ_API_KEY="gsk_..."
SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUz..."
ELEVENLABS_API_KEY="sk_..."
```

### 5. Setup dan Migrasi Database
Prisma CLI membaca `DIRECT_URL` (lihat `prisma.config.ts`), sedangkan aplikasi dan Better Auth membaca `DATABASE_URL`. Isi keduanya di `.env`: gunakan koneksi langsung ke database untuk `DIRECT_URL` dan koneksi pooler untuk `DATABASE_URL`.

Inisialisasi database dari riwayat migrasi, lalu buat Prisma Client dan isi data development:
```bash
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec prisma db seed
pnpm exec tsx prisma/seed-prompts.ts
```

`prisma db seed` membuat lima akun development (admin, dosen, mahasiswa S1/S2/S3). `prisma/seed-prompts.ts` mengisi enam konfigurasi prompt tutor. Password seed hanya untuk development dan tidak boleh dipakai di production.

Gunakan `prisma migrate deploy`, bukan `prisma db push`, sebagai mekanisme setup. Skema dan riwayat migrasi harus berasal dari `prisma/migrations`.

#### Reset database development (destruktif)
Hanya untuk database development yang memang disposable dan tidak menyimpan data yang dibutuhkan. Hentikan server Next.js dan worker material, hapus hanya tabel aplikasi yang diketahui (jangan memakai `CASCADE` untuk melewati dependensi tak terduga), lalu jalankan ulang seluruh rantai migrasi dan seed di atas. Jangan pernah menjalankan langkah ini pada database bersama atau production.

Untuk deployment berikutnya, cukup jalankan `pnpm exec prisma migrate deploy` setelah backup; jangan reset, jangan `db push`, dan jangan mengubah migrasi yang sudah diterapkan.

### 6. Menjalankan Server (Development Mode)
Aplikasi ini dikonfigurasi menggunakan `concurrently` untuk mengeksekusi server web dan background worker secara beriringan:
```bash
pnpm run dev
```
Setelah proses kompilasi selesai, aplikasi dapat diakses melalui browser pada `http://localhost:3000`.

## Penggunaan dan Pengembangan

### Mengeksekusi Pekerja Latar Belakang (Worker)
Dalam skenario tertentu, Anda mungkin ingin menjalankan skrip pemrosesan material secara independen dari server development:
```bash
pnpm run worker:materials:once
```

### Format Respon Markdown
Sistem dirancang untuk mendukung balasan AI dengan format Markdown dan sintaks LaTeX. Sebagai contoh persamaan gaya gravitasi:

$$ F = G \frac{m_1 m_2}{r^2} $$

Komponen antarmuka pada sisi klien (client-side) akan secara otomatis memproses luaran di atas menggunakan plugin Remark dan KaTeX untuk rendering yang sempurna.

## Lisensi

Proyek ini berada di bawah [MIT License](LICENSE). Hak cipta © 2026 Tutor AI.
