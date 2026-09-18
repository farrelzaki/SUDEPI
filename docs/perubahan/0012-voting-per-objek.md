# ADR-0012: Kesepakatan per TEMPAT, dengan dua tingkat keyakinan

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

Kesepakatan dihitung **per tempat di dalam bingkai**, bukan per kelas dan bukan
per himpunan. Sampai ke sana lewat dua kekeliruan, dan keduanya dicatat karena
yang kedua sempat terpasang di perangkat.

### Percobaan 1 — per himpunan (keadaan awal)

Seluruh isi bingkai harus sama persis di 3 dari 5 bingkai. Bekerja untuk satu
lembar; gagal untuk beberapa lembar, sebagaimana diukur di atas.

### Percobaan 2 — per kelas (dicoba, DITARIK)

Tiap pecahan dinilai sendiri. Multi-lembar memang membaik, tetapi muncul
kegagalan yang lebih buruk, dan Farrel langsung merasakannya: **prediksi satu
lembar menjadi kacau.**

Sebabnya kini jelas. Satu lembar yang tebakannya berayun antara beberapa
pecahan membuat masing-masing pecahan mengumpulkan suaranya sendiri. Dengan
tebakan berayun `rp20000, rp50000, rp20000, rp50000, rp20000`, kelas rp20000
memperoleh 3 suara dan rp50000 memperoleh 2 — dan pada ayunan yang sedikit
berbeda, KEDUANYA bisa mencapai tiga. Satu lembar di tangan dilaporkan sebagai
dua lembar, dengan total **lebih besar daripada uang yang sebenarnya ada**.

Itu lebih berbahaya daripada masalah yang hendak diperbaiki. Kehilangan satu
lembar membuat pengguna curiga lalu memindai ulang; mendapat lembar yang tidak
ada membuatnya menyerahkan kembalian yang keliru dengan yakin.

### Percobaan 3 — per tempat (dipakai)

Deteksi dikelompokkan berdasarkan **letaknya di bingkai**, bukan namanya. Satu
tempat berarti satu lembar uang, apa pun tebakan kelasnya. Pencocokan antar
bingkai memakai IoU dengan ambang 0,30 — lebih longgar daripada ambang NMS,
karena di antara dua bingkai ada jeda sekitar 0,7 detik dan tangan yang
memegang uang selalu bergeser.

Sebuah tempat diumumkan hanya kalau **dua syarat** terpenuhi:

1. ia terlihat di sekurang-kurangnya 3 dari 5 bingkai, **dan**
2. kelasnya disepakati di sekurang-kurangnya 3 dari 5 bingkai.

**Tempat yang jelas ada tetapi identitasnya masih berubah-ubah tidak ditebak.**
Seluruh hasil dibatalkan, bukan hanya tempat itu — mengumumkan sisanya berarti
menyebut total yang lebih kecil daripada uang di tangan, dan itu sama
menyesatkannya.

Kedua kegagalan sebelumnya menjadi mustahil sekaligus: lembar yang berkedip
tetap terhitung satu tempat, dan lembar yang namanya belum mantap tidak pernah
disebut.

### Penyempurnaan — dua tingkat keyakinan

Setelah percobaan ketiga terpasang, satu lembar kembali mantap tetapi beberapa
lembar masih goyah: total gabungan sempat terbaca, lalu dalam beberapa detik
menyusut lagi menjadi satu lembar. Sebabnya langsung terbaca dari angka di
atas — lembar kedua hanya melewati ambang keputusan di sekitar seperlima
bingkai, sehingga tempatnya jatuh-bangun melintasi syarat 3 dari 5.

Perbaikannya memisahkan dua pertanyaan yang selama ini dijawab satu ambang:

| Pertanyaan | Bukti yang dibutuhkan |
| --- | --- |
| **Melahirkan** jawaban baru | kuat — di atas `AMBANG_KEYAKINAN` (0,70) |
| **Meneruskan** jawaban lama | lemah — di atas `AMBANG_LEMAH` (0,45) |

Alasannya bukan kelonggaran sembarangan: kotak berkeyakinan sedang di **tempat
yang sudah terbukti berisi uang** bukanlah klaim baru, melainkan kesinambungan
dari klaim yang sudah dibuktikan bukti kuat. Yang berbahaya adalah *memulai*
klaim dari bukti lemah, bukan *mempertahankannya*.

Tiga batas menjaganya:

1. Sebuah tempat harus punya **sekurang-kurangnya dua pengamatan kuat** untuk
   lahir. Satu pengamatan kuat adalah persis definisi kilatan sesaat yang
   seluruh lapisan ini ada untuk menyaring.
2. **Kelas ditentukan hanya oleh pengamatan kuat.** Kotak lemah boleh berkata
   "masih ada sesuatu di sini", tidak pernah "namanya begini".
3. NMS dijalankan atas **gabungan** kuat dan lemah, sehingga kotak lemah yang
   sebenarnya hanya salinan dari kotak kuat ikut tersingkir dan tidak menjelma
   menjadi lembar kedua yang tidak ada.

**Ambang keputusan tidak diturunkan sedikit pun** di sepanjang seluruh
perjalanan ini. Yang ditambahkan adalah tingkat kedua yang wewenangnya
dibatasi, bukan pelonggaran tingkat pertama.

### Kenapa bukan menurunkan ambang

Itu pilihan yang jelas dan salah. Untuk meloloskan objek kedua secara konsisten,
ambang harus turun ke sekitar 0,55. Pada tingkat itu kelas-kelas keliru yang
muncul saat hanya ADA SATU lembar di depan kamera — terukur di 0,50–0,65 —
ikut lolos, dan sistem mulai menyebut uang yang tidak ada.

### Kenapa bukan dua model

Farrel mengusulkan memakai dua model: satu penentu "ini satu lembar atau
beberapa", lalu model lama untuk satu lembar dan model baru untuk beberapa.
Ditolak, dengan tiga alasan yang masing-masing sudah cukup.

**Penentunya melingkar.** Untuk tahu ada berapa lembar, sesuatu harus lebih
dulu menemukan lembar-lembar itu — yaitu persis pekerjaan yang sedang sulit.
Penentu yang bisa menghitung lembar dengan andal berarti kita sudah tidak
punya masalah.

**Latensinya berlipat.** Inferensi sudah ~700 ms terhadap janji 250 ms
(ADR-0009). Menjalankan penentu lalu detektor berarti dua kali lintasan pada
anggaran yang sudah terlampaui hampir tiga kali lipat.

**Ia menyembunyikan penyebabnya, bukan memperbaikinya.** Yang terukur bukan
"model baru buruk untuk satu lembar", melainkan cara kesepakatan dihitung. Dua
model tidak akan menyembuhkan tebakan yang berayun; ia hanya memindahkan
ayunan itu ke dalam model yang dipilih penentu.

Kalau setelah perbaikan ini satu lembar masih kalah tajam dibanding model lama,
obatnya ada di sisi pelatihan — menyeimbangkan porsi citra satu-lembar terhadap
multi-lembar — bukan di sisi inferensi.

## Konsekuensi

**Menjadi lebih baik**

- Multi-lembar akhirnya bekerja sebagaimana dijanjikan Bab III Fase 1.
- Kedipan satu bingkai — tangan bergeser, silau sesaat, jari menutupi sebagian
  — tidak lagi menghapus satu lembar dari jawaban.
- Jumlah lembar bernominal sama ikut terjaga.

**Menjadi lebih ketat, bukan lebih longgar**

Berbeda dari percobaan kedua, aturan per-tempat justru **menambah** satu syarat
yang sebelumnya tidak ada: identitas sebuah lembar harus mantap, bukan sekadar
keberadaannya. Sistem kini bisa berkata "ada uang di sana, tapi aku belum yakin
itu apa" — keadaan yang dulu mustahil diungkapkan dan diam-diam ditebak.

**Yang dijaga tes**

Sembilan tes mengunci batasnya: lembar yang berkedip 3 dari 5 bingkai ikut
diumumkan; yang hanya muncul 2 dari 5 **tidak**; dua lembar bernominal sama
tidak menyusut jadi satu; lembar yang identitasnya berayun **tidak pernah
disebut**; satu tebakan meleset di tengah tidak melumpuhkan sistem; dan lembar
yang bergeser di tangan tetap dihitung satu, bukan beberapa. Tiga lagi menjaga
tingkat kedua: bukti lemah meneruskan lembar yang sudah lahir, bukti lemah saja
**tidak pernah** melahirkan lembar baru, dan bukti lemah tidak boleh mengubah
nama lembar yang sudah jelas.

Satu tes lama ikut diperbaiki. Pembantunya menempatkan uang menurut urutan
larik, sehingga menukar urutan deteksi berarti memindahkan uangnya — keliru
sejak awal, tetapi tidak terlihat selama voting hanya membaca nama kelas.

## Alternatif yang ditolak

- **Menurunkan ambang keyakinan.** Alasannya di atas.
- **Memperbesar jendela voting** (misalnya 3 dari 9). Memberi lembar kedua
  lebih banyak kesempatan, tetapi memperlambat setiap jawaban — pada ~1,4
  bingkai per detik, sembilan bingkai berarti lebih dari enam detik menunggu.
  Kami menukar ketepatan dengan waktu, padahal masalahnya bukan waktu.
- **Menerima apa adanya dan menjelaskannya saat demo.** Ditolak: pengguna
  kehilangan uang secara diam-diam, dan itu justru kegagalan yang seluruh
  produk ini ada untuk mencegahnya.
