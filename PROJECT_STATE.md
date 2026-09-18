# PROJECT_STATE.md

File ini adalah snapshot ringkas kondisi pekerjaan agar sesi berikutnya dapat dilanjutkan tanpa membaca seluruh riwayat percakapan.

Perbarui saat memulai sesi, melewati checkpoint, membuat keputusan penting, menemukan blocker, mengubah arah, berhenti di tengah pekerjaan, atau menyelesaikan task. Jangan menyalin seluruh daftar task atau percakapan ke file ini.

## Metadata

- Terakhir diperbarui: 2026-09-18
- Mode kerja: `competition`
- Status sesi: Berjalan
- Task aktif: Logika inti transaksi (`src/core/`)
- Fase aktif: Implementation
- Checkpoint terakhir: Verification (task Bootstrap diterima)
- Konfirmasi pengguna terakhir: Fase 0 diterima, lanjut `core/` lebih dulu

## Scope Yang Disetujui

**Task sebelumnya — Bootstrap proyek SUDEPI: SELESAI** (commit `0fca155`).

**Task aktif — Logika inti transaksi.** Menulis `src/core/` sesuai Fase 1
bagian Farrel di `docs/EKSEKUSI.md`:

- `mesin.ts` — reducer murni state machine transaksi beserta `Efek[]`
- `kembalian.ts` — kalkulator kembalian, menolak bayar kurang dari belanja
- `koin.ts` — penurunan nominal koin dari selisih
- Tes Vitest untuk ketiganya, termasuk transisi yang **tidak sah**

Non-goals: `src/vision/`, ekspor model, skema Dexie, UI.

## Tujuan Saat Ini

Menyediakan otak transaksi yang sudah teruji penuh, sehingga saat pipeline
deteksi dan UI menyusul, keduanya tinggal disambungkan ke logika yang sudah
terbukti benar. Dikerjakan lebih dulu karena logika murni tidak bergantung
pada model, kamera, maupun HP.

## Progress

- Lapisan dokumentasi selesai (`743858b`, `1d5b13c`).
- **Fase 0 Bootstrap selesai dan terverifikasi** (`0fca155`): scaffold Vite 7 +
  React 19 + TS strict, `src/contracts/` lengkap, mock vision, 9 tes lulus,
  build bersih tanpa referensi jaringan.
- Sedang berjalan: `src/core/`.

## Bukti Yang Sudah Diperiksa

Lingkungan, diverifikasi dengan menjalankan perintahnya:

| Komponen | Hasil |
| --- | --- |
| Node.js | v24.15.0 |
| pnpm | 11.24.0 |
| Java (JDK) | 17.0.12 LTS |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk`, API 34/35/36, build-tools s.d. 36.1.0 |
| adb | Berfungsi |
| Android Studio | `AI-252.28238.7.2523.14688667` (seri 2025.2 / Otter) |
| `ANDROID_HOME` / `ANDROID_SDK_ROOT` | Kosong, perlu diset (bagian Fajar) |
| HP fisik terhubung | **Belum** (`adb devices` kosong) |

Verifikasi hasil Bootstrap:

| Pemeriksaan | Hasil |
| --- | --- |
| `tsc --noEmit` | Bersih, `strict` penuh termasuk `noUncheckedIndexedAccess` dan `exactOptionalPropertyTypes` |
| `pnpm test` | 9 tes lulus |
| `pnpm build` | 223 kB, path aset relatif `./assets/...` |
| Referensi jaringan di `dist/` | Tidak ada. Hanya `react.dev/errors/`, yaitu teks pesan error React |
| `pnpm dev` | HTTP 200, alias `@` resolve |

## Sudah Selesai

- Dokumentasi sistem: `CLAUDE.md`, `docs/` (9 dokumen termasuk `EKSEKUSI.md`),
  6 ADR di `docs/perubahan/`.
- `README.md` dikonversi dari UTF-16 ke UTF-8.
- `AGENTS.md` diberi pointer ke `CLAUDE.md` dan `docs/`.
- Scaffold, `src/contracts/` (5 berkas + index), mock vision, tes penjaga
  tabel 15 kelas.

## Langkah Berikutnya Yang Diusulkan

**Farrel:** `src/core/` (berjalan), lalu `src/vision/` setelah bobot model ada.

**Fajar:** Fase 0 bagiannya — sambungkan HP dengan USB debugging, set
`ANDROID_HOME`, lalu **`npx cap add android` sebagai prioritas nomor satu**
karena butuh internet sementara demo berjalan dalam mode pesawat.

## Blocker Dan Hal Yang Belum Diketahui

- **HP Android belum terhubung** (`adb devices` kosong). Bagian Fajar. Ini
  satu-satunya kriteria Bootstrap yang belum lulus.
- **Bobot model `.pt` hasil training belum ada di repo.** Memblokir `model/`
  dan `src/vision/`. Inilah sebabnya `src/core/` dikerjakan lebih dulu.
- **Cache Gradle belum pernah hangat.** Build Android pertama mengunduh
  dependensi dalam jumlah besar dan membutuhkan internet. Karena demo
  penjurian berjalan dalam mode pesawat, build pertama harus dilakukan sedini
  mungkin selagi jaringan tersedia.

## Keputusan Penting

- **Dua lapis aturan berlaku bersamaan.** `AGENTS.md` / `TASK.md` /
  `PROJECT_STATE.md` mengatur proses; `CLAUDE.md` + `docs/` mengatur sistem.
  Pointer dua arah sudah dipasang di kedua sisi.
- **Pembagian kerja terbagi per nama** di `docs/EKSEKUSI.md`. Farrel memegang
  `contracts`, `core`, `vision`, `data`, `model`, dan `package.json`; Fajar
  memegang `ui`, `platform`, `audio`, `capacitor`, dan `android`.
- **Enam ADR diterima** (`0001`–`0006`). Paling berdampak: ADR-0001
  (`imgsz=320`), ADR-0003 (audio pra-render), ADR-0005 (input taktil jadi
  jalur utama, mempersempit klaim perintah suara pada exsum).
- **ADR-0004 mendapat amandemen bertanggal.** Alasan "syarat perkakas"
  terbukti tidak berlaku karena Android Studio di mesin ini seri 2025.2.
  Keputusan tidak berubah; alasan utamanya (edge-to-edge) tetap berlaku.
- **Versi dikunci berdasarkan verifikasi ke npm, bukan ingatan.** Vite 7.3.6
  bukan 8 (Vite 8 mengganti bundler ke Rolldown, sementara pemuatan `.wasm`
  ORT adalah jalur kritis); TypeScript 5.9.3 bukan 7 dengan alasan yang sama;
  `onnxruntime-web` 1.30.0.
- **Dua tsconfig digabung jadi satu.** Project reference menuntut `composite`
  dan hanya menambah hal yang bisa rusak pada proyek sekecil ini.
