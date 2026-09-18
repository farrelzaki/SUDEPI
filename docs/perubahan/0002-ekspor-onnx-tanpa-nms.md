# ADR-0002: Ekspor ONNX tanpa NMS, tulis NMS di TypeScript

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab III bagian 3.2 Fase 1, Lampiran 4 (filter IoU > 0,40)

## Konteks

Ekspor YOLOv8 ke ONNX secara bawaan dapat menyertakan lapisan Non-Maximum
Suppression di dalam graf model. Ini praktis di server, tapi bermasalah di
WASM: **tidak seluruh operator yang dipakai lapisan NMS hasil ekspor didukung
oleh backend WASM ONNX Runtime Web.** Kegagalannya muncul saat pemuatan model
atau saat inferensi pertama, yaitu tempat paling mahal untuk menemukan masalah
di tengah lomba.

Ada pertimbangan kedua yang lebih menentukan. Exsum menuntut perilaku NMS yang
**bukan bawaan**: filter IoU di atas 0,40 yang bersifat *class-agnostic*, untuk
mencegah lembaran uang bertumpuk terhitung ganda. NMS bawaan bekerja per kelas,
sehingga selembar 50.000 emisi 2016 dan selembar 50.000 emisi 2022 yang saling
menutupi tidak akan disaring satu sama lain — padahal secara fisik itu satu
tumpukan yang harus dipisahkan, bukan dua uang terpisah.

Artinya, logika penyaringan ini adalah **logika domain milik kami**, bukan
detail teknis model.

## Keputusan

Kami mengekspor dengan `nms=False` dan menulis decode kotak, confidence gating,
serta NMS class-agnostic sendiri di `src/vision/nms.ts` sebagai fungsi murni.

```bash
yolo export model=best.pt format=onnx imgsz=320 opset=12 simplify=True nms=False dynamic=False
```

Model menjadi pengenal pola murni: bingkai masuk, tensor mentah keluar. Seluruh
pengambilan keputusan berada di kode yang bisa kami baca, ubah, dan uji.

## Konsekuensi

**Menjadi lebih baik**

- Seluruh operator dalam graf dijamin didukung backend WASM. Satu kelas
  kegagalan hilang sepenuhnya.
- Ambang IoU dan ambang keyakinan bisa dikalibrasi tanpa mengekspor ulang
  model. Saat kalibrasi uang lecek di jam ke-16, ini adalah perbedaan antara
  penyetelan lima menit dan pengulangan pipeline satu jam.
- NMS menjadi fungsi murni, sehingga bisa diuji Vitest, termasuk kasus sulit
  seperti kotak bertumpuk berat dan deteksi ganda lintas emisi.
- Nilai `iouMaks` bisa disimpan per deteksi untuk jejak audit Abstain Policy,
  sesuatu yang mustahil dilakukan bila NMS tersembunyi di dalam graf.
- Graf model sedikit lebih kecil dan pemuatannya lebih cepat.

**Menjadi lebih buruk**

- Kode decode keluaran harus ditulis dan diverifikasi sendiri, termasuk
  pembalikan letterbox ke koordinat bingkai asli. Ini sumber bug klasik: kotak
  bergeser atau terbalik sumbunya.
- NMS di JavaScript memakan sekitar 10 sampai 15 ms per bingkai. Sudah masuk
  anggaran waktu di `PLAN.md`, tapi bukan nol.
- Bentuk keluaran model harus dipahami dengan benar. Untuk 15 kelas pada
  `imgsz=320`, bentuknya `[1, 19, 2100]`. Kalau yang diterima berbeda, ekspornya
  yang salah, bukan kode decode-nya.

## Alternatif yang ditolak

- **Ekspor dengan `nms=True`.** Ditolak karena risiko operator tidak didukung,
  dan karena ambang IoU menjadi tertanam di dalam model sehingga tidak bisa
  dikalibrasi saat lomba.
- **Memakai `onnxruntime-extensions` untuk operator NMS kustom.** Menambah
  berkas WASM tambahan dan kompleksitas pemuatan, untuk menyelesaikan masalah
  yang sudah selesai dengan 60 baris TypeScript.
- **NMS per kelas, lalu penggabungan lintas kelas menyusul.** Dua tahap
  penyaringan lebih sulit dipikirkan dan diuji dibanding satu tahap
  class-agnostic, tanpa keuntungan berarti.
