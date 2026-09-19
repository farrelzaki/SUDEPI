# ADR-0014: Alat baca uang berdiri sendiri, terpisah dari alur transaksi

- **Status:** Diterima
- **Tanggal:** 2026-09-19
- **Rujukan exsum:** Bab III Fase 1–4 (urutan fase transaksi)

## Konteks

Exsum menyusun SUDEPI sebagai satu alur empat fase: pindai uang yang
dibayarkan, masukkan total belanja, tunjukkan ke pedagang, periksa kembalian.
Kami membangunnya persis begitu.

Memakainya sendiri menunjukkan persoalannya. Pertanyaan **"ini uang berapa"**
jauh lebih sering muncul daripada "hitungkan kembalian saya" — saat merapikan
dompet, saat menerima uang dari seseorang, saat memastikan sebelum berangkat.
Dengan susunan lama, pertanyaan sesederhana itu menuntut pengguna memasuki alur
yang meminta harga belanja, layar pedagang, dan verifikasi kembalian, lalu
membatalkannya untuk keluar.

Ditambah satu hal yang hanya kelihatan saat dipakai: pengguna harus melewati
satu layar pembuka sebelum bisa melakukan apa pun. Satu ketukan terdengar kecil
di atas kertas; bagi pengguna TalkBack ia berarti satu layar penuh yang harus
ditelusuri sebelum sampai ke hal yang ia buka aplikasinya untuk itu.

## Keputusan

**Membaca uang dipisahkan menjadi alat yang berdiri sendiri, dan alat itulah
berandanya.** Membuka aplikasi berarti kamera sudah menyala dan siap menjawab.
Transaksi dan pelatihan suara hadir sebagai tombol di layar yang sama, bukan
sebagai tujuan yang harus dilewati lebih dulu.

Alur transaksinya ikut berubah:

| Langkah | Dulu | Sekarang |
| --- | --- | --- |
| 1 | Pindai uang yang dibayarkan | **Masukkan uang yang dipegang** (kalkulator) |
| 2 | Masukkan total belanja | Masukkan total belanja (kalkulator) |
| 3 | Layar pedagang | Layar pedagang |
| 4 | Pindai kembalian | Pindai kembalian |

Kamera kini hanya muncul di akhir. Alasannya bukan sekadar kerapian: pembacaan
beberapa lembar sekaligus masih goyah, dan menaruhnya sebagai gerbang wajib di
awal transaksi berarti seluruh alur tersandera oleh bagian yang paling belum
matang.

### `src/contracts/` tidak disentuh sama sekali

Fase `KALKULATOR` ternyata sudah menerima `SET_BAYAR` maupun `SET_BELANJA`
sejak awal, jadi seluruh perombakan cukup di reducer dan antarmuka. Fase
`PINDAI_BAYAR` tetap ada di kontrak tetapi tidak lagi dimasuki; cabangnya di
antarmuka dijaga agar tidak ada keadaan yang berakhir di layar kosong.

### Logika pembacaan dipindahkan, bukan ditulis ulang

`core/pembaca.ts` meminjam penyusun kalimat, penahan pengulangan, dan penahan
abstain dari `core/mesin.ts`. Logika yang sama, tesnya sudah ada, dan kalau
suatu hari diperbaiki keduanya ikut membaik bersamaan.

Satu perbedaan perilaku disengaja: **alat baca tidak mengunci hasilnya.** Di
alur transaksi, nominal yang sudah diucapkan harus bertahan sampai pengguna
menanggapinya — kalau tidak, ketukannya ditolak diam-diam dan ia tidak punya
cara tahu kenapa. Di alat baca tidak ada yang perlu ditanggapi, jadi uang baru
langsung menggantikan yang lama.

## Konsekuensi

**Menjadi lebih baik**

- Kebutuhan yang paling sering muncul berada di tempat yang tidak perlu dicari.
- Kamera tidak lagi menyala sepanjang pengguna mengetik nominal, sehingga
  baterai tidak terkuras dan HP tidak memanas di fase yang tidak membutuhkannya.
- Alur transaksi tidak lagi bergantung pada bagian sistem yang paling belum
  matang.

**Menjadi lebih buruk, dan bagaimana kami menanganinya**

- Uang yang dibayarkan kini diketik, bukan dipindai — satu kemudahan yang
  dijanjikan exsum hilang. Yang menggantikannya: papan angka bergaya papan
  panggil telepon (ADR-0011) dan perintah suara (ADR-0013), keduanya lebih
  cepat daripada mengarahkan kamera sampai stabil.
- Beranda tidak lagi punya sasaran ketuk sebesar layar. Dulu hanya ada satu hal
  yang bisa dilakukan; sekarang ada dua jalan berbeda, dan sasaran sebesar layar
  akan memilih salah satunya tanpa pengguna tahu yang mana.

**Yang dijaga tes.** Tes pendengaran fase pindai dipindahkan ke
`pembaca.test.ts` mengikuti kode yang diujinya, dan tes penguncian serta abstain
diarahkan ke fase kembalian — satu-satunya fase pindai yang tersisa di dalam
transaksi. Satu tes baru mengunci inti perubahan ini: **kamera tidak boleh
menyala di awal transaksi.**

## Alternatif yang ditolak

- **Menambah fase baru ke `src/contracts/`.** Akan memaksa berkas beku berubah
  demi dua layar yang tidak ada hubungannya dengan perhitungan kembalian.
- **Menulis ulang logika pengumuman di antarmuka.** Menghasilkan dua tempat
  yang harus sama-sama ingat untuk tidak mengulang kalimat, dan salah satunya
  pasti tertinggal saat diperbaiki.
