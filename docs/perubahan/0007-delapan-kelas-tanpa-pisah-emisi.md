# ADR-0007: Pakai 8 kelas, jangan pisahkan tahun emisi

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab II (SMART/Specific), Bab III bagian 3.3, Lampiran 7 nomor 1

## Konteks

Exsum menetapkan model mengenali **15 kelas**: 7 pecahan Rupiah dikali 2 tahun
emisi (TE 2016 dan TE 2022), ditambah 1 kelas presensi koin.

Saat menyiapkan pipeline pelatihan, kami memeriksa ulang apa yang sebenarnya
dilakukan sistem dengan informasi tahun emisi. Jawabannya: **tidak ada.**

Tahun emisi tidak pernah diucapkan kepada pengguna. Yang keluar dari pengeras
suara adalah "lima puluh ribu rupiah", bukan "lima puluh ribu rupiah tahun
emisi dua ribu dua puluh dua". Ia juga tidak dipakai kalkulator kembalian,
tidak tampil di Merchant Display, dan tidak mempengaruhi satu pun keputusan
dalam state machine transaksi. Informasi itu dikenali, lalu dibuang.

Sementara itu, memisahkannya menimbulkan biaya yang nyata:

1. **Data latih terbelah dua.** Setiap nominal hanya mendapat separuh sampel
   dibanding kalau digabung. Pada dataset berukuran ±1.400 citra, ini
   perbedaan yang terasa langsung pada akurasi.
2. **Model dipaksa membedakan hal yang sulit dan tidak berguna.** Dua lembar
   50.000 dari tahun emisi berbeda mirip secara visual. Kita membebani model
   dengan pertanyaan yang jawabannya tidak pernah kita gunakan — dan pada uang
   lecek, perbedaan itu makin kabur.
3. **Menghambat penyaringan tumpukan.** Satu lembar uang yang terdeteksi
   sebagai dua kelas berbeda mempersulit NMS memisahkan lembaran bertumpuk.
4. **Dataset Rupiah publik tidak memisahkan emisi.** Memakainya berarti harus
   melabeli ulang ribuan kotak, pekerjaan berjam-jam yang tidak menghasilkan
   kemampuan baru.

## Keputusan

Kami memakai **8 kelas**: 7 pecahan Rupiah ditambah 1 kelas presensi koin.

```
0 = 1.000    3 = 10.000    6 = 100.000
1 = 2.000    4 = 20.000    7 = koin
2 = 5.000    5 = 50.000
```

Model tetap **mengenali uang dari kedua tahun emisi** — TE 2016 dan TE 2022
sama-sama masuk ke kelas nominal yang sama. Yang berubah bukan cakupan uang
yang dikenali, melainkan apakah perbedaan tahun emisi diberi label terpisah.
Klaim exsum bahwa SUDEPI mendukung TE 2016 dan TE 2022 tetap benar sepenuhnya.

Bidang `emisi` dihapus dari `Denominasi` di `src/contracts/uang.ts`. Bidang
yang selalu bernilai null hanya mengundang pertanyaan dari pembaca kode
berikutnya.

## Konsekuensi

**Menjadi lebih baik**

- Sampel per kelas menjadi dua kali lipat. Ini keuntungan akurasi terbesar
  yang bisa kami dapat tanpa menambah satu foto pun.
- Model tidak lagi dihukum karena gagal membedakan hal yang tidak kami
  tanyakan. Pada uang lecek — kasus yang justru kami klaim kuat di proposal —
  ini langsung terasa.
- Dataset Rupiah publik dapat dipakai apa adanya, tanpa pelabelan ulang.
- Pelatihan lebih cepat dan konvergen lebih awal.
- NMS class-agnostic menjadi lebih bersih: satu benda fisik, satu kelas.
- Keluaran model mengecil dari `[1, 19, 2100]` menjadi `[1, 12, 2100]`.

**Menjadi lebih buruk**

- Angka "15 kelas" di Bab II, Bab III, dan Lampiran 7 tidak lagi cocok dengan
  implementasi. Perlu dijelaskan saat presentasi, dan dokumen inilah
  penjelasannya.
- Kalau suatu saat ada kebutuhan membedakan tahun emisi — misalnya mendeteksi
  uang yang sudah ditarik dari peredaran — model harus dilatih ulang dengan
  label yang lebih halus. Tidak ada kebutuhan seperti itu sekarang.
- `src/contracts/uang.ts` berubah padahal berstatus beku, sehingga menuntut
  koordinasi dan commit tersendiri.

## Alternatif yang ditolak

- **Tetap 15 kelas sesuai exsum.** Ditolak karena membayar akurasi — hal yang
  paling menentukan kegunaan produk ini — demi kesetiaan pada angka yang tidak
  memberi kemampuan apa pun. Panitia menyatakan implementasi tidak harus sama
  persis dengan proposal sepanjang perbedaannya didokumentasikan, dan inilah
  dokumennya.
- **Melatih 15 kelas lalu menggabungkannya saat inferensi.** Menggabungkan di
  hilir tidak mengembalikan sampel yang sudah terbelah di hulu, jadi kerugian
  akurasinya tetap ada sementara kerumitannya bertambah.
- **Memakai 8 kelas untuk model tetapi tetap menulis 15 di dokumen.** Ditolak
  tanpa ragu. Dokumen yang tidak cocok dengan kenyataan persis seperti itulah
  yang menjatuhkan kredibilitas seluruh dokumen lain yang benar.
