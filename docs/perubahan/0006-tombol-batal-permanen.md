# ADR-0006: Sediakan tombol batal permanen mendampingi gestur tahan 2 detik

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab III Fase 3 (Escape-Hatch), Lampiran 8 risiko nomor 8

## Konteks

Exsum menetapkan Escape-Hatch berupa **ketuk ganda dan tahan selama 2 detik**
untuk membatalkan transaksi dan kembali ke Mode Siaga.

Persoalannya muncul ketika TalkBack aktif — dan TalkBack aktif pada hampir
seluruh pengguna sasaran kami. TalkBack mengambil alih lapisan sentuh dan
menafsirkan ulang gestur sebelum aplikasi menerimanya. Ketuk tunggal menjadi
"fokuskan dan bacakan", ketuk ganda menjadi "aktifkan". Gestur ketuk ganda yang
ditahan tidak diteruskan ke halaman web dengan cara yang dapat diandalkan.

Akibatnya, **fitur pembatalan darurat justru tidak dapat dijangkau oleh
pengguna yang paling membutuhkannya.** Ini bukan ketidaknyamanan kecil. Exsum
sendiri menempatkan Escape-Hatch sebagai jalan keluar saat kasir menyatakan
uangnya keliru, yaitu saat pengguna sedang berada di bawah tekanan sosial di
depan orang banyak. Jalan keluar yang hanya bekerja ketika pembaca layar
dimatikan bukanlah jalan keluar.

Kabar baiknya, ada kesesuaian yang menguntungkan: pola "ketuk ganda untuk
melanjutkan" dari exsum justru **sama persis** dengan gestur aktivasi bawaan
TalkBack. Untuk maju, tidak ada yang perlu diubah sama sekali. Yang bermasalah
hanya gestur tahan.

## Keputusan

Kami menyediakan dua jalur setara menuju pembatalan.

1. **Tombol "Batalkan" yang selalu ada**, menempati seluruh lebar layar pada
   seperempat bagian bawah, hadir pada setiap fase kecuali Mode Siaga.
   Posisinya tetap, sehingga dapat ditemukan dengan ingatan otot tanpa
   mencarinya. Ia adalah elemen `<button>` semantik dengan `aria-label` yang
   jelas, sehingga TalkBack membacakannya dan mengaktifkannya seperti biasa.

2. **Gestur ketuk ganda dan tahan 2 detik tetap dipertahankan** untuk pengguna
   yang menjalankan aplikasi tanpa TalkBack, persis seperti tertulis di exsum.

Keduanya memicu peristiwa `{ jenis: 'BATAL' }` yang sama pada state machine.
Tidak ada percabangan logika, hanya dua pintu menuju satu perilaku.

Perancangan layar mengikuti prinsip yang sama secara menyeluruh: **setiap fase
adalah satu tombol besar untuk tindakan utama, ditambah tombol batal permanen.**
Dua target sentuh, keduanya berukuran besar, keduanya semantik. Tidak ada yang
perlu dicari.

## Konsekuensi

**Menjadi lebih baik**

- Pembatalan darurat dapat dijangkau oleh pengguna TalkBack, yang merupakan
  mayoritas pengguna sasaran.
- Risiko nomor 8 pada Lampiran 8 (konflik fokus dengan TalkBack) tertangani
  secara struktural, bukan lewat penyetelan.
- Tata letak menjadi lebih sederhana, bukan lebih rumit: dua target sentuh
  besar per layar, seluruhnya elemen semantik standar.
- Tidak perlu mendeteksi apakah TalkBack aktif, sesuatu yang memang tidak dapat
  dilakukan dari dalam halaman web dengan andal.

**Menjadi lebih buruk**

- Seperempat bagian bawah layar tidak lagi tersedia untuk pratinjau kamera.
  Dapat diterima, karena uang dibidik di bagian tengah bingkai.
- Ada dua jalur menuju satu perilaku, sehingga keduanya harus diuji. Biayanya
  kecil karena keduanya bermuara pada peristiwa yang sama.
- Sedikit menyimpang dari kesan "layar bersih tanpa tombol" yang tersirat pada
  istilah Zero-Touch Interaction di exsum. Menurut kami, maksud sebenarnya dari
  istilah itu adalah "tidak perlu mencari tombol", dan tombol tetap berukuran
  besar di posisi tetap justru memenuhi maksud tersebut lebih baik daripada
  gestur tersembunyi.

## Alternatif yang ditolak

- **Hanya gestur tahan, seperti tertulis di exsum.** Ditolak karena tidak dapat
  dijangkau saat TalkBack aktif.
- **Tombol volume fisik sebagai pembatalan.** Andal dan tidak direbut TalkBack,
  tetapi memerlukan plugin native tambahan dan bertabrakan dengan pengaturan
  volume yang justru sering dipakai pengguna tunanetra.
- **Gestur guncang perangkat.** Rawan terpicu tanpa sengaja saat berjalan di
  pasar. Pembatalan transaksi yang terjadi sendiri lebih buruk daripada
  pembatalan yang sulit dipanggil.
