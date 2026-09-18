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

### [~] Menunggu bobot model, lalu verifikasi di HP fisik

- Status: [~] Sedang dikerjakan
- Fase: Verification
- Mode: competition
- Prioritas: Tinggi
- Tujuan: Menyambungkan model sungguhan ke jalur deteksi yang sudah utuh, lalu membuktikan seluruh alur berjalan di perangkat nyata dalam mode pesawat.
- Konteks dan bukti awal: Seluruh lapisan aplikasi selesai dan lulus 155 tes. APK terbentuk. Dua hal belum pernah ada sejak awal: bobot model dan HP fisik.
- Scope termasuk: Memasang `public/model/sudepi.onnx` begitu Fajar menyerahkannya; `npx cap run android`; verifikasi TalkBack, haptik, senter, kamera; kalibrasi ambang dengan uang lecek.
- Non-goals: Menambah fitur baru. Cakupan dibekukan sampai model terbukti jalan.
- Dependensi: **`public/model/sudepi.onnx` dari Fajar** dan HP Android dengan USB debugging.

Kriteria selesai:

- [ ] Model termuat tanpa galat, keluaran berbentuk `[1, 12, 2100]`
- [ ] Latensi inferensi terukur di bawah 250 ms di HP sungguhan
- [ ] Satu transaksi utuh Fase 1 sampai 4 berhasil dengan uang sungguhan
- [ ] Seluruh alur berjalan dengan TalkBack menyala
- [ ] Seluruh alur berjalan dalam mode pesawat

Risiko dan asumsi:

- Risiko: Urutan kelas di `data.yaml` tidak cocok dengan `TABEL_DENOMINASI`. Akibatnya sistem menyebut nominal yang salah dengan penuh keyakinan, dan tidak ada tes yang bisa menangkapnya. Periksa manual dengan tiap pecahan.
- Risiko: Latensi melewati 250 ms di HP kelas bawah. Mitigasi tersedia — turunkan `targetFps`, atau `imgsz` 320 ke 256.
- Asumsi: Model diekspor `nms=False` pada `imgsz=320` dengan 8 kelas. Belum terverifikasi.

Rencana verifikasi:

- `pnpm cap:run` lalu jalankan skenario `docs/DEMO.md`
- Mode pesawat menyala sepanjang pengujian
- TalkBack menyala sepanjang pengujian UI

Checkpoint dan approval:

- Scope: Disetujui
- Discovery: Selesai
- Analysis: Selesai
- Plan: Selesai
- Approval sebelum implementasi: Disetujui
- Verification: **Terhambat menunggu model dan HP**

Catatan:

- Efek `SIMPAN_TRANSAKSI` masih kosong sampai `src/data/` ditulis. Transaksi berjalan normal, hanya tanpa riwayat.
- Potongan audio belum dirender; jalur aktif adalah cadangan `speechSynthesis`.

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

Belum ada task di backlog.

<!-- Tambahkan task berikutnya di sini tanpa perlu membuat rencana panjang. Gunakan status [ ]. -->

## Selesai

- [x] **Bootstrap proyek** — scaffold Vite 7 + React 19 + TS strict, `src/contracts/`, mock. Diverifikasi: `tsc` bersih, 9 tes, build tanpa referensi jaringan. (`0fca155`)
- [x] **Logika inti transaksi** — reducer FSM, kalkulator kembalian, presensi koin. Diverifikasi: 45 tes termasuk seluruh transisi tidak sah. (`7d358fb`)
- [x] **Skema 8 kelas** — ADR-0007, kontrak diubah dalam commit tersendiri. (`77c887a`, `820d89c`)
- [x] **Jalur penglihatan** — decode, NMS class-agnostic, voting temporal, worker ONNX, pemindai kamera. Diverifikasi: 92 tes, bundling worker diuji langsung. (`1722f5e`, `b21a075`)
- [x] **Rantai build Android** — Capacitor 7.6.9, izin kamera, APK terbentuk. Diverifikasi: BUILD SUCCESSFUL, cache Gradle hangat (14 detik setelah yang pertama). (`45754cf`)
- [x] **Audio dan platform** — penyusun bilangan Indonesia, pengucap, pembungkus Capacitor. Diverifikasi: 39 tes bilangan termasuk seluruh kaidah "se-". (`522e1e4`)
- [x] **Antarmuka Fase 1–4** — pola dua tombol, roda taktil, Merchant Display. Diverifikasi: 155 tes termasuk integrasi urutan ucapan. (`75e9857`)

<!-- Pindahkan task selesai ke sini jika riwayatnya masih berguna. Sertakan hasil dan verifikasi terakhir. -->
