# ADR-0012: Kesepakatan temporal dihitung per objek, bukan per himpunan

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab III Fase 1 (deteksi multi-lembar), Bab II (zero false-positive)
- **Melengkapi:** ADR-0010 (kalibrasi ambang keyakinan)

## Konteks

Setelah Fajar melatih ulang dengan dataset racikan yang memuat citra
multi-lembar, model **memang mulai melihat lembar kedua** — tetapi aplikasi
masih lebih sering menyebut satu lembar saja.

Diukur di Samsung Galaxy M32 memakai build kalibrasi, 254 bingkai, model
`sudepiv1`. Dari 171 bingkai yang memuat lebih dari satu kelas, sebaran skor
objek KEDUA adalah:

| Skor objek kedua | Bingkai | |
| --- | --- | --- |
| 0,25–0,40 | 55 | jauh di bawah |
| 0,40–0,55 | 49 | |
| 0,55–0,65 | 23 | |
| 0,65–0,70 | 13 | nyaris lolos |
| **0,70–0,80** | **23** | **lolos** |
| **0,80 ke atas** | **8** | **lolos** |

Objek kedua melewati gerbang keyakinan di **18% bingkai** — jauh lebih baik
daripada model sebelumnya, yang tidak pernah mendekati ambang sama sekali
(lihat amandemen ADR-0010).

**Tetapi 18% tidak cukup untuk memenangkan voting.** Voting temporal menuntut
**seluruh isi bingkai sama persis** di 3 dari 5 bingkai. Lembar yang paling
jelas terbaca muncul hampir di setiap bingkai, sementara lembar kedua berkedip
melintasi ambang. Akibatnya himpunan `{A}` terkumpul jauh lebih cepat daripada
himpunan `{A, B}` — dan **jawaban yang menang adalah jawaban yang menghilangkan
uang milik pengguna**.

Itu bukan kegagalan model, dan bukan kegagalan ambang. Itu kegagalan cara
menghitung kesepakatan.

## Keputusan

Kesepakatan dihitung **per pecahan**, bukan per himpunan.

Sebuah pecahan ikut diumumkan kalau ia terlihat di sekurang-kurangnya
`VOTING_BUTUH` dari `VOTING_DARI` bingkai terakhir. Jumlah lembarnya pun
disepakati dengan cara yang sama: diambil angka terbesar `n` yang masih
didukung `VOTING_BUTUH` bingkai, sehingga dua lembar lima ribu tidak menyusut
menjadi satu hanya karena salah satunya sempat tertutup jari.

**Ambang keyakinan tidak diturunkan sedikit pun.** Setiap lembar tetap harus
melewati gerbang 0,70 yang sama. Yang berubah hanya cara bukti temporal
dijumlahkan: per lembar, bukan per himpunan.

### Kenapa bukan menurunkan ambang

Itu pilihan yang jelas dan salah. Untuk meloloskan objek kedua secara konsisten,
ambang harus turun ke sekitar 0,55. Pada tingkat itu kelas-kelas keliru yang
muncul saat hanya ADA SATU lembar di depan kamera — terukur di 0,50–0,65 —
ikut lolos, dan sistem mulai menyebut uang yang tidak ada.

Menukar "kehilangan satu lembar" dengan "menyebut lembar yang tidak ada" adalah
pertukaran yang merugikan. Yang pertama membuat pengguna curiga dan memindai
ulang; yang kedua membuatnya kehilangan uang tanpa pernah tahu.

## Konsekuensi

**Menjadi lebih baik**

- Multi-lembar akhirnya bekerja sebagaimana dijanjikan Bab III Fase 1.
- Kedipan satu bingkai — tangan bergeser, silau sesaat, jari menutupi sebagian
  — tidak lagi menghapus satu lembar dari jawaban.
- Jumlah lembar bernominal sama ikut terjaga.

**Menjadi lebih buruk, dan seberapa besar**

Aturan barunya **sedikit lebih longgar** daripada yang lama, dan itu harus
dinyatakan terang-terangan karena menyangkut janji anti salah-sebut.

Dengan aturan lama, sebuah pecahan keliru hanya bisa lolos bila SELURUH isi
bingkai kebetulan sama persis di 3 dari 5 bingkai. Dengan aturan baru, ia
cukup muncul sendiri di 3 dari 5 bingkai.

Yang membuatnya tetap dapat dipertanggungjawabkan: dalam ketiga kondisi itu ia
masih harus melewati gerbang 0,70 **setiap kali**. Kekeliruan yang bertahan di
atas 0,70 selama tiga bingkai berturut-turut bukan lagi kilatan cahaya atau
guncangan tangan — dan pada data 254 bingkai di atas, kelas keliru tidak pernah
sekali pun mencapainya.

**Yang tetap dijaga tes**

Tiga tes baru mengunci batasnya: lembar yang berkedip 3 dari 5 bingkai ikut
diumumkan, lembar yang hanya muncul 2 dari 5 **tidak**, dan dua lembar
bernominal sama tidak menyusut jadi satu.

## Alternatif yang ditolak

- **Menurunkan ambang keyakinan.** Alasannya di atas.
- **Memperbesar jendela voting** (misalnya 3 dari 9). Memberi lembar kedua
  lebih banyak kesempatan, tetapi memperlambat setiap jawaban — pada ~1,4
  bingkai per detik, sembilan bingkai berarti lebih dari enam detik menunggu.
  Kami menukar ketepatan dengan waktu, padahal masalahnya bukan waktu.
- **Menerima apa adanya dan menjelaskannya saat demo.** Ditolak: pengguna
  kehilangan uang secara diam-diam, dan itu justru kegagalan yang seluruh
  produk ini ada untuk mencegahnya.
