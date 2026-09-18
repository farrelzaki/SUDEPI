# TASK.md

Gunakan file ini untuk mencatat pekerjaan proyek. Satu task harus memiliki tujuan, scope, kriteria selesai, risiko, dan rencana verifikasi yang jelas.

## Status Task

- `[ ]` Belum dikerjakan atau berada di backlog.
- `[~]` Sedang dikerjakan.
- `[x]` Selesai dan sudah diverifikasi.
- `[-]` Dibatalkan dengan alasan yang dicatat.

## Prioritas

- `Tinggi`: menghambat pekerjaan lain atau sangat penting.
- `Sedang`: penting, tetapi tidak menghambat pekerjaan utama.
- `Rendah`: peningkatan atau pekerjaan yang dapat ditunda.

## Fase Competition

- `Scope`: tujuan, konteks, batasan, non-goals, dan kriteria sukses.
- `Discovery`: bukti dari file, struktur, implementasi, test, dan konfigurasi.
- `Analysis`: akar masalah, alternatif, rekomendasi, risiko, dan hal yang belum diketahui.
- `Plan`: file terdampak, urutan perubahan, dan rencana verifikasi.
- `Approval`: menunggu persetujuan pengguna sebelum menulis.
- `Implementation`: mengerjakan scope yang disetujui.
- `Verification`: menguji hasil, regresi, edge case, dan risiko yang relevan.
- `Handoff`: memperbarui state dan melaporkan hasil akhir.

## Task Aktif

### [~] Menunggu bobot model dari Fajar

- Status: [~] Model asli terpasang di public/model/sudepi.onnx, siap diuji fisik Farrel di perangkat
- Fase: Verification
- Mode: competition
- Prioritas: Tinggi
- Tujuan: Menyambungkan model sungguhan, lalu mengkalibrasi ambang dengan uang asli dan membuktikan seluruh alur berjalan dalam mode pesawat.
- Konteks dan bukti awal: Seluruh aplikasi selesai dan TERBUKTI berjalan utuh Fase 1 sampai 4 di Galaxy M32 memakai model tiruan. 204 tes lulus. Riwayat tersimpan di IndexedDB perangkat. Rinciannya di PROJECT_STATE.md dan docs/PROGRES.md.
- Scope termasuk: Memasang `public/model/sudepi.onnx`; menjalankan `model/periksa_onnx.py`; uji tiap pecahan dengan uang sungguhan; kalibrasi ambang pada uang lecek; uji mode pesawat; uji layar tertutup telapak tangan.
- Non-goals: Menambah fitur baru. Cakupan dibekukan.
- Dependensi: **`public/model/sudepi.onnx` dari Fajar.**

Kriteria selesai:

- [x] `python model/periksa_onnx.py public/model/sudepi.onnx` lolos (3.1 MB, [1, 3, 320, 320] -> [1, 12, 2100])
- [ ] Ketujuh pecahan dikenali benar satu per satu dengan uang sungguhan
- [ ] Latensi inferensi terukur di bawah 250 ms di Galaxy M32
- [ ] Satu transaksi utuh berhasil dengan uang sungguhan
- [ ] Seluruh alur berjalan dalam mode pesawat
- [ ] Satu transaksi diselesaikan dengan layar tertutup telapak tangan
- [x] Model tiruan DIHAPUS dari `public/model/` (sudah diganti model asli 3.1 MB)
- [ ] Model tiruan dihapus dari perangkat Samsung Galaxy M32 (deploy ulang)

Risiko dan asumsi:

- Risiko tertinggi: urutan kelas di `data.yaml` tidak cocok dengan `TABEL_DENOMINASI`. Kini bisa dideteksi mesin lewat `model/periksa_kelas.py`, tetapi kecocokan bentuk tidak menjamin kecocokan urutan — hanya uang sungguhan yang bisa membuktikannya.
- Risiko: model tiruan tertinggal dan terpakai saat demo. Ia selalu menyebut Rp50.000 tanpa melihat apa pun. Penanda `public/model/MODEL_TIRUAN` ada untuk ini.
- Asumsi: bobot diekspor lewat `model/ekspor.py`, sehingga parameter ADR-0001 dan ADR-0002 otomatis benar.

Rencana verifikasi:

- `model/periksa_onnx.py`, lalu `pnpm cap:run`
- Skenario `docs/DEMO.md` tiga kali berturut-turut tanpa gagal
- Mode pesawat menyala sepanjang pengujian

Checkpoint dan approval:

- Scope: Disetujui
- Discovery: Selesai
- Analysis: Selesai
- Plan: Selesai
- Approval sebelum implementasi: Disetujui
- Verification: **Terhambat menunggu model**

Catatan:

- Dataset gabungan 8 kelas (Delta v9 + Koin, 44.376 citra, 320x320) siap di `model/dataset_delta_sudepi.zip`.
- Notebook training `model/latih.ipynb` siap dan dioptimalkan untuk NVIDIA A100 (Google Colab Pro).
- Model TIRUAN sedang terpasang di HP dan di `public/model/`. Hapus begitu model asli tiba.
- Overlay metrik (latensi, fps, luma) masih tampil di pratinjau. Berguna untuk kalibrasi, dibuang sebelum penjurian sesuai `docs/DEMO.md`.

<!--
Simpan hanya satu task yang sedang dikerjakan di bagian ini.
Salin template berikut saat membuat task baru. Jangan mengisi approval sebagai disetujui sebelum pengguna benar-benar menyetujuinya.

### [~] Judul task

- Status: [~] Sedang dikerjakan
- Fase: Scope / Discovery / Analysis / Plan / Approval / Implementation / Verification / Handoff
- Mode: competition / standard
- Prioritas: Tinggi / Sedang / Rendah
- Tujuan: Jelaskan hasil yang ingin dicapai.
- Konteks dan bukti awal: Tulis fakta yang sudah diketahui atau `Belum diperiksa`.
- Scope termasuk: Tulis bagian yang akan dikerjakan.
- Non-goals: Tulis bagian yang tidak akan dikerjakan.
- Dependensi: Tulis task atau kondisi yang harus tersedia, atau `Tidak ada`.

Kriteria selesai:

- [ ] Kriteria hasil pertama terpenuhi.
- [ ] Kriteria hasil kedua terpenuhi.
- [ ] Test atau pemeriksaan yang relevan berhasil.

Risiko dan asumsi:

- Risiko: Belum diidentifikasi.
- Asumsi: Belum diidentifikasi.

Rencana verifikasi:

- Tulis test, lint, build, pemeriksaan manual, atau pemeriksaan lain yang relevan.

Checkpoint dan approval:

- Scope: Menunggu
- Discovery: Menunggu
- Analysis: Menunggu
- Plan: Menunggu
- Approval sebelum implementasi: Menunggu
- Verification: Menunggu

Catatan:

- Tambahkan keputusan, blocker, atau konteks penting di sini.
-->

## Backlog

### [ ] Selesaikan hutang latensi — WAJIB sebelum penjurian

- Prioritas: Tinggi
- Pemicu: **begitu seluruh sistem selesai dan stabil**
- Tujuan: Menyelesaikan selisih antara latensi terukur (~700 ms) dan angka yang
  dijanjikan Bab II exsum (di bawah 250 ms).
- Konteks: Terukur di Galaxy M32 dengan YOLOv8n berbobot acak. Penyebabnya ONNX
  Runtime berjalan satu utas padahal perangkat punya delapan inti, karena WASM
  multithread butuh cross-origin isolation yang tidak disediakan server lokal
  Capacitor.
- Sudah diuji dan gagal menutup jarak: INT8 (hanya 8% lebih cepat) dan
  menurunkan `imgsz` (256 → ~480 ms, 192 → ~300 ms).
- Tiga pilihan lengkap dengan konsekuensinya ada di ADR-0009.

Kriteria selesai:

- [ ] Satu dari tiga pilihan ADR-0009 dipilih Farrel
- [ ] ADR-0009 diubah dari DITUNDA menjadi Diterima, dengan alasannya
- [ ] Kalau pilihannya memperbaiki angka: seluruh dokumen yang menyebut 250 ms
      ikut diperbarui, termasuk `docs/PROGRES.md` dan bahan presentasi

Catatan: **jangan menyentuh latensi sebelum sistem selesai.** Mengubah `imgsz`
memaksa Fajar melatih ulang, dan menyentuh kode Java di jalur kritis berisiko
merusak yang sudah terbukti berjalan.

<!-- Tambahkan task berikutnya di sini tanpa perlu membuat rencana panjang. Gunakan status [ ]. -->

## Selesai

- [x] **Bootstrap proyek** — scaffold Vite 7 + React 19 + TS strict, `src/contracts/`, mock. Diverifikasi: `tsc` bersih, 9 tes, build tanpa referensi jaringan. (`0fca155`)
- [x] **Logika inti transaksi** — reducer FSM, kalkulator kembalian, presensi koin. Diverifikasi: 45 tes termasuk seluruh transisi tidak sah. (`7d358fb`)
- [x] **Skema 8 kelas** — ADR-0007, kontrak diubah dalam commit tersendiri. (`77c887a`, `820d89c`)
- [x] **Jalur penglihatan** — decode, NMS class-agnostic, voting temporal, worker ONNX, pemindai kamera. Diverifikasi: 92 tes, bundling worker diuji langsung. (`1722f5e`, `b21a075`)
- [x] **Rantai build Android** — Capacitor 7.6.9, izin kamera, APK terbentuk. Diverifikasi: BUILD SUCCESSFUL, cache Gradle hangat (14 detik setelah yang pertama). (`45754cf`)
- [x] **Audio dan platform** — penyusun bilangan Indonesia, pengucap, pembungkus Capacitor. Diverifikasi: 39 tes bilangan termasuk seluruh kaidah "se-". (`522e1e4`)
- [x] **Antarmuka Fase 1–4** — pola dua tombol, roda taktil, Merchant Display. Diverifikasi: 155 tes termasuk integrasi urutan ucapan. (`75e9857`)
- [x] **Lima bug antarmuka** — ketukan ditolak setelah nominal diucapkan, tombol bersarang, label menjanjikan yang ditolak, path model salah di worker, label bertabrakan TalkBack. Semuanya gagal dalam diam dan tidak tertangkap tes. (`d9438e3`, `7976c1f`, `ae4267f`)
- [x] **Lapisan data** — 8 object store Dexie, penyangga pemindaian, riwayat transaksi. Diverifikasi: 28 tes dengan IndexedDB sungguhan, plus `selesai` ×16 tercatat di perangkat.
- [x] **Audio Indonesia** — 34 potongan WAV dibundel, tiga bug suara diperbaiki lewat uji dengar. (`fa167e9`, `c6b56e1`, `ca94d8f`)
- [x] **Berkas bantu model** — `data.yaml`, `periksa_kelas.py`, `petakan_dataset.py`, `periksa_onnx.py`, `buat_model_uji.py`, `ekspor.py`. Semuanya diuji menangkap kesalahan yang disengaja.
- [x] **Validasi pipeline utuh di perangkat** — Fase 1 sampai 4 sampai layar Transaksi Selesai memakai model tiruan, di Galaxy M32.

<!-- Pindahkan task selesai ke sini jika riwayatnya masih berguna. Sertakan hasil dan verifikasi terakhir. -->
