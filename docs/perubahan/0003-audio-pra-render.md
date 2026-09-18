# ADR-0003: Pakai audio pra-render, bukan text-to-speech saat berjalan

- **Status:** Diterima, dengan amandemen 2026-09-18
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Judul ("Voice Interaction"), Bab III bagian 3.3 (Audio Ducking)

## Amandemen 2026-09-18

Keputusan pra-render **tidak berubah**, tetapi bentuk penyimpanannya berubah:
potongan disimpan sebagai **berkas terpisah**, bukan digabung jadi satu sprite
dengan berkas indeks offset seperti tertulis di bawah.

Alasan sprite pada umumnya adalah menghemat permintaan jaringan. Di sini tidak
ada jaringan sama sekali — seluruhnya aset lokal di dalam APK — sehingga
keuntungannya hilang, sementara biayanya tetap: menggabung audio membutuhkan
perkakas tambahan (ffmpeg, yang tidak tersedia di mesin pengembangan kami), dan
perhitungan offset milidetik adalah sumber kesalahan yang tidak akan terdengar
sampai satu kata terpotong di tengah kalimat.

Hasil akhirnya: **34 potongan, total 415 KB**, dirender dengan suara neural
`id-ID-ArdiNeural` pada kecepatan −5%. Skripnya ada di
`scripts/render_audio.py` dan dijalankan sekali oleh pengembang, bukan saat
aplikasi berjalan.

Kecepatan sedikit di bawah normal itu disengaja: pengguna mendengar nominal
SEKALI, sambil memegang uang dan menghadapi kasir yang menunggu, tanpa
kesempatan mengulang.

## Konteks

Rencana awal adalah memakai Web Speech API `speechSynthesis` dengan
`lang="id-ID"` untuk mengucapkan nominal. Di dalam WebView Android, API ini
meneruskan permintaan ke mesin text-to-speech bawaan sistem, biasanya Google
Text-to-Speech.

Masalahnya: **mesin itu hanya bekerja luring bila paket suara Bahasa Indonesia
sudah diunduh di perangkat tersebut.** Paket itu tidak selalu terpasang, dan
tidak bisa kami pasang dari dalam aplikasi. Bila tidak ada, HP akan mencoba
mengambilnya dari jaringan — yang dalam mode pesawat berarti aplikasi **membisu
total**.

Konsekuensinya berat sekali untuk produk ini. SUDEPI adalah aplikasi yang
seluruh keluarannya berupa suara, dipakai orang yang tidak bisa membaca layar.
Aplikasi yang membisu bukan aplikasi yang berkurang fiturnya; ia sepenuhnya
tidak berguna. Dan kegagalan ini justru paling mungkin terjadi di HP yang baru
pertama kali dipasangi aplikasi kami — misalnya HP juri.

Ada dua masalah tambahan yang lebih kecil namun nyata. Pertama, latensi
`speechSynthesis` tidak dapat diprediksi, terutama pada ucapan pertama setelah
mesin TTS dibangunkan. Kedua, keluarannya sulit dikendalikan bersama TalkBack
yang juga memakai mesin TTS yang sama.

## Keputusan

Kami memakai **audio sprite pra-render** sebagai jalur utama keluaran suara.

Seluruh ucapan yang mungkin dibunyikan sistem dirender lebih dulu menjadi
potongan audio, digabung ke dalam satu berkas dengan berkas indeks offset, lalu
dibundel ke dalam APK. Pemutarannya memakai Web Audio API, sehingga peredaman
suara (audio ducking) tinggal mengatur `GainNode` — jauh lebih terkendali
dibanding mencoba meredam mesin TTS sistem.

Bahasa Indonesia sangat membantu di sini karena penyusunan bilangannya
teratur. Sekitar 40 potongan sudah cukup untuk melafalkan seluruh nominal
sampai ratusan juta, ditambah semua frasa sistem:

```
nol, satu … sembilan, sepuluh, sebelas, belas, puluh,
seratus, ratus, seribu, ribu, juta, rupiah
+ frasa sistem (arahkan kamera, belum yakin, kembalian, …)
```

`speechSynthesis` tetap dipertahankan sebagai **cadangan**, dipakai hanya bila
pemuatan audio sprite gagal.

## Konsekuensi

**Menjadi lebih baik**

- Keluaran suara dijamin ada, di HP mana pun, dalam mode pesawat, tanpa syarat
  apa pun terhadap perangkat.
- Latensi ucapan mendekati nol dan seragam. Sistem terasa responsif.
- Audio ducking menjadi sepele dan tepat, karena kami mengendalikan grafik
  audionya sendiri.
- Pengucapan konsisten setiap kali. Tidak ada kejutan lafal di depan juri.
- Tidak bertabrakan dengan mesin TTS yang sedang dipakai TalkBack.

**Menjadi lebih buruk**

- Perlu pekerjaan persiapan: merender potongan, menyusun sprite, dan membuat
  berkas indeks. Sekitar satu jam, dan bisa dikerjakan paralel dengan yang lain.
- Menambah sekitar 1 sampai 2 MB pada ukuran APK. Dapat diabaikan.
- Kalimat baru tidak bisa diucapkan begitu saja; harus dirender dulu. Karena
  itu daftar `IdFrasa` di `contracts/suara.ts` perlu dipikirkan agak lengkap di
  awal.
- Intonasi terdengar sedikit lebih datar dibanding TTS yang menyusun satu
  kalimat utuh, karena kata dirangkai dari potongan.

## Alternatif yang ditolak

- **`speechSynthesis` saja.** Ditolak karena risiko aplikasi membisu total di
  HP yang tidak punya paket suara luring. Untuk aplikasi yang keluarannya
  hanya suara, ini bukan risiko yang boleh diambil.
- **Merender penuh tiap kalimat, bukan potongan kata.** Jumlah kalimat yang
  mungkin tidak terbatas, karena nominal belanja bisa berapa pun.
- **Membundel mesin TTS lengkap, seperti Piper atau eSpeak lewat WASM.**
  Menambah puluhan MB dan beberapa jam integrasi, untuk kualitas yang tidak
  lebih baik daripada potongan yang dirender di muka.
