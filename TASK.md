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

### [~] Bootstrap proyek SUDEPI

- Status: [~] Sedang dikerjakan
- Fase: Discovery (selesai, menunggu konfirmasi untuk lanjut ke Analysis/Plan)
- Mode: competition
- Prioritas: Tinggi
- Tujuan: Mengubah repo dari "hanya dokumentasi" menjadi kerangka yang bisa langsung dipakai dua orang secara paralel, dengan rantai build Android yang sudah terbukti berjalan.
- Konteks dan bukti awal: Lingkungan sudah diverifikasi langsung. Node 24.15.0, pnpm 11.24.0, Java 17.0.12, Android SDK lengkap (API 34/35/36, build-tools 36.1.0), adb berfungsi. Belum ada HP terhubung; ANDROID_HOME dan ANDROID_SDK_ROOT masih kosong. Rincian di PROJECT_STATE.md.
- Scope termasuk: Hapus `backend/tes` dan `frontend/tes`; scaffold Vite 7 + React 19 + TypeScript strict + Tailwind 4; struktur folder `src/` sesuai CLAUDE.md; turunkan `docs/KONTRAK.md` jadi `src/contracts/*.ts`; mock wajib (mockMesin, mockPemindai, mockPengucap, platform/mock); Capacitor 7.6.x; Vitest dengan satu tes sanity.
- Non-goals: Model ONNX, pipeline kamera, state machine transaksi, UI sungguhan, audio sprite, skema Dexie.
- Dependensi: HP Android fisik dengan USB debugging untuk kriteria terakhir. Internet untuk build Gradle pertama.

Kriteria selesai:

- [ ] `pnpm dev` berjalan di browser desktop memakai mock
- [ ] `pnpm test` hijau
- [ ] `pnpm build` menghasilkan `dist/` tanpa referensi jaringan
- [ ] `tsc --noEmit` bersih, `src/contracts/` lengkap
- [ ] APK terpasang dan terbuka di HP Android fisik

Risiko dan asumsi:

- Risiko: Build Gradle pertama butuh internet dan berpotensi lama. Harus dijalankan sedini mungkin karena demo berjalan dalam mode pesawat.
- Risiko: Belum ada HP terhubung, sehingga kriteria terakhir tertunda.
- Risiko: Rekan tim membuat struktur tandingan. Sudah dimitigasi lewat koordinasi; scaffold dikerjakan satu orang.
- Asumsi: Capacitor 7.6.x berjalan dengan Java 17 dan build-tools yang tersedia. Belum diverifikasi sampai build pertama dijalankan.

Rencana verifikasi:

- `pnpm test`, `pnpm build`, `npx tsc --noEmit`
- `adb devices` lalu `pnpm cap:run` untuk memasang APK
- Periksa `dist/` tidak memuat URL absolut ke host mana pun

Checkpoint dan approval:

- Scope: Disetujui
- Discovery: Selesai, menunggu konfirmasi
- Analysis: Menunggu
- Plan: Menunggu
- Approval sebelum implementasi: Menunggu
- Verification: Menunggu

Catatan:

- Temuan Discovery menyentuh ADR-0004: Android Studio di mesin ini seri 2025.2 (Otter), sehingga syarat perkakas Capacitor 8 sebenarnya terpenuhi. ADR perlu diamandemen agar akurat. Alasan utamanya (edge-to-edge) tetap berlaku.

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

Belum ada task yang selesai.

<!-- Pindahkan task selesai ke sini jika riwayatnya masih berguna. Sertakan hasil dan verifikasi terakhir. -->
