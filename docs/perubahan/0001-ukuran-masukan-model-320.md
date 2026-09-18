# ADR-0001: Pakai ukuran masukan model 320, bukan 640

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab II (target latensi < 250 ms), Bab III bagian 3.3

## Konteks

Exsum menargetkan latensi inferensi lokal di bawah 250 ms memakai ONNX Runtime
Web dengan WASM SIMD. Sebelum menulis kode, target ini kami verifikasi terhadap
kenyataan platform, dan ditemukan satu kendala yang tidak disebut di proposal.

ONNX Runtime Web mencapai kecepatan penuhnya lewat WASM **multithread**.
Multithread membutuhkan `SharedArrayBuffer`, yang hanya tersedia bila halaman
berstatus *cross-origin isolated*, yaitu ketika server mengirim header
`Cross-Origin-Opener-Policy: same-origin` dan
`Cross-Origin-Embedder-Policy: require-corp`.

Di dalam WebView Capacitor, halaman disajikan oleh server lokal internal
Capacitor yang tidak menyetel kedua header tersebut. Akibatnya
`self.crossOriginIsolated` bernilai `false`, dan ONNX Runtime Web secara diam-diam
jatuh ke eksekusi **satu utas** — tanpa error, hanya lambat.

YOLOv8-Nano pada `imgsz=640` dengan satu utas di CPU ponsel kelas menengah
berada di kisaran 300 sampai 800 ms per bingkai. Target 250 ms tidak tercapai,
dan pada HP RAM 2 GB yang justru menjadi sasaran pengguna kami, angkanya lebih
buruk lagi.

Namun ada kenyataan lain yang menguntungkan: **uang kertas adalah objek besar
yang mengisi sebagian besar bingkai.** Ia bukan objek kecil di kejauhan seperti
pada kasus penggunaan umum YOLO. Resolusi 640 memberi detail yang tidak kami
butuhkan sama sekali.

## Keputusan

Kami mengekspor dan menjalankan model pada `imgsz=320`, bukan 640.

Beban komputasi turun sekitar 4 kali karena berbanding lurus dengan luas
masukan, sehingga inferensi satu utas masuk ke kisaran 100 sampai 150 ms.
Target di bawah 250 ms tercapai **tanpa bergantung pada multithread sama
sekali**, sehingga tidak ada lagi asumsi platform yang bisa menggagalkannya.

Kami tetap mencoba mengaktifkan COOP/COEP lewat konfigurasi Capacitor. Bila
berhasil, kecepatan bertambah sebagai bonus. Bila gagal, tidak ada yang rusak.
Inilah inti dari keputusan ini: menghapus ketergantungan, bukan mengharapkannya.

## Konsekuensi

**Menjadi lebih baik**

- Target latensi tercapai di jalur yang dijamin ada, bukan di jalur yang
  diharapkan ada.
- Pemakaian memori turun signifikan, sehingga HP RAM 2 GB menjadi realistis.
- Laju bingkai adaptif 5 sampai 10 fps dari exsum menjadi mudah dipenuhi.
- Konsumsi daya turun, relevan untuk pemakaian sepanjang hari di pasar.

**Menjadi lebih buruk**

- Uang kertas yang terletak sangat jauh dari kamera, atau tertangkap sangat
  kecil di sudut bingkai, lebih mungkin terlewat. Untuk pemakaian normal, uang
  dipegang di depan kamera, sehingga dampaknya kecil.
- Model harus dilatih ulang atau setidaknya diekspor ulang pada 320. Melatih
  pada 640 lalu menjalankan pada 320 menurunkan akurasi.
- Tumpukan uang yang sangat banyak dan saling menutupi berat berpotensi lebih
  sulit dipisahkan. Ini sudah ditangani panduan audio "renggangkan lembaran".

## Alternatif yang ditolak

- **Tetap 640 dan berharap multithread aktif.** Ditolak karena mengikat
  keberhasilan demo pada perilaku platform yang sudah terbukti tidak berlaku
  di WebView Capacitor.
- **Menulis plugin native ONNX Runtime Android (Kotlin, XNNPACK/NNAPI).**
  Memberi 30 sampai 80 ms, jauh lebih cepat. Ditolak untuk lomba 24 jam karena
  menambah 3 sampai 4 jam kerja native dan memasukkan risiko Gradle serta ABI
  pada jalur kritis. Ini adalah langkah lanjutan yang tepat setelah lomba.
- **WebGPU atau WebGL execution provider.** WebGPU di Android WebView masih
  bergantung pada versi dan seringkali tidak aktif; cakupan operator WebGL di
  ONNX Runtime Web terbatas. Keduanya menukar risiko yang diketahui dengan
  risiko yang tidak diketahui.
- **`imgsz=416` sebagai jalan tengah.** Masuk akal, dan menjadi cadangan kami
  bila 320 ternyata kurang akurat pada uang lecek saat kalibrasi jam ke-16.
