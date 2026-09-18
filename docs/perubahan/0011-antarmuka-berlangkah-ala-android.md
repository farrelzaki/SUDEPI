# ADR-0011: Antarmuka berlangkah ala Android, menggantikan pola dua tombol

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab III Fase 1–4, Lampiran 5 (rancangan antarmuka)
- **Menggantikan sebagian:** ADR-0005 (bentuk input taktil), ADR-0006 (letak tombol batal)

## Konteks

Antarmuka pertama kami dibangun di atas satu pola kaku: **tindakan utama 75%
tinggi layar, tombol Batalkan 25% di bawahnya, tidak pernah lebih dari dua
tombol**. Alasannya masuk akal pada waktunya — pengguna tunanetra menavigasi
lewat ingatan otot dan posisi tetap, jadi tata letak yang tidak pernah berubah
mengurangi beban penjelajahan.

Dua hal mengubah gambarannya.

**Pertama, Fajar membuat prototipe antarmuka lengkap** (`UI reference/`): lima
layar, lengkap dengan bilah atas berisi tombol kembali dan penghitung langkah
`02 / 04`, batang kemajuan, kartu hasil di atas kamera, papan angka, dan layar
pedagang. Prototipe itu jauh lebih matang daripada yang kami punya, dan ia
mengikuti pola aplikasi Android berlangkah yang sudah baku.

**Kedua, dan ini yang menentukan:** pengguna sasaran kami memakai Android
setiap hari, dengan TalkBack, di aplikasi-aplikasi lain. Mereka sudah hafal
cara kerja Android — tombol kembali di pojok kiri atas, satu langkah per layar,
tindakan di bawah. Pola dua tombol kami memang konsisten, tetapi ia konsisten
dengan **dirinya sendiri saja**. Setiap kebiasaan yang harus dipelajari khusus
untuk aplikasi kami adalah beban yang tidak perlu ada.

Aksesibilitas bukan berarti membuat sesuatu yang berbeda. Sering kali ia berarti
membuat sesuatu yang **sudah dikenal**.

## Keputusan

Antarmuka mengikuti struktur prototipe Fajar dan kebiasaan Android, dengan tiga
penyesuaian yang menjaga janji aksesibilitas kami.

### 1. Kerangka berlangkah menggantikan pola 75/25

Setiap fase kini satu layar: bilah atas (kembali, `01 / 04`, judul, batang
kemajuan), isi, lalu area aksi di bawah. Sama seperti wizard Android mana pun.

**Ketuk di mana saja tetap hidup.** Prototipe Fajar mempertahankannya, dan itu
benar. Seluruh layar tetap menjadi sasaran tindakan utama lewat `LapisanKetuk`,
sementara tombol yang terlihat melakukan hal yang sama untuk orang yang bisa
melihatnya. Lapisan itu `aria-hidden` supaya TalkBack tidak menemukan dua
kendali yang mengerjakan satu hal.

Satu pengecualian: **layar papan angka tidak punya lapisan ketuk.** Layar itu
penuh tombol, dan sasaran sebesar layar di belakangnya akan menelan setiap
ketukan yang meleset sedikit lalu mengunci nominal yang belum selesai diketik.

### 2. Papan angka menggantikan deret tombol pecahan

ADR-0005 menetapkan input taktil sebagai jalur utama, dan itu tidak berubah.
Yang berubah bentuknya: dari delapan tombol pecahan (`+50.000`, `+20.000`, …)
menjadi papan angka 1–9, 0, AC, hapus.

Alasannya sama dengan keputusan besar di atas: tata letak `1 2 3 / 4 5 6 /
7 8 9 / 0` adalah tata letak papan panggil telepon — sudah dihafal jari setiap
pengguna Android. Deret tombol pecahan menuntut mempelajari delapan tombol baru
yang hanya ada di aplikasi ini.

Yang hilang: memasukkan 50.000 kini lima ketukan, bukan satu. Yang didapat:
nominal apa pun bisa dimasukkan langsung, tanpa menyusunnya dari pecahan, dan
tanpa mempelajari apa pun yang baru.

### 3. Wajah huruf sistem menggantikan Geist

Prototipe memanggil Geist lewat Google Fonts. Itu tidak bisa dipakai apa adanya:
aturan pertama proyek ini melarang permintaan jaringan dalam bentuk apa pun.

Penggantinya bukan kompromi. `system-ui` di Android berarti **Roboto**, wajah
huruf yang dipakai seluruh sistem operasinya — untuk aplikasi yang memang ingin
terasa seperti bagian dari Android, itu justru lebih tepat daripada Geist, dan
harganya nol byte.

Seluruh warna heksadesimal disalin **verbatim** dari berkas HTML prototipe, bukan
dicocokkan dengan mata dari tangkapan layar.

## Konsekuensi

**Menjadi lebih baik**

- Alurnya mengikuti kebiasaan yang sudah dimiliki pengguna, bukan kebiasaan yang
  harus mereka pelajari.
- Pengguna tahu ada di langkah berapa dan berapa langkah lagi tersisa —
  informasi yang sama sekali tidak ada di pola dua tombol.
- Ada jalan kembali satu langkah, bukan hanya membatalkan seluruh transaksi.
- Prototipe Fajar terpakai sebagaimana mestinya, bukan sekadar dijadikan
  rujukan longgar.

**Menjadi lebih buruk, dan bagaimana kami menanganinya**

- Jumlah kendali per layar bertambah, sehingga penjelajahan TalkBack lebih
  panjang. Ditangani dengan menjaga tindakan utama tetap sebagai kendali
  pertama di area aksi dan mempertahankan ketuk di mana saja.
- Tombol kembali dan tombol senter lebih kecil daripada tombol raksasa
  sebelumnya. Keduanya dijaga minimal 48 piksel — anjuran Android — sementara
  tombol aksi utama memakai 64 piksel, dan keduanya jauh di atas syarat WCAG 2.2
  kriteria 2.5.8 yang hanya 24 piksel.
- Posisi tombol tidak lagi identik di setiap fase. Ditangani dengan
  mempertahankan urutan yang tetap: tindakan utama selalu tombol pertama di
  bawah, batal selalu di bawahnya.

**Yang tidak berubah**

Tidak ada gestur seret, tidak ada gestur tahan, tidak ada kendali yang hanya
bisa ditemukan dengan melihat. Setiap alur masih bisa diselesaikan dari awal
sampai akhir tanpa melihat layar — syarat yang tidak pernah bisa ditawar.

## Alternatif yang ditolak

- **Mempertahankan pola dua tombol dan mengabaikan prototipe.** Ditolak karena
  membuang pekerjaan yang sudah matang, dan karena konsistensi internal kalah
  penting dibanding kebiasaan yang sudah dimiliki pengguna.
- **Mengambil tampilan prototipe tanpa mengubah alur.** Ditolak karena
  penghitung langkah dan tombol kembali bukan hiasan; keduanya hanya berarti
  bila alurnya memang berlangkah.
- **Membundel Geist sebagai berkas font.** Mungkin dilakukan dan tetap luring,
  tetapi menambah beberapa ratus kilobyte ke APK demi perbedaan yang tidak akan
  disadari siapa pun — sementara Roboto membuat aplikasi ini terasa lebih
  menyatu dengan Android, yang justru tujuan kami.
