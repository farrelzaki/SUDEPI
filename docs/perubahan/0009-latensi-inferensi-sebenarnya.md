# ADR-0009: Latensi inferensi sebenarnya ~700 ms, bukan di bawah 250 ms

- **Status:** DITUNDA — diangkat kembali setelah sistem selesai
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab II (SMART/Measurable), Bab III bagian 3.3

## Konteks

Exsum menjanjikan **latensi inferensi lokal di bawah 250 ms**. Angka itu
diulang di Bab II sebagai indikator keberhasilan dan dipakai sebagai landasan
klaim "respon instan".

Sampai hari ini angka tersebut belum pernah diukur. Model tiruan yang dipakai
untuk menguji pipeline hanya mengeluarkan konstanta tanpa menghitung apa pun,
sehingga latensi yang terbaca darinya tidak berarti.

Kami membuat model patokan: **YOLOv8n sungguhan, 8 kelas, bobot acak** — beban
komputasinya identik dengan model asli nanti, hanya belum pandai. Lalu diukur
di Samsung Galaxy M32 (Android 12, 8 inti, RAM 8 GB).

### Hasil pengukuran

| Tahap | Waktu |
| --- | --- |
| Persiapan bingkai (letterbox, normalisasi) | ~30 ms |
| **Inferensi ONNX Runtime WASM** | **~700 ms** |
| Decode + NMS + voting | ~1 ms |

Kode kami sendiri bukan masalahnya. Seluruh decode, NMS class-agnostic, dan
voting temporal selesai dalam **1 milidetik**. Persiapan bingkai 30 ms. Yang
memakan waktu hanya inferensi.

### Kenapa selambat itu

```
[PERF] utas=1  isolated=false  inti=8
```

Perangkat punya **8 inti**, tetapi ONNX Runtime berjalan dengan **satu utas**.
Penyebabnya persis yang sudah diperkirakan ADR-0001: WASM multithread
membutuhkan `SharedArrayBuffer`, yang hanya tersedia bila halaman berstatus
*cross-origin isolated*, dan server lokal Capacitor tidak mengirim header
`COOP`/`COEP` yang diperlukan.

Yang meleset dari ADR-0001 adalah **besarnya**. Di sana kami memperkirakan
inferensi satu utas berada di kisaran 100–150 ms pada `imgsz=320`. Kenyataannya
sekitar lima kali lipat dari itu. Perkiraan tersebut tidak pernah diverifikasi,
dan seharusnya ditandai sebagai perkiraan, bukan dipakai sebagai landasan.

### Dua jalur yang sudah diuji dan gagal menutup jarak

**Kuantisasi INT8.** Ukuran model turun drastis (11,6 MB → 3,1 MB), tetapi
inferensi hanya membaik sekitar 8% — dari ~700 ms menjadi ~650 ms. Biaya
quantize dan dequantize di WASM memakan hampir seluruh keuntungannya.

**Menurunkan resolusi masukan.** Diukur langsung di perangkat:

| `imgsz` | Inferensi | Terhadap target |
| --- | --- | --- |
| 320 | ~700 ms | 2,8× di atas |
| 256 | ~480 ms | 1,9× di atas |
| 192 | ~300 ms | 1,2× di atas |

Bahkan pada 192 — resolusi yang sudah terlalu kecil untuk membedakan pecahan
dengan aman — targetnya masih terlewat. Menurunkan resolusi bukan jalan keluar.

### Akibat sampingan: perangkat memanas

Selama pengujian, HP menjadi panas dalam hitungan menit. Penyebabnya bukan
inferensi itu sendiri melainkan **tidak adanya jeda di antaranya**: pemindai
memakai `setInterval` 100 ms dengan penjaga "sibuk", sehingga bingkai
berikutnya dimulai SEKETIKA bingkai sebelumnya selesai. CPU bekerja beruntun
tanpa istirahat sama sekali.

Sudah diperbaiki di luar keputusan ini, karena benar apa pun pilihan yang
nanti diambil: bingkai berikutnya kini dijadwalkan setelah yang sekarang usai,
dengan jeda nyata di antaranya. Ditemukan juga bahwa pemindaian **tidak
berhenti saat aplikasi ditinggalkan** — baterai terkuras dan HP memanas tanpa
ada yang menyadarinya, dan pengguna yang tidak bisa melihat layar paling tidak
mungkin menyadarinya. Itu pun sudah ditangani.

Panas juga penting bagi keputusan di bawah: pada perangkat yang memanas,
Android menurunkan frekuensi CPU, sehingga latensi **memburuk seiring waktu
pemakaian**. Angka ~700 ms adalah angka perangkat dingin.

## Keputusan

**Ditunda, 18 September 2026.** Sistem dipertahankan apa adanya untuk sekarang;
perbaikan latensi diurus **di akhir, jika masih ada waktu**.

Alasannya masuk akal pada titik ini: mengubah `imgsz` memaksa Fajar melatih
ulang, dan menyentuh kode Java di jalur kritis berisiko merusak yang sudah
terbukti berjalan. Sementara itu tidak ada satu pun klaim lain yang terpengaruh,
dan target transaksi di bawah 15 detik tetap tercapai.

**Yang harus dilakukan begitu sistem selesai:** angkat kembali tiga pilihan di
bawah ini dan pilih satu. Jangan biarkan ia lewat begitu saja — angka di Bab II
masih menyebut 250 ms, dan itu perlu diselesaikan sebelum penjurian, entah
dengan memperbaikinya atau dengan memperbaiki angkanya.

Tiga pilihan, dengan konsekuensi masing-masing:

### Pilihan A — Perbaiki angkanya di proposal, pertahankan sistemnya

Nyatakan latensi inferensi apa adanya (~700 ms) dan jelaskan bahwa **target
transaksi di bawah 15 detik tetap tercapai**. Pada ~1,4 bingkai per detik,
voting temporal 3-dari-5 mencapai kesimpulan dalam sekitar 3,5 detik — cukup
untuk transaksi kasir, walaupun tidak "instan".

Jujur, tidak berisiko, dan tidak mengorbankan akurasi. Yang hilang hanya satu
angka di proposal.

### Pilihan B — Buka multithread lewat header COOP/COEP

Perangkat punya 8 inti yang menganggur. Empat utas berpotensi memberi ~200 ms,
menembus target **tanpa mengorbankan akurasi sama sekali**.

Caranya menyisipkan header `Cross-Origin-Opener-Policy` dan
`Cross-Origin-Embedder-Policy` pada respons server lokal Capacitor. Capacitor
7 tidak menyediakan konfigurasi untuk itu, sehingga perlu menimpa
`WebViewClient` di `MainActivity` — kode Java di folder `android/` yang tidak
masuk git dan akan hilang bila proyek Android dibuat ulang.

Risikonya nyata: `COEP: require-corp` dapat memutus pratinjau kamera atau aset
lain, dan pembuktiannya hanya bisa dilakukan dengan mencoba. Imbalannya juga
nyata: ini satu-satunya jalur yang menembus target tanpa biaya akurasi.

### Pilihan C — Turunkan `imgsz` ke 256

Kompromi: ~480 ms, sekitar 31% lebih cepat, dengan kehilangan resolusi yang
sedang. Masih di atas target, jadi pilihan ini **tidak menyelesaikan** masalah
angka — ia hanya memperkecilnya.

**Keputusan ini mendesak** karena Fajar sedang melatih pada `imgsz=320`.
Berpindah ke 256 berarti melatih ulang.

## Konsekuensi

**Yang sudah pasti membaik**, apa pun pilihannya: kami kini memiliki angka
sungguhan, terukur di perangkat sasaran, sebelum malam penjurian. Klaim yang
tidak bisa dipertahankan jauh lebih berbahaya kalau baru runtuh di depan juri.

**Yang tetap benar:** seluruh klaim lain tidak tersentuh. Aplikasi berjalan
100% luring (sudah diuji), abstain saat tidak yakin, dan menyelesaikan
transaksi utuh. Yang meleset hanya satu angka kecepatan.

**Yang perlu diperbaiki apa pun pilihannya:** perkiraan 100–150 ms pada
ADR-0001 harus ditandai sebagai perkiraan yang terbukti keliru, bukan dibiarkan
terbaca sebagai fakta.

## Alternatif yang ditolak

- **Pura-pura target tercapai.** Angka yang tidak bisa diulang di depan juri
  jauh lebih merusak daripada angka yang jujur sejak awal.
- **Mengukur di HP kelas atas lalu melaporkan angka itu.** Exsum menyebut
  sasaran pengguna HP kelas menengah ke bawah; mengukur di perangkat yang lebih
  cepat berarti mengukur pengguna yang salah.
- **Mengganti ke plugin ONNX Runtime native.** Memberi 30–80 ms dan
  menyelesaikan masalah sepenuhnya, tetapi membutuhkan 3–4 jam kerja native di
  jalur kritis. Sudah ditolak di ADR-0001 dengan alasan yang sama, dan alasan
  itu masih berlaku.
