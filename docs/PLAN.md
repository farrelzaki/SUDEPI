# Rencana Pembangunan SUDEPI

Status: **aktif** · Versi 1.0 · Cakupan: 24 jam hackathon IFEST 2026

---

## 1. Konteks

Exsum sudah mengunci *apa* yang dibangun dan *mengapa*. Dokumen ini mengunci
*dengan apa* dan *dalam urutan apa*.

Satu hal yang membentuk hampir semua keputusan di bawah ini: **SUDEPI menyebut
angka uang kepada orang yang tidak bisa memeriksa ulang jawabannya.** Salah
sebut "lima puluh ribu" untuk selembar dua puluh ribu bukan bug kosmetik — itu
kerugian uang nyata, di pasar, di depan orang lain. Karena itu setiap pilihan
teknis di sini condong ke **determinisme dan keterjaminan**, bukan ke fitur
terbanyak. Sistem yang mengaku tidak tahu itu tetap berguna. Sistem yang
percaya diri tapi salah lebih buruk daripada tidak ada sistem sama sekali.

Kendala kedua: dua orang menulis kode secara paralel, keduanya dibantu agen AI
dengan alur kerja masing-masing. Ini mengubah kalkulus rekayasa. Kode yang
"pintar" tapi menuntut koordinasi terus-menerus akan kalah dari kode
membosankan dengan batas modul yang jelas.

## 2. Stack dan alasannya

| Lapisan | Pilihan | Alasan (bukan sekadar "cepat dipakai") |
| --- | --- | --- |
| Bahasa | TypeScript `strict` | Domainnya penuh angka yang gampang tertukar: nominal, indeks kelas, skor, koordinat kotak. Tipe menangkap kelas bug ini saat kompilasi, bukan saat demo. |
| Build | Vite 7 | Bundel statis penuh. Cocok dengan syarat luring: tidak ada runtime yang mengharapkan jaringan. |
| UI | React 19 | Bukan yang tercepat, tapi yang paling **dapat diprediksi oleh agen AI**. Dua agen menulis UI dari arah berbeda; keseragaman API lebih berharga daripada performa render marginal. |
| Gaya | Tailwind v4 | Tanpa file konfigurasi, berarti satu file bersama lebih sedikit untuk dibentrokkan. Token `@theme` langsung memodelkan kebutuhan kita: tipografi 72 pt dan pasangan warna kontras tinggi. |
| Inferensi | ONNX Runtime Web (WASM) di Web Worker | Satu-satunya jalur yang **dijamin** berjalan di dalam WebView tanpa kode native. Lihat bagian 3. |
| Model | YOLOv8-Nano, `imgsz=320`, ekspor tanpa NMS | Lihat ADR-0001 dan ADR-0002. |
| Basis data | Dexie 4 (IndexedDB) | Delapan object store dari Lampiran 7 terpetakan langsung. Dexie memberi tipe dan transaksi; IDB mentah menghabiskan waktu tanpa imbalan. |
| Suara keluar | Audio sprite pra-render + Web Audio API | Lihat ADR-0003. Ini keputusan yang paling menyelamatkan demo. |
| Suara masuk | Roda sentuh taktil (utama), STT native (opsional) | Lihat ADR-0005. |
| Wadah | Capacitor 7.6.x | Lihat ADR-0004. |
| Tes | Vitest | Hanya untuk logika murni. Lihat bagian 6. |
| Paket | pnpm | Pemasangan cepat, `node_modules` hemat ruang. |

### Yang sengaja TIDAK dipakai

- **Router.** Fase 1 sampai 4 adalah *state*, bukan *halaman*. Router menambah
  konsep tanpa menambah kemampuan, dan membuat tombol "kembali" Android jadi
  ambigu.
- **Pustaka state global (Redux/Zustand).** Seluruh state transaksi muat dalam
  satu reducer murni sekitar 150 baris. Menambah pustaka justru menyembunyikan
  transisi yang justru ingin kita baca dengan jelas.
- **XState.** Tepat secara konseptual, tapi API v5 masih sering dikacaukan agen
  AI dengan v4. Peta transisi TypeScript biasa lebih aman di sini, dan tetap
  bisa diekspor jadi diagram Mermaid untuk dokumentasi.
- **Server atau API apa pun.** Folder `backend/` yang ada di repo sekarang
  adalah sisa scaffold dan akan dihapus. "Backend" di Lampiran 9 berarti
  *logika inti di sisi klien*, bukan server.

## 3. Keputusan terberat: bagaimana model dijalankan

Exsum menargetkan latensi inferensi **di bawah 250 ms**. Ada jebakan nyata di
sini yang perlu dinyatakan terang-terangan.

ONNX Runtime Web mencapai kecepatan penuhnya lewat WASM multithread.
Multithread butuh `SharedArrayBuffer`, yang hanya aktif kalau halaman berstatus
*cross-origin isolated* — artinya server harus mengirim header `COOP` dan
`COEP`. Di dalam WebView Capacitor, halaman disajikan oleh server lokal
internal yang tidak menyetel header itu. Hasilnya: **ORT jatuh ke mode satu
utas.** YOLOv8n pada `imgsz=640` satu utas di CPU ponsel menengah berada di
kisaran 300 sampai 800 ms. Target 250 ms meleset.

Jalan keluarnya bukan mengganti runtime, tapi **mengecilkan masukan model**.
Uang kertas adalah objek besar yang memenuhi sebagian besar bingkai, bukan
objek kecil di kejauhan. Resolusi 640 terbuang percuma untuk kasus ini.
Menurunkan ke 320 memangkas komputasi sekitar 4 kali dan mengembalikan kita ke
anggaran waktu, tanpa satu baris pun kode native. Rinciannya di **ADR-0001**.

Kita tetap **mencoba** menyalakan COOP/COEP lewat konfigurasi Capacitor. Kalau
berhasil, itu bonus kecepatan. Kalau gagal, tidak ada yang rusak — dan itulah
inti dari memilih jalur ini.

### Anggaran waktu per bingkai (target, `imgsz=320`)

| Tahap | Anggaran |
| --- | --- |
| Ambil bingkai, skala, letterbox | ~10 ms |
| Kirim ke worker (transferable) | ~1 ms |
| Inferensi ORT WASM | ~120 ms |
| Decode + NMS di TypeScript | ~15 ms |
| **Total** | **~150 ms**, menyisakan margin untuk HP kelas bawah |

## 4. Rantai keyakinan (mengapa sistem boleh diam)

Ini mekanisme inti produk, bukan detail implementasi. Sebuah deteksi harus
lolos **empat** saringan berurutan sebelum boleh diucapkan:

1. **Confidence gating** — skor minimal 0,70 (ADR-0010). Di bawah itu, kotak dibuang.
2. **NMS class-agnostic, IoU di atas 0,40** — mencegah satu lembar yang
   tertangkap dua kali, atau dua lembar bertumpuk, dihitung ganda.
3. **Voting temporal** — himpunan deteksi yang sama harus muncul di **3 dari 5**
   bingkai berurutan. Ini yang membunuh kedipan hasil akibat guncangan tangan
   atau kilatan cahaya. Saringan inilah yang sebenarnya mewujudkan janji
   *zero false-positive*; gating skor saja tidak cukup.
4. **Persetujuan pengguna** — hasil diucapkan, lalu dikunci hanya setelah
   pengguna mengonfirmasi.

Gagal di tahap mana pun berarti **Abstain**: sistem berkata "belum yakin, coba
pindai lagi" dan mencatat kejadiannya ke `log_kejadian`. Abstain adalah
keluaran yang sah dan sukses, bukan kegagalan. Jangan pernah menambahkan jalur
yang "menebak saja" sebagai fallback.

## 5. Jadwal 24 jam

Blok disusun supaya **risiko terbesar dibereskan paling awal**. Kegagalan build
Android di jam ke-2 bisa diperbaiki; di jam ke-20 berarti tidak ada demo.

| Jam | Fokus | Keluaran yang bisa diperiksa |
| --- | --- | --- |
| 0–2 | **Fondasi & pembuktian rantai build** | Scaffold Vite jadi. `src/contracts/` ditulis dan disepakati. **APK kosong berhasil terpasang di HP fisik.** Mock engine mengembalikan deteksi bohongan. |
| 2–8 | **Tiga jalur paralel** | `vision/`: kamera + worker + ORT jalan, latensi terukur tampil di layar. `core/`: reducer FSM + kalkulator kembalian, lulus Vitest. `ui/`: kerangka layar + gestur, bisa dijalankan dengan mock. |
| 8–14 | **Integrasi** | Mock dicabut, engine asli terpasang. Audio sprite berbunyi. Haptik dan senter hidup. Fase 1 ke 2 tersambung utuh. |
| 14–19 | **Fitur pembeda** | Merchant Display 72 pt. Fase 4 dan presensi koin. Persistensi Dexie. Kalibrasi ambang pada uang lecek asli. |
| 19–22 | **Pengerasan** | APK rilis terpasang. **Uji mode pesawat.** Uji di HP RAM rendah. Perbaikan bug demi demo. |
| 22–24 | **Gladi bersih** | Jalankan skenario `docs/DEMO.md` tiga kali berturut-turut tanpa gagal. Sisanya cadangan waktu. |

### Gerbang periksa

- **Jam 2 — APK belum terpasang di HP?** Hentikan semua pekerjaan fitur.
  Seluruh tim membereskan rantai build. Tidak ada yang berarti tanpa ini.
- **Jam 12 — deteksi asli belum tersambung ke UI?** Bekukan cakupan. Buang
  Fase 3 (Merchant Display) dan persistensi Dexie. Selamatkan Fase 1 ke 2 ke 4
  sebagai satu alur yang mulus.
- **Jam 19 — masih ada fitur yang belum jadi?** Hapus dari demo, jangan
  ditambal. Fitur setengah jadi yang gagal di depan juri lebih merugikan
  daripada fitur yang memang tidak ada.

## 6. Apa yang dites, dan apa yang tidak

Waktu terbatas, jadi tes harus diarahkan ke tempat yang bugnya paling mahal.

**Wajib punya tes Vitest** (fungsi murni, tanpa DOM, kamera, atau IndexedDB):

- `core/kembalian.ts` — kalkulator kembalian dan penolakan bayar kurang dari belanja.
- `core/koin.ts` — penurunan nominal koin dari selisih.
- `core/mesin.ts` — reducer FSM: setiap transisi sah, **dan** setiap transisi
  tidak sah harus ditolak (misalnya lanjut ke Fase 3 tanpa nominal terkunci).
- `vision/nms.ts` — NMS dan IoU, termasuk kasus kotak bertumpuk berat.
- `audio/angka.ts` — penyusun angka Indonesia. Kasus jebakan: 1.000 ("seribu",
  bukan "satu ribu"), 100.000 ("seratus ribu"), 11.000 ("sebelas ribu"),
  115.000, dan 0.

**Tidak dites otomatis**, diperiksa manual lewat `docs/DEMO.md`: komponen React,
pembungkus Capacitor, perilaku kamera, kompatibilitas TalkBack. Menulis tes
untuk lapisan ini dalam 24 jam adalah waktu yang dicuri dari pengerjaan fitur,
dan tetap tidak akan menangkap masalah nyatanya.

## 7. Risiko yang sudah diverifikasi

Ini bukan risiko hipotetis dari Lampiran 8. Ini yang sudah dikonfirmasi benar
sebelum kode ditulis, beserta apa yang sudah kita lakukan terhadapnya.

| Risiko | Status | Penanganan |
| --- | --- | --- |
| WASM multithread mati di WebView (tak ada `SharedArrayBuffer`) | Terkonfirmasi | `imgsz=320` + Web Worker. ADR-0001. |
| Web Speech API (STT) mengirim audio ke server, jadi mati saat luring | Terkonfirmasi | Taktil jadi jalur utama. ADR-0005. |
| Op NMS hasil ekspor tidak semuanya didukung WASM | Terkonfirmasi | Ekspor `nms=False`, NMS ditulis di TypeScript. ADR-0002. |
| Suara `speechSynthesis` id-ID bisa tidak terpasang di HP demo | Terkonfirmasi | Audio sprite pra-render. ADR-0003. |
| Cap 8 memaksa edge-to-edge, merusak tata letak kamera layar penuh | Terkonfirmasi | Dikunci di Cap 7.6.x. ADR-0004. |
| Gestur tahan 2 detik direbut TalkBack | Terkonfirmasi | Tombol batal permanen sebagai jalur setara. ADR-0006. |
| Menulis `hasil_deteksi` tiap bingkai membanjiri IndexedDB | Terantisipasi | Buffer di memori, tulis hanya saat fase selesai. Lihat `docs/ARSITEKTUR.md`, bagian Persistensi. |

## 8. Langkah pertama

1. Hapus `backend/tes` dan `frontend/tes` (sisa scaffold, bukan kode).
2. Scaffold Vite + React + TS di akar, buat kerangka folder sesuai `CLAUDE.md`.
3. **Tulis `src/contracts/` lebih dulu, bersama-sama.** Sebelum ini selesai,
   pekerjaan paralel belum boleh dimulai. Inilah satu-satunya hal yang membuat
   dua agen bisa bekerja tanpa saling menabrak.
4. `pnpm cap:sync && pnpm cap:run` untuk memasang APK kosong ke HP fisik.
   **Jangan lanjut sebelum langkah ini berhasil.**
5. Baru pecah ke tiga jalur paralel.
