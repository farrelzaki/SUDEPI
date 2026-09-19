# SUDEPI: Suara Deteksi Rupiah

Asisten Transaksi Tunai Mandiri untuk Penyandang Disabilitas Netra

IT Competition Hackathon IFEST 2026, Tim PenungguTokenReset, IPB University
Tema: Tech for Human Connections (Accessibility, Receiver, and Provider)

SUDEPI adalah aplikasi mobile berbasis Android yang dirancang khusus untuk membantu penyandang disabilitas netra dalam melakukan transaksi tunai secara mandiri, aman, dan bermartabat. Aplikasi ini mampu mengenali nominal uang Rupiah kertas (single maupun multi-lembar) dan koin, menghitung kembalian belanja, serta menyediakan antarmuka verifikasi kasir dua arah (Merchant Display). Sistem beroperasi secara independen tanpa ketergantungan koneksi internet (100% luring), menjamin privasi data keuangan tetap berada di dalam perangkat pengguna.

---

## Ringkasan Keunggulan

Tabel perbandingan kapabilitas sistem terhadap solusi yang ada:

| Fitur Utama | Google Lookout / Seeing AI | Cash Reader | SUDEPI |
| --- | --- | --- | --- |
| Pembacaan Multi-Lembar Bertumpuk | Tidak | Tidak | Ya |
| Perhitungan Kembalian Otomatis | Tidak | Tidak | Ya |
| Verifikasi Kasir (Merchant Display) | Tidak | Tidak | Ya |
| Operasi Penuh Tanpa Internet (Luring) | Sebagian | Ya | Ya (Mutlak) |
| Navigasi Suara Hands-Free | Tidak | Tidak | Ya |
| Biaya Lisensi Pengguna | Gratis | Berbayar | Gratis |

Prinsip fundamental sistem adalah integritas pengenalan uang. Bila keyakinan deteksi visual berada di bawah ambang batas aman, sistem secara tegas menolak menebak (abstain) dan meminta pengguna memindai ulang. Untuk penyandang disabilitas netra, kesalahan penyebutan nominal jauh lebih merugikan daripada sistem yang meminta konfirmasi ulang.

---

## Arsitektur dan Alur Transaksi

Alur transaksi dirancang berdasarkan empat fase berurutan:

1. Fase Siaga dan Beranda (LayarBaca): Kamera otomatis aktif dan memindai lembar uang yang diarahkan pengguna dalam 1.2 detik tanpa memerlukan sentuhan layar awal. Hasil nominal langsung diumumkan melalui Text-to-Speech bahasa Indonesia dan umpan balik haptik.
2. Fase Kalkulator Transaksi (Kalkulator Taktil): Pengguna dapat memasukkan nominal uang yang dibayarkan dan total belanjaan baik menggunakan papan angka taktil kontras tinggi maupun perintah suara.
3. Fase Verifikasi Pedagang (Layar Kasir): Layar menampilkan tiga angka utama (Belanja, Dibayar, Kembalian) dengan kontras maksimal dan tipografi besar sehingga pedagang dapat memeriksa kebenaran transaksi tanpa menyentuh ponsel pengguna.
4. Fase Periksa Kembalian (Pindai Kembalian): Kamera memindai uang kembalian yang diterima dari pedagang, mencocokkan nilainya secara otomatis terhadap kembalian wajib, dan memverifikasi presensi koin. Transaksi dapat diselesaikan secara fleksibel melalui ketukan konfirmasi maupun perintah suara.
5. Fase Selesai: Ringkasan transaksi tersimpan ke dalam basis data lokal terenkripsi di perangkat untuk pencatatan riwayat keuangan pribadi.

---

## Navigasi Berbasis Perintah Suara

Seluruh alur transaksi dapat dijalankan secara hands-free menggunakan masukan suara berbahasa Indonesia:

1. Perintah Mulai Transaksi: Pada layar beranda, pengguna cukup mengucapkan "mulai transaksi" atau "belanja" untuk membuka kalkulator.
2. Perintah Lanjutkan: Pada kalkulator, ucapan "lanjutkan" atau "ke kasir" memindahkan fokus input dan mengunci nominal ke layar kasir.
3. Perintah Periksa Kembalian: Pada layar kasir, ucapan "periksa kembalian" langsung mengaktifkan kamera verifikasi uang kembalian.
4. Perintah Selesaikan Transaksi: Pada layar kembalian, ucapan "selesaikan transaksi", "selesai", atau "uang pas" memfinalisasi transaksi.
5. Perintah Pembatalan Global: Pada fase apa pun, ucapan "batal" atau "batalkan transaksi" mengembalikan aplikasi ke mode siaga awal secara aman.

---

## Spesifikasi Teknologi

Komponen teknologi yang digunakan:

Bahasa dan Framework Antarmuka: TypeScript, React 19, Tailwind CSS 4, Vite 7
Runtime Native Mobile: Capacitor 7.6 pada platform Android SDK 34
Mesin Inferensi Vision Lokal: ONNX Runtime Web (WASM execution provider dengan SIMD threading di Web Worker)
Arsitektur Model Vision: YOLOv8-Nano INT8 terkuantisasi (resolusi input 320x320 piksel, 8 kelas Rupiah resmi)
Penyimpanan Data Lokal: IndexedDB melalui Dexie.js (offline storage tanpa server)
Sistem Suara dan Haptik: Android Native SpeechRecognizer (id-ID SODA Engine), SpeechSynthesis TTS Indonesia, Capacitor Haptics Engine

Rincian keputusan arsitektur dan Architecture Decision Record (ADR) tercatat lengkap pada folder docs.

---

## Dokumentasi Teknis

Petunjuk lengkap sistem dapat dipelajari pada berkas berikut:

1. CLAUDE.md: Pedoman ringkas orientasi teknis kode sumber dan arsitektur proyek.
2. docs/PLAN.md: Latar belakang pemilihan teknologi dan linimasa eksekusi hackathon.
3. docs/ARSITEKTUR.md: Diagram arsitektur data, alur bingkai kamera, dan model inferensi.
4. docs/KONTRAK.md: Definisi tipe data dan antarmuka state machine lintas-modul.
5. docs/PERUBAHAN.md: Dokumentasi keputusan arsitektur teknis (ADR-0001 hingga ADR-0014).
6. docs/AKSESIBILITAS.md: Standar kepatuhan aksesibilitas WCAG 2.2 AA dan Android TalkBack.
7. docs/DEMO.md: Skenario pengujian teknis dan daftar periksa penjurian.
8. docs/PROGRES.md: Catatan verifikasi empiris dan pengujian pada perangkat fisik.

---

## Panduan Instalasi dan Pengujian

Langkah menjalankan lingkungan pengembangan:

1. Instalasi dependensi: pnpm install
2. Menjalankan lingkungan pengujian desktop: pnpm dev
3. Menjalankan pengujian unit otomatis: pnpm test
4. Sinkronisasi aset mobile: npx cap sync android
5. Kompilasi APK Android: ./android/gradlew assembleDebug

Berkas executable APK mandiri (Runnable Artifact) siap pakai telah dikompilasi pada berkas SUDEPI.apk di direktori utama repositori.
