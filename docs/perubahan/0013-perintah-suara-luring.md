# ADR-0013: Perintah suara luring dengan pengenal kosakata tertutup

- **Status:** Diterima
- **Tanggal:** 2026-09-19
- **Rujukan exsum:** Bab III Fase 2 ("voice command atau roda sentuh")
- **Menggantikan sebagian:** ADR-0005, yang menyatakan perintah suara tidak diimplementasikan

## Konteks

ADR-0005 menurunkan perintah suara menjadi fitur opsional karena Web Speech API
mengirim audio ke server dan membatalkan klaim luring. Keputusan itu benar pada
waktunya. Yang berubah: kami akhirnya mencoba seluruh jalur yang tersisa, dan
menemukan satu yang bekerja tanpa jaringan sama sekali.

### Tiga jalur yang dibuktikan buntu

Semuanya diuji di Samsung Galaxy M32, bukan diduga.

| Jalur | Bukti |
| --- | --- |
| Mesin luring bawaan Android | Berjalan, tetapi menolak: `SodaSpeechRecognizer: Failed to get language pack`. Empat penamaan bahasa dicoba — `id-ID`, `in-ID`, `id`, `in`; Java menamai Bahasa Indonesia dengan kode lama `in` — dan semuanya ditolak dengan alasan yang sama |
| Vosk | Tidak punya model Bahasa Indonesia sama sekali |
| `getUserMedia` di WebView | `NotReadableError: Could not start audio source`, padahal izin Android sudah diberikan, tidak ada aplikasi lain memegang mikrofon, dan saklar privasi sistem tidak aktif |

Jalur pertama sebenarnya bisa dipulihkan dengan mengunduh paket bahasa. Itu
ditolak: fitur yang menuntut pengguna mengunduh sesuatu lebih dulu bukan fitur
luring, melainkan fitur daring yang kebetulan sudah selesai mengunduh.

## Keputusan

Kami membalik pertanyaannya. Kami tidak butuh pengenalan ucapan bebas — kami
butuh **angka**, dan angka dalam Bahasa Indonesia hanya butuh **tujuh belas
kata**. Untuk kosakata sekecil itu, pengenal buatan sendiri justru lebih tepat
daripada model umum berukuran puluhan megabita.

Yang dibangun, seluruhnya dibundel dan tanpa unduhan apa pun:

- **`AudioRecord` di sisi Java**, melewati WebView sepenuhnya. Sumbernya
  `VOICE_RECOGNITION`, dan hasilnya menyeberang sebagai base64 PCM16 — sebagai
  larik angka JSON, dua detik audio menjadi ratusan kilobyte teks dan
  penyeberangan jembatannya sendiri menjadi bagian paling lambat.
- **MFCC** dengan FFT radix-2 yang ditulis sendiri, ditambah **delta dan
  delta-delta**. Literatur pengenalan kata terpisah menyebut delta sebagai
  peningkatan terbesar yang bisa didapat tanpa mengganti pendekatan, dan itu
  cocok dengan kebutuhan kami: bukan mesin yang lebih pintar, melainkan ciri
  yang lebih berbicara.
- **Pemisah kata dengan ambang yang menyesuaikan diri** terhadap lantai derau
  ruangan. Ambang tetap yang bekerja di kamar sunyi akan mendengar keheningan
  sebagai ucapan di pasar.
- **DTW berpita Sakoe-Chiba** dengan normalisasi panjang jalur, supaya kata
  panjang tidak selalu kalah dari kata pendek.
- **Pelatihan suara sekali pakai**, dua putaran, berjalan sendiri setelah satu
  ketukan.

### Dua gerbang yang membuatnya memilih diam

1. Potongan yang tidak cukup mirip contoh mana pun **ditolak seluruhnya**,
   bukan dipaksakan ke kata terdekat.
2. Potongan yang dua kata terdekatnya sama-sama mendekati juga ditolak.
   "Tujuh" dan "puluh" berbunyi mirip, dan memilih asal berarti selisih sepuluh
   kali lipat pada nominal uang.

## Konsekuensi

**Yang didapat:** perintah suara yang bekerja di ponsel mana pun, tanpa
unduhan, tanpa jaringan, dan tanpa bergantung pada apa yang kebetulan terpasang
di perangkat.

**Yang dibayar, dan dinyatakan terbuka:**

- **Bergantung penutur.** Sistem mengenali cara pemiliknya menyebut angka, dan
  harus dilatih sekali — sekitar satu setengah menit. Untuk alat bantu pribadi
  itu wajar, tetapi juri yang ingin mencobanya harus melatih suaranya sendiri
  lebih dulu.
- **Belum terbukti andal di lapangan.** Rantainya lengkap dan lulus 29 tes atas
  suara sintetis, tetapi pengenalan di kalkulator belum berhasil konsisten saat
  diuji langsung. Ambang jarak dan selisihnya belum sempat dikalibrasi dari
  pengukuran, dan itu yang tersisa.

**Privasi.** Yang tersimpan di perangkat bukan rekaman suara melainkan cirinya
— deretan angka yang tidak bisa dikembalikan menjadi bunyi. Suara adalah data
pribadi, dan bentuk paling aman menyimpannya adalah bentuk yang tidak bisa
diputar ulang.

**Satu cacat rancangan yang ditemukan tes, bukan oleh mata.** Pengurangan
rerata cepstral semula dihitung atas seluruh rekaman, sehingga ciri satu kata
bergeser mengikuti berapa lama pengguna terdiam sebelum bicara — membuat contoh
latih tidak sebanding dengan ucapan sungguhan. Sekarang dihitung per potongan
kata.

**Satu jebakan yang tidak terlihat dari luar.** TalkBack ikut terekam: label
tombol berubah menjadi "Sedang mendengarkan" tepat saat mikrofon menyala,
sehingga setiap contoh latih memuat ucapan TalkBack di depannya. Akibatnya
seluruh kata tampak sama jauhnya — terukur, selisih juara dan runner-up sering
hanya setengah persen — dan hampir setiap ucapan ditolak.

## Alternatif yang ditolak

- **Menuntut paket bahasa Google diunduh lebih dulu.** Membuat fitur bergantung
  pada perangkat, dan tidak semua perangkat menyediakannya.
- **Membundel model ASR umum.** Vosk tidak punya Bahasa Indonesia; Whisper
  terlalu berat untuk perangkat sasaran.
- **Memakai dataset publik untuk contoh bawaan.** INDspeech_DIGIT_CDSR berlisensi
  non-komersial dan hanya memuat digit, tanpa "puluh", "ratus", atau "ribu".
