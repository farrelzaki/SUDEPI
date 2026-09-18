# ADR-0005: Jadikan input taktil jalur utama, perintah suara jadi opsional

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Judul ("Voice Interaction"), Bab II (SMART/Specific), Bab III Fase 2

> **Ini satu-satunya keputusan yang mengurangi cakupan yang dijanjikan
> proposal.** Bagian ini ditulis selengkap mungkin agar dapat
> dipertanggungjawabkan di hadapan dewan juri.

## Konteks

Exsum menyebut pengguna memasukkan total belanja dan uang dibayarkan
"melalui voice command atau roda sentuh". Sebelum implementasi, kami
memverifikasi kelayakan jalur perintah suara, dan menemukan pertentangan
mendasar dengan klaim inti SUDEPI.

**Web Speech API untuk pengenalan suara tidak memproses audio di perangkat.**
Pada Chrome dan WebView Android, `SpeechRecognition` mengirim audio ke layanan
pengenalan milik Google melalui jaringan, lalu menerima teksnya kembali. Ia
tidak bekerja luring, sama sekali.

Ini bertabrakan langsung dengan klaim yang menjadi nilai jual utama SUDEPI dan
tertulis berulang kali di proposal: **100% Offline-First, Zero Cloud Overhead,
teruji dalam mode pesawat.** Menyertakan perintah suara berbasis Web Speech API
berarti salah satu dari dua hal berikut pasti terjadi: aplikasi gagal di mode
pesawat saat demo, atau klaim luring kami tidak benar. Keduanya tidak dapat
diterima.

Persoalan ini diperberat kenyataan lapangan yang sudah kami catat sendiri di
Lampiran 8 risiko nomor 5: kebisingan pasar tradisional dan variasi logat
daerah menurunkan akurasi pengenalan suara. Artinya, bahkan seandainya jalur
daring dipakai, jalur itu tetap bukan jalur yang bisa diandalkan di tempat
SUDEPI sebenarnya dipakai.

Jalur luring sejati **ada**, yaitu `SpeechRecognizer` native Android dengan
`requireOnDeviceRecognition: true` pada Android SDK 33 ke atas, diakses lewat
plugin Capacitor. Namun jalur itu gagal dengan error bila model pengenalan
di perangkat belum terpasang, dan tidak mundur diam-diam ke mode daring.
Ketersediaannya bergantung pada perangkat, dan tidak dapat kami jamin pada HP
yang belum pernah kami sentuh.

## Keputusan

Kami membalik urutan prioritas yang tersirat di exsum.

1. **Roda sentuh taktil menjadi jalur input utama**, bukan alternatif.
   Ia bekerja luring secara mutlak, kebal kebisingan pasar, kebal logat daerah,
   dan dapat diakses penuh lewat TalkBack. Seluruh alur transaksi harus dapat
   diselesaikan dari awal sampai akhir hanya dengan jalur ini.

2. **Perintah suara menjadi peningkatan opsional**, dibangun di atas
   `@capacitor-community/speech-recognition` dengan `requireOnDeviceRecognition: true`.
   Bila pengenalan di perangkat tidak tersedia, fitur ini **tidak ditampilkan**
   dan pengguna tidak pernah tahu ada yang hilang. Tidak ada jalur mundur ke
   pengenalan lewat jaringan, dalam keadaan apa pun.

3. **Keluaran suara tetap utuh sepenuhnya.** Seluruh dialog sistem, penyebutan
   nominal, dan panduan Sonar Aiming berjalan seperti dijanjikan, dan justru
   menjadi lebih andal lewat ADR-0003.

## Konsekuensi

**Menjadi lebih baik**

- Klaim "100% Offline-First" menjadi benar tanpa pengecualian, dan dapat
  dibuktikan di depan juri dengan mode pesawat menyala.
- Jalur utama kebal terhadap dua risiko lapangan terbesar yang kami identifikasi
  sendiri: kebisingan pasar dan variasi logat.
- Waktu pengembangan berkurang beberapa jam, dan dialihkan ke pengerasan alur
  taktil yang memang akan dipakai setiap hari.
- Tidak ada perilaku yang berbeda-beda antar perangkat pada jalur utama.

**Menjadi lebih buruk**

- Frasa "Voice Interaction" pada judul kini terwujud sebagai **interaksi suara
  satu arah** (keluaran), bukan dua arah. Ini penyempitan makna yang nyata
  dibanding pembacaan awam atas proposal, dan kami menyatakannya terbuka
  daripada membiarkannya tersirat.
- Memasukkan nominal lewat roda taktil lebih lambat dibanding mengucapkannya,
  untuk pengguna yang sudah terbiasa.
- Bila perangkat penguji kebetulan mendukung pengenalan luring, fitur suara
  muncul; bila tidak, tidak muncul. Perbedaan ini perlu dijelaskan saat demo
  agar tidak disalahpahami sebagai kegagalan.

## Alternatif yang ditolak

- **Tetap memakai Web Speech API.** Ditolak karena secara langsung membatalkan
  klaim luring yang menjadi pembeda utama SUDEPI dari Google Lookout dan
  Seeing AI. Kami lebih memilih cakupan yang lebih sempit tetapi benar
  daripada cakupan yang lebih luas tetapi tidak jujur.
- **Membundel mesin pengenalan suara luring seperti Vosk.** Benar-benar luring
  dan tidak bergantung perangkat. Ditolak untuk lomba 24 jam karena menambah
  model bahasa sekitar 40 MB ke dalam APK serta 3 sampai 5 jam integrasi
  native pada jalur kritis. **Ini adalah jalur yang tepat untuk pengembangan
  setelah lomba**, dan sebaiknya disampaikan sebagai rencana lanjutan saat
  presentasi.
- **Membuang perintah suara sepenuhnya.** Lebih sederhana, tetapi membuang
  nilai nyata bagi perangkat yang memang mampu menjalankannya luring.
