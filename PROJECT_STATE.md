# PROJECT_STATE.md

File ini adalah snapshot ringkas kondisi pekerjaan agar sesi berikutnya dapat dilanjutkan tanpa membaca seluruh riwayat percakapan.

Perbarui saat memulai sesi, melewati checkpoint, membuat keputusan penting, menemukan blocker, mengubah arah, berhenti di tengah pekerjaan, atau menyelesaikan task. Jangan menyalin seluruh daftar task atau percakapan ke file ini.

## Metadata

- Terakhir diperbarui: 2026-09-18
- Mode kerja: `competition`
- Status sesi: Berjalan
- Task aktif: Bootstrap proyek SUDEPI
- Fase aktif: Discovery (selesai, menunggu konfirmasi)
- Checkpoint terakhir: Discovery
- Konfirmasi pengguna terakhir: Scope disetujui

## Scope Yang Disetujui

Bootstrap proyek SUDEPI: menghapus sisa scaffold, membuat kerangka
Vite + React + TypeScript strict + Tailwind, struktur folder `src/` sesuai
`CLAUDE.md`, menurunkan `docs/KONTRAK.md` menjadi `src/contracts/*.ts` beserta
mock wajibnya, menyiapkan Capacitor 7.6.x, dan membuktikan APK terpasang di HP
fisik.

Non-goals: model ONNX, pipeline kamera, state machine, UI sungguhan, audio
sprite, skema Dexie. Semuanya task berikutnya.

## Tujuan Saat Ini

Mengubah repo dari "hanya dokumentasi" menjadi kerangka yang bisa langsung
dipakai dua orang secara paralel, dengan rantai build Android yang sudah
terbukti berjalan, bukan sekadar diasumsikan berjalan.

## Progress

- Lapisan dokumentasi selesai dan sudah di-push (commit `743858b`).
- Checkpoint Scope disetujui pengguna.
- Checkpoint Discovery selesai; lingkungan sudah diverifikasi langsung, bukan
  diasumsikan. Hasilnya di bawah.

## Bukti Yang Sudah Diperiksa

Diverifikasi dengan menjalankan perintahnya, bukan dari asumsi:

| Komponen | Hasil |
| --- | --- |
| Node.js | v24.15.0 — siap |
| pnpm | 11.24.0 — siap |
| Java (JDK) | 17.0.12 LTS — siap untuk Gradle |
| Android SDK | Ada di `%LOCALAPPDATA%\Android\Sdk` |
| Android platforms | API 34, 35, 36 — cukup |
| Build-tools | 34.0.0, 35.0.0, 36.0.0, 36.1.0 — cukup |
| adb | Berfungsi (`platform-tools/adb.exe`) |
| Android Studio | Build `AI-252.28238.7.2523.14688667` (seri 2025.2 / Otter) |
| `ANDROID_HOME` | **Kosong** — perlu diset |
| `ANDROID_SDK_ROOT` | **Kosong** — perlu diset |
| adb di PATH | **Tidak** — perlu ditambahkan |
| HP fisik terhubung | **Tidak ada** (`adb devices` kosong) |

## Sudah Selesai

- Dokumentasi sistem lengkap: `CLAUDE.md`, `docs/` (8 dokumen), 6 ADR di
  `docs/perubahan/`, sudah di-commit dan di-push.
- `README.md` dikonversi dari UTF-16 ke UTF-8.
- `AGENTS.md` diberi pointer ke `CLAUDE.md` dan `docs/` (aditif, 7 baris),
  disetujui pengguna.

## Langkah Berikutnya Yang Diusulkan

1. Set `ANDROID_HOME` dan `ANDROID_SDK_ROOT`, tambahkan `platform-tools` ke PATH.
2. Scaffold Vite + React 19 + TypeScript strict + Tailwind 4.
3. Turunkan `docs/KONTRAK.md` menjadi `src/contracts/*.ts` beserta mock wajib.
4. Pasang Capacitor 7.6.x, jalankan build Android pertama **selagi ada internet**
   agar cache Gradle hangat.
5. Sambungkan HP fisik, verifikasi APK terpasang.

Langkah berikutnya hanya dijalankan setelah checkpoint yang diperlukan disetujui pengguna.

## Blocker Dan Hal Yang Belum Diketahui

- **Belum ada HP Android terhubung.** Kriteria selesai "APK terpasang di HP
  fisik" belum dapat dipenuhi. Butuh HP dengan USB debugging aktif. Seluruh
  langkah lain dapat berjalan lebih dulu.
- **Cache Gradle belum pernah hangat.** Build Android pertama mengunduh
  dependensi dalam jumlah besar dan **membutuhkan internet**. Karena demo
  penjurian berjalan dalam mode pesawat, build pertama ini harus dilakukan
  sedini mungkin selagi jaringan tersedia.

## Keputusan Penting

- **Dua lapis aturan berlaku bersamaan.** `AGENTS.md` / `TASK.md` /
  `PROJECT_STATE.md` mengatur proses; `CLAUDE.md` + `docs/` mengatur sistem.
  Pointer dua arah sudah dipasang di kedua sisi.
- **Enam ADR diterima** (`docs/perubahan/0001`–`0006`). Yang paling berdampak:
  ADR-0001 (`imgsz=320`), ADR-0003 (audio pra-render), ADR-0005 (input taktil
  jadi jalur utama, mempersempit klaim perintah suara pada exsum).
- **Scaffold dikerjakan satu orang saja**, yaitu Farrel, sudah dikoordinasikan
  dengan rekan tim. Alasannya: scaffold menyentuh akar repo (`package.json`,
  `vite.config.ts`, `tsconfig.json`), berbeda dengan kerja per folder yang aman
  dilakukan paralel.
- **Temuan yang menyentuh ADR-0004.** Android Studio di mesin ini seri 2025.2
  (Otter), sehingga syarat perkakas Capacitor 8 sebenarnya terpenuhi. Salah satu
  alasan pada ADR-0004 karena itu tidak berlaku di sini dan perlu diamandemen
  agar catatan tetap akurat. Alasan utamanya, yaitu edge-to-edge otomatis yang
  mengganggu tata letak kamera layar penuh, tetap berlaku.
