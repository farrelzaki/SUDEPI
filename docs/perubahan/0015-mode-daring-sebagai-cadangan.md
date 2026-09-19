# ADR-0015: Mode daring sebagai cadangan, luring tetap jalur baku

- **Status:** Diterima
- **Tanggal:** 2026-09-19
- **Rujukan exsum:** Bab I dan Bab II ("100% Offline-First, Zero Cloud Overhead")

> **Ini keputusan paling berat di seluruh proyek**, karena ia menyentuh klaim
> yang menjadi pembeda utama SUDEPI. Bagian ini ditulis selengkap mungkin agar
> dapat dipertanggungjawabkan di hadapan dewan juri.

## Konteks

Menjelang penjurian, dua fitur rancangan belum benar-benar bekerja luring:

- **Pembacaan beberapa lembar sekaligus** masih goyah, walaupun model sudah
  dilatih ulang dengan citra multi-lembar dan voting temporalnya sudah dibedah
  tiga kali (ADR-0012).
- **Perintah suara** sudah lengkap rantainya dan lulus 29 tes, tetapi belum
  berhasil konsisten saat diuji langsung (ADR-0013).

Pilihannya dua: menampilkan demo yang dipilih hati-hati agar kedua kelemahan
itu tidak terlihat, atau menyediakan jalur cadangan dan menyatakannya terbuka.
Yang pertama lebih rapi di panggung dan lebih tidak jujur.

## Keputusan

**Rencana A tetap hidup dan tetap menjadi jalur baku.** Klaim mode pesawat
tidak berubah sedikit pun: aplikasi dibuka dalam mode luring, dan dalam mode itu
tidak ada satu pun permintaan jaringan.

**Rencana B dibangun berdampingan**, dinyalakan pengguna lewat saklar yang
terlihat di beranda.

| Kebutuhan | Jalur daring | Biaya |
| --- | --- | --- |
| Pengenalan ucapan | `SpeechRecognizer` bawaan Android | Gratis, tanpa kunci API |
| Membaca uang | Gemini Flash, rantai empat model | Gratis, tanpa kartu kredit |

### Satu gerbang menuju jaringan

`src/platform/mode.ts` adalah satu-satunya tempat yang memutuskan boleh atau
tidaknya memanggil ke luar. Aturannya ditulis di sana, bukan disebar ke
pemanggil, supaya tidak ada jalur yang diam-diam lolos saat seseorang menambah
fitur baru.

Arah kegagalannya disengaja: penyimpanan yang rusak, versi lama, atau nilai yang
tidak dikenali semuanya jatuh ke **luring**. Aplikasi yang tidak yakin sedang
berada di mode apa tidak boleh menebak ke arah internet.

### Saklarnya terlihat, bukan disembunyikan

Mode daring mengirim gambar uang dan suara penggunanya ke internet.
Menyembunyikan saklarnya di menu pengaturan akan membuat sebagian orang
memakainya tanpa pernah sadar. Ia karena itu berdiri di beranda, menyebutkan
mode yang sedang aktif, dan hanya berganti kalau ditekan.

### Hasil daring berbentuk sama dengan hasil luring

Jawaban Gemini dibentuk menjadi `HasilPindai`, tipe yang sama dengan keluaran
model kami sendiri. Tidak ada satu baris pun di hilir yang berubah — penyusun
kalimat, penahan pengulangan, penurunan nominal koin, dan verifikasi kembalian
tidak perlu tahu dari mana angkanya datang.

### Gerbang abstain ikut dibawa ke jalur daring

Model bahasa cenderung menjawab apa pun yang ditanyakan, dan itu sifat yang
berbahaya untuk pekerjaan ini. Ia diminta menyatakan keraguannya, dan jawaban
ragu menjadi abstain. **Satu pecahan di luar tabel membatalkan seluruh
jawaban** — bukan dibuang lalu sisanya dipakai, karena itu menghasilkan total
yang lebih kecil daripada uang yang sebenarnya ada, dan pengguna menyerahkan
uangnya tanpa tahu ada yang tidak terhitung.

Aturan nomor dua proyek ini berlaku sama di kedua mode: lebih baik diam
daripada salah sebut.

### Kuota dihitung per model per hari

Pelajaran yang didapat dari perangkat, bukan dari dokumentasi. Mode daring
sempat tampak rusak total — HTTP 429 pada setiap permintaan — padahal kodenya
tidak salah sedikit pun. Kuota gratis Gemini dihitung **per model per hari**,
dan untuk `gemini-3.6-flash` angkanya hanya **dua puluh permintaan sehari**.

Karena kuotanya per model, berpindah model berarti mendapat jatah baru. Empat
model dirantai, yang ringan didahulukan. Kegagalan dibedakan menurut apa yang
masuk akal dilakukan sesudahnya: kuota habis berpindah model seketika, server
penuh juga berpindah, sedangkan jaringan putus dan kunci ditolak menghentikan
seluruh rantai — berpindah model tidak akan menolong, dan tiap percobaan hanya
menambah waktu tunggu.

## Konsekuensi

**Yang berubah pada klaim exsum**

Klaim "100% Offline-First" tetap benar untuk jalur baku, dan tetap bisa
dibuktikan dengan mode pesawat menyala. Yang tidak lagi benar adalah membaca
klaim itu sebagai "aplikasi ini tidak punya kemampuan daring sama sekali".
Kalimat di Bab I dan Bab II perlu dibaca sebagai: **luring adalah jalur baku dan
jaminan; daring adalah mode terpisah yang harus dinyalakan sendiri.**

**Yang harus dinyatakan terbuka tentang kunci API**

Kunci Gemini yang dipakai dari sisi aplikasi **ikut terbundel ke dalam berkas
JavaScript di APK**. Ini diperiksa, bukan diduga: kuncinya ditemukan di dalam
bundel hasil build. Itu batasan arsitektur aplikasi klien — apa pun yang
dibutuhkan aplikasi untuk memanggil API harus ada di dalam aplikasi — bukan
kelalaian penyimpanan. Yang bisa dijaga adalah ia tidak ikut tersebar lewat
riwayat git, dan itu sudah dilakukan lewat `.env.local`.

Untuk produk sungguhan, panggilan seperti ini harus lewat server perantara
milik sendiri. Untuk lomba, kuncinya dicabut setelah penjurian.

**Yang menjadi lebih baik**

Pembacaan beberapa lembar sekaligus akhirnya bekerja, dan perintah suara
akhirnya bisa ditunjukkan — keduanya terbukti di Galaxy M32. Satu transaksi
penuh berjalan utuh dari beranda sampai "Transaksi selesai".

## Alternatif yang ditolak

- **Menyerah pada kedua fitur dan mendemokan sisanya.** Lebih rapi, tetapi
  membuang kemampuan yang sebenarnya bisa ditunjukkan bekerja.
- **Menjadikan daring sebagai jalur utama.** Akan mencabut satu-satunya
  pembeda SUDEPI dari Google Lookout dan Seeing AI.
- **Menyalakan daring otomatis saat luring gagal.** Terdengar pintar, dan
  itulah bahayanya: gambar uang dan suara pengguna akan terkirim ke internet
  tanpa ia pernah memutuskannya.
