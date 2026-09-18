# PROJECT_STATE.md

File ini adalah snapshot ringkas kondisi pekerjaan agar sesi berikutnya dapat dilanjutkan tanpa membaca seluruh riwayat percakapan.

Perbarui saat memulai sesi, melewati checkpoint, membuat keputusan penting, menemukan blocker, mengubah arah, berhenti di tengah pekerjaan, atau menyelesaikan task. Jangan menyalin seluruh daftar task atau percakapan ke file ini.

## Metadata

- Terakhir diperbarui: 2026-09-18
- Mode kerja: `competition`
- Status sesi: Berjalan
- Task aktif: Verifikasi lapangan dengan model asli
- Fase aktif: Implementation
- Checkpoint terakhir: Verification (pipeline utuh terbukti di perangkat)
- Konfirmasi pengguna terakhir: Farrel kerjakan bagian Fajar, perbarui pembagian tiap kali

## Scope Yang Disetujui

Farrel memegang seluruh `src/` dan berkas bantu di `model/` yang harus cocok
dengan kode aplikasi. Fajar memegang dataset, training, dan hasilnya.
Pembagian per berkas ada di `docs/EKSEKUSI.md`.

## Tujuan Saat Ini

Model asli sudah mendarat dan berjalan di perangkat (18 September 2026, 20.35).
Penghambat terakhir hilang. Yang tersisa murni verifikasi lapangan:
**urutan kelas terhadap uang fisik**, lalu kalibrasi ambang, lalu ulangi uji
mode pesawat dengan model asli.

## Progress

**SELURUH ALUR FASE 1–4 TERBUKTI DI GALAXY M32** memakai model tiruan:

```
Siaga -> "Uang terdeteksi. Lanjut ke kalkulator."
      -> Kalkulator (8 tombol pecahan berlabel Indonesia)
      -> Layar kasir (3 angka, kontras tinggi, kembalian disorot)
      -> "Kembalian cocok. Selesaikan transaksi."
      -> "Transaksi selesai. Kembali ke mode siaga."
```

Rantai yang tervalidasi: kamera → Web Worker → ONNX Runtime → decode →
confidence gating → NMS → voting temporal → state machine → audio Indonesia →
haptik → Merchant Display → penurunan koin → penyimpanan riwayat.

## Bukti Yang Sudah Diperiksa

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm test` | **210 lulus** di 13 berkas |
| `npx tsc --noEmit` | Bersih, `strict` penuh |
| `pnpm build` | Lolos, tepat satu berkas `.wasm` |
| `./gradlew assembleDebug` | BUILD SUCCESSFUL, 14 detik (cache hangat) |
| APK di Galaxy M32 | Terpasang, 12,1 MB, berjalan |
| Kamera | Menyala, pratinjau tampil dengan uang sungguhan |
| Audio | `termuat=34 gagal=0`, WAV, terdengar |
| TalkBack | Membacakan label, ketuk ganda berpindah fase (ADR-0008 terbukti) |
| Riwayat di IndexedDB | `selesai` ×16, `dibatalkan` ×34, `det_` ×29, agregat harian |
| `periksa_kelas.py` | Menangkap pertukaran 20.000↔50.000, exit 1 |
| `periksa_onnx.py` | Menangkap imgsz 640 + 15 kelas, menebak imgsz asli |
| `petakan_dataset.py` | Memetakan benar, menolak nama asing tanpa menyentuh berkas |
| `uji_model.py` | Melaporkan salah sebut, pola tertukar, dan sebaran skor |
| `augmentasi.py` | 4 varian per foto, diperiksa visual |
| **Tanpa jaringan** | **Siklus penuh Fase 1–4 berjalan, nol akses jaringan** |

## Sudah Selesai

- Seluruh `src/`: contracts, core, vision, audio, platform, ui, data.
- Capacitor + rantai build Android, cache Gradle hangat.
- 34 potongan audio Indonesia (WAV) dibundel ke APK.
- Berkas bantu model (8 berkas): `data.yaml`, `periksa_kelas.py`,
  `petakan_dataset.py`, `augmentasi.py`, `ekspor.py`, `periksa_onnx.py`,
  `uji_model.py`, `buat_model_uji.py`.
- Dokumentasi: `CLAUDE.md`, 10 dokumen `docs/`, **8 ADR**.
- Uji luring lulus, dan seluruh 34 frasa suara terpakai.

## Langkah Berikutnya Yang Diusulkan

1. **Fajar: `public/model/sudepi.onnx`.** **SELESAI.** Model asli (3,1 MB, INT8)
   mendarat, lolos `model/periksa_onnx.py`, dan sudah terpasang di Galaxy M32 —
   logcat memperlihatkannya termuat lalu berinferensi tiap bingkai.
2. Setelah model asli ada, berurutan:
   Farrel deploy ke Galaxy M32 → `model/uji_model.py` dengan foto berlabel →
   kalibrasi ambang memakai sebaran skor yang dilaporkannya → uji layar
   tertutup telapak tangan → gladi bersih `docs/DEMO.md`.
3. ~~Hapus model tiruan dari HP.~~ SELESAI — APK dengan model asli sudah terpasang.
4. ~~Buang overlay metrik dari pratinjau sebelum penjurian.~~ Tidak perlu lagi:
   overlay kini mati secara default dan hanya menyala di `pnpm cap:kalibrasi`.

## ⚠ HUTANG YANG WAJIB DIANGKAT SEBELUM PENJURIAN

**Latensi inferensi ~700 ms, sementara Bab II exsum menjanjikan di bawah
250 ms.** Terukur di Galaxy M32 dengan YOLOv8n berbobot acak. Rinciannya dan
tiga pilihan penanganannya ada di ADR-0009.

Farrel memutuskan **menundanya sampai sistem selesai** (18 September 2026), dan
secara khusus meminta diingatkan kembali pada saat itu. Ini bukan masalah yang
hilang sendiri: entah latensinya diperbaiki, atau angkanya yang diperbaiki —
salah satunya harus dikerjakan sebelum juri membacanya.

## Blocker Dan Hal Yang Belum Diketahui

- **Model sungguhan SUDAH TERSEDIA.** Bobot asli (3.1 MB) dari latihan Fajar di
  A100 Colab telah dipasang di `public/model/sudepi.onnx` dan lolos
  `model/periksa_onnx.py` [1, 12, 2100]. Menunggu Farrel deploy ke Galaxy M32.
- **MODEL TIRUAN DI REPO SUDAH DIGANTI DENGAN ASLI.** Tinggal deploy ulang APK
  agar model di perangkat diperbarui.
- ~~Uji mode pesawat~~ **SUDAH DIJALANKAN DAN LULUS.** Siklus penuh Fase 1–4
  berjalan dengan WiFi dan data seluler dimatikan (`ping` menjawab
  *Network is unreachable*), tanpa satu pun percobaan akses jaringan di logcat.
  Memakai model tiruan, jadi yang terbukti adalah kemandirian dari jaringan,
  bukan akurasi.
- **Uji layar tertutup telapak tangan belum dijalankan** — menunggu model asli.

## Keputusan Penting

- **Delapan ADR diterima.** Paling berdampak: ADR-0001 (`imgsz=320`), ADR-0003
  (audio pra-render, diamandemen jadi berkas terpisah WAV), ADR-0005 (input
  taktil jadi utama — satu-satunya yang mempersempit klaim exsum), ADR-0007
  (8 kelas), ADR-0008 (klik semantik).
- **Lima bug ditemukan lewat penelusuran antarmuka, bukan tes**: ketukan
  ditolak setelah nominal diucapkan, tombol bersarang mengunci nominal salah,
  label menjanjikan yang ditolak, path model salah di worker, label bertabrakan
  dengan TalkBack.
- **Tiga bug ditemukan lewat uji dengar**: aplikasi meredam dirinya sendiri,
  suara terlalu pelan, label mengulang nominal.
- **Satu bug dari audit frasa**: layar Selesai berlabel "kembali ke mode siaga"
  tetapi justru memulai transaksi baru. Audit itu juga menemukan dua FITUR yang
  hilang: peringatan lembaran bertumpuk (mitigasi Lampiran 8 risiko 1) dan
  pengumuman kembali ke Mode Siaga.
- **Satu diagnosis salah dan sudah dikoreksi**: MP3 disangka ditolak Chrome,
  ternyata browser mengembalikan 204 untuk berkas media. Alasan yang salah
  sudah diperbaiki di kode dan ADR-0003.
