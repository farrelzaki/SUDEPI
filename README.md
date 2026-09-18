# SUDEPI — Suara Deteksi Rupiah

Asisten transaksi tunai untuk tunanetra. Aplikasi Android yang **berjalan
sepenuhnya luring**: mendeteksi nominal Rupiah multi-lembar lewat kamera,
menghitung kembalian, lalu memverifikasi kembalian yang diterima.

Tidak ada server. Tidak ada panggilan jaringan. Riwayat transaksi tidak pernah
meninggalkan perangkat.

**IT Competition Hackathon IFEST 2026** · Tim PenungguTokenReset · IPB University
Tema: *Tech for Human Connections* — Accessibility, Receiver and Provider

---

## Yang membedakan

| | Google Lookout / Seeing AI | Cash Reader | **SUDEPI** |
| --- | --- | --- | --- |
| Baca banyak lembar sekaligus | Tidak | Tidak | **Ya** |
| Hitung kembalian | Tidak | Tidak | **Ya** |
| Layar verifikasi untuk pedagang | Tidak | Tidak | **Ya** |
| Berjalan luring | Sebagian | Ya | **Ya, mutlak** |
| Biaya | Gratis | Berbayar | **Gratis** |

Selain itu, satu sifat yang jarang dimiliki prototipe sejenis: **sistem ini
boleh berkata tidak tahu.** Bila keyakinan deteksi tidak mencapai ambang, ia
menolak menebak dan meminta pindai ulang. Untuk pengguna yang tidak bisa
memeriksa ulang jawaban kami, menebak lebih berbahaya daripada diam.

## Dokumentasi

Mulai dari **[`CLAUDE.md`](CLAUDE.md)** — penunjuk arah singkat untuk siapa pun,
manusia maupun agen AI, yang baru masuk ke repo ini.

| Dokumen | Isi |
| --- | --- |
| [`docs/PLAN.md`](docs/PLAN.md) | Stack, alasan pemilihannya, dan jadwal 24 jam |
| [`docs/ARSITEKTUR.md`](docs/ARSITEKTUR.md) | Bentuk sistem, alur bingkai, model, persistensi |
| [`docs/KONTRAK.md`](docs/KONTRAK.md) | Tipe dan antarmuka lintas-modul (beku) |
| [`docs/PERUBAHAN.md`](docs/PERUBAHAN.md) | Penyimpangan dari proposal, dalam format ADR |
| [`docs/AKSESIBILITAS.md`](docs/AKSESIBILITAS.md) | WCAG 2.2 AA dan kompatibilitas TalkBack |
| [`docs/KOLABORASI.md`](docs/KOLABORASI.md) | Aturan main tim dan antar agen AI |
| [`docs/DEMO.md`](docs/DEMO.md) | Skenario demo dan daftar periksa penjurian |
| [`docs/PROGRES.md`](docs/PROGRES.md) | Catatan progres teknis beserta buktinya, untuk juri |
| [`AGENTS.md`](AGENTS.md) | Alur kerja agen: checkpoint, persetujuan, pelaporan |

## Stack

TypeScript · React 19 · Vite 7 · Tailwind 4 · ONNX Runtime Web (WASM, di Web
Worker) · YOLOv8-Nano INT8 pada `imgsz=320` · Dexie / IndexedDB · Capacitor 7.6

Alasan tiap pilihan ada di [`docs/PLAN.md`](docs/PLAN.md) bagian 2.

## Menjalankan

```bash
pnpm install
pnpm dev          # browser desktop, memakai mock engine
pnpm test         # Vitest untuk logika murni
pnpm cap:run      # pasang dan jalankan di HP Android terhubung
```

## Status

Dalam pengembangan aktif selama hackathon. Lihat
[`PROJECT_STATE.md`](PROJECT_STATE.md) untuk kondisi terkini.
