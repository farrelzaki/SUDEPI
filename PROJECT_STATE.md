# PROJECT_STATE.md

File ini adalah snapshot ringkas kondisi pekerjaan agar sesi berikutnya dapat dilanjutkan tanpa membaca seluruh riwayat percakapan.

Perbarui saat memulai sesi, melewati checkpoint, membuat keputusan penting, menemukan blocker, mengubah arah, berhenti di tengah pekerjaan, atau menyelesaikan task. Jangan menyalin seluruh daftar task atau percakapan ke file ini.

## Metadata

- Terakhir diperbarui: 2026-09-18
- Mode kerja: `competition`
- Status sesi: Berjalan
- Task aktif: Aplikasi utuh Fase 1–4 (selesai), menunggu bobot model
- Fase aktif: Verification
- Checkpoint terakhir: Verification
- Konfirmasi pengguna terakhir: Farrel ambil alih seluruh kode; Fajar fokus model

## Scope Yang Disetujui

**Pembagian berubah 18 September 2026.** Fajar fokus penuh ke `model/`
(dataset, training, ekspor, kuantisasi). Farrel mengambil alih seluruh `src/`
dan berkas akar. Tercatat di `docs/EKSEKUSI.md` dengan blok peringatan bagi
agen AI Fajar.

## Tujuan Saat Ini

Aplikasi sudah utuh dan teruji. Yang tersisa hanyalah menyambungkan model
sungguhan, lalu memverifikasi di HP fisik.

## Progress

Selesai dan terverifikasi:

| Bagian | Isi |
| --- | --- |
| `src/contracts/` | 8 kelas, tipe lintas-modul, beku |
| `src/core/` | Reducer FSM, kalkulator kembalian, presensi koin |
| `src/vision/` | Decode, NMS, voting temporal, worker ONNX, pemindai kamera |
| `src/audio/` | Penyusun bilangan Indonesia, pengucap sprite + cadangan TTS |
| `src/platform/` | Pembungkus Capacitor (haptik, preferensi) + mock |
| `src/ui/` | Pola dua tombol, roda taktil, Merchant Display, Fase 1–4 |
| Capacitor | `cap init` + `cap add android`, APK terbentuk |

**155 tes lulus, `tsc --noEmit` bersih dengan `strict` penuh, `pnpm build`
lolos, APK 8,7 MB terbentuk dalam 14 detik.**

## Bukti Yang Sudah Diperiksa

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm test` | 155 lulus di 10 berkas |
| `npx tsc --noEmit` | Bersih, termasuk `noUncheckedIndexedAccess` dan `exactOptionalPropertyTypes` |
| `pnpm build` | Lolos. Worker ter-bundle, tepat satu berkas `.wasm` |
| `./gradlew assembleDebug` | BUILD SUCCESSFUL. 2m37s saat pertama, **14 detik** setelah cache hangat |
| Isi APK | `.wasm` 14 MB dan `worker.js` ada di `assets/public/assets/` |
| Lingkungan | Node 24.15, pnpm 11.24, Java 17.0.12, SDK API 34/35/36 |

## Sudah Selesai

- Dokumentasi: `CLAUDE.md`, 10 dokumen `docs/`, **8 ADR**.
- Seluruh lapisan aplikasi (lihat tabel Progress).
- Rantai build Android terbukti, cache Gradle hangat.

## Langkah Berikutnya Yang Diusulkan

1. **Fajar: `public/model/sudepi.onnx`.** Ini satu-satunya yang memblokir.
2. Sambungkan HP fisik, `npx cap run android`, verifikasi TalkBack.
3. `src/data/` — skema 8 object store Dexie (efek `SIMPAN_TRANSAKSI` masih
   kosong; transaksi berjalan tanpa riwayat).
4. Render potongan audio ke `public/audio/` (kini memakai cadangan TTS).
5. Kalibrasi ambang dengan uang lecek sungguhan.

## Blocker Dan Hal Yang Belum Diketahui

- **Bobot model belum ada.** Seluruh jalur deteksi sudah ditulis dan diuji,
  tetapi belum pernah dijalankan dengan model sungguhan. `pemindai.ts` akan
  gagal di `siap()` sampai `public/model/sudepi.onnx` tersedia — dan itu
  perilaku yang benar.
- **HP fisik belum pernah terhubung.** `adb devices` masih kosong sejak awal
  sesi. Tampilan, TalkBack, haptik, senter, dan kamera semuanya belum pernah
  diverifikasi di perangkat nyata.
- **Ekstensi browser tidak terhubung**, sehingga uji visual otomatis tidak bisa
  dilakukan. Verifikasi dialihkan ke tes integrasi `core/alur.test.ts` yang
  memeriksa urutan ucapan sepanjang transaksi.
- **Potongan audio belum dirender.** Jalur yang aktif sekarang adalah cadangan
  `speechSynthesis`, yang bergantung pada paket suara id-ID di perangkat.

## Keputusan Penting

- **Delapan ADR diterima.** Paling berdampak: ADR-0001 (`imgsz=320`), ADR-0003
  (audio pra-render), ADR-0005 (input taktil jadi utama — satu-satunya yang
  mempersempit klaim exsum), ADR-0007 (8 kelas), ADR-0008 (klik semantik).
- **Versi dikunci berdasarkan verifikasi npm.** Vite 7.3.6 bukan 8 (Vite 8
  mengganti bundler ke Rolldown, sementara pemuatan `.wasm` ORT adalah jalur
  kritis); TypeScript 5.9.3 bukan 7, alasan sama; `onnxruntime-web` 1.30.0.
- **`wasmPaths` sengaja tidak disetel** dan impor memakai `onnxruntime-web/wasm`.
  Keduanya mencegah berkas 14 MB terbundel dua kali. Dicatat di
  `docs/ARSITEKTUR.md`.
- **Senter lewat Web API, bukan plugin.** Satu plugin native lebih sedikit
  berarti satu kemungkinan kegagalan Gradle lebih sedikit.
- **`androidScheme: 'https'`.** WebView memperlakukan http sebagai origin tidak
  aman dan `getUserMedia` menolak berjalan di sana — kamera mati tanpa pesan.
