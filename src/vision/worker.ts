/// <reference lib="webworker" />

/**
 * Worker inferensi.
 *
 * Seluruh pekerjaan berat ada di sini: pengubahan ukuran bingkai, normalisasi
 * piksel, inferensi ONNX, decode, dan NMS. Utas utama hanya menyerahkan
 * ImageBitmap lalu menerima daftar deteksi.
 *
 * Kenapa harus worker. Inferensi memakan sekitar 120 ms. Kalau dijalankan di
 * utas utama, pratinjau kamera membeku selama itu, setiap bingkai. Pengguna
 * melihat video patah-patah dan React tidak sempat merespons sentuhan. Pada HP
 * RAM 2 GB — yang justru target pengguna kami — perbedaannya antara terpakai
 * dan tidak terpakai.
 */

import * as ort from 'onnxruntime-web/wasm';
import { AMBANG_IOU, AMBANG_KEYAKINAN, UKURAN_MASUKAN } from '@/contracts';
import { dekode } from './decode';
import { gating, nms } from './nms';
import type { PesanDariWorker, PesanKeWorker } from './protokolWorker';

const diri = self as unknown as DedicatedWorkerGlobalScope;

let sesi: ort.InferenceSession | null = null;
// Nilai awal sebelum pesan `init` tiba. Diambil dari kontrak, bukan ditulis
// ulang — menulisnya mati membuat satu angka ambang hidup di dua tempat, dan
// yang di sini tidak ikut berubah saat kalibrasi.
let ambangKeyakinan = AMBANG_KEYAKINAN;
let ambangIoU = AMBANG_IOU;
let ukuranMasukan = UKURAN_MASUKAN;

/** Kanvas dan buffer dipakai ulang antar bingkai supaya tidak memicu GC. */
let kanvas: OffscreenCanvas | null = null;
let konteks: OffscreenCanvasRenderingContext2D | null = null;
let masukan: Float32Array | null = null;

function kirim(pesan: PesanDariWorker): void {
  diri.postMessage(pesan);
}

async function init(p: Extract<PesanKeWorker, { jenis: 'init' }>): Promise<void> {
  ambangKeyakinan = p.ambangKeyakinan;
  ambangIoU = p.ambangIoU;
  ukuranMasukan = p.ukuranMasukan;

  // Berkas .wasm SENGAJA tidak disetel lewat wasmPaths.
  //
  // ORT merujuk berkasnya lewat `new URL(..., import.meta.url)`, sehingga Vite
  // memancarkannya sendiri ke `assets/` dan menulis path relatif yang benar.
  // Menyetel wasmPaths ke salinan terpisah justru membuat dua berkas 14 MB
  // yang sama ikut dibundel — 28 MB terbuang percuma di APK.
  //
  // Relatif, bukan absolut: di dalam WebView Capacitor bundel disajikan dari
  // skema lokal, bukan dari akar domain.

  // Multithread hanya hidup kalau halaman cross-origin isolated. Di dalam
  // WebView Capacitor hampir pasti tidak — lihat ADR-0001. Target latensi kita
  // sudah dirancang tercapai tanpa itu, jadi ini bonus kalau kebetulan ada.
  ort.env.wasm.numThreads = globalThis.crossOriginIsolated
    ? Math.min(4, navigator.hardwareConcurrency || 1)
    : 1;

  kanvas = new OffscreenCanvas(ukuranMasukan, ukuranMasukan);
  konteks = kanvas.getContext('2d', { willReadFrequently: true });
  masukan = new Float32Array(3 * ukuranMasukan * ukuranMasukan);

  sesi = await ort.InferenceSession.create(p.urlModel, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  // Dipertahankan di produksi. Kalau `utas` bernilai 1 padahal HP punya banyak
  // inti, itu penjelasan langsung kenapa inferensinya lambat — lihat ADR-0009.
  console.log(
    `[PERF] utas=${ort.env.wasm.numThreads} ` +
      `isolated=${globalThis.crossOriginIsolated} ` +
      `inti=${navigator.hardwareConcurrency}`,
  );
  kirim({ jenis: 'siap' });
}

/**
 * Menggambar bingkai ke kanvas 320x320 dengan letterbox, lalu menormalkannya
 * menjadi tensor NCHW float32 dalam rentang 0..1.
 *
 * Bantalan diisi abu-abu (114), nilai yang sama dengan yang dipakai Ultralytics
 * saat melatih. Mengisinya hitam akan memberi model tepi yang tidak pernah ia
 * lihat saat latihan.
 */
function siapkanMasukan(bingkai: ImageBitmap): Float32Array {
  if (!konteks || !masukan) throw new Error('Worker belum di-init');

  const skala = Math.min(
    ukuranMasukan / bingkai.width,
    ukuranMasukan / bingkai.height,
  );
  const lebar = Math.round(bingkai.width * skala);
  const tinggi = Math.round(bingkai.height * skala);
  const padX = Math.floor((ukuranMasukan - lebar) / 2);
  const padY = Math.floor((ukuranMasukan - tinggi) / 2);

  konteks.fillStyle = 'rgb(114,114,114)';
  konteks.fillRect(0, 0, ukuranMasukan, ukuranMasukan);
  konteks.drawImage(bingkai, padX, padY, lebar, tinggi);

  const piksel = konteks.getImageData(0, 0, ukuranMasukan, ukuranMasukan).data;
  const luas = ukuranMasukan * ukuranMasukan;

  // RGBA berselang-seling menjadi tiga bidang terpisah (NCHW).
  for (let i = 0; i < luas; i += 1) {
    const s = i * 4;
    masukan[i] = (piksel[s] ?? 0) / 255;
    masukan[luas + i] = (piksel[s + 1] ?? 0) / 255;
    masukan[luas * 2 + i] = (piksel[s + 2] ?? 0) / 255;
  }

  return masukan;
}

async function deteksi(
  p: Extract<PesanKeWorker, { jenis: 'deteksi' }>,
): Promise<void> {
  if (!sesi) {
    p.bingkai.close();
    kirim({ jenis: 'galat', pesan: 'Sesi ONNX belum siap' });
    return;
  }

  const mulai = performance.now();

  try {
    const data = siapkanMasukan(p.bingkai);
    const tensor = new ort.Tensor('float32', data, [
      1,
      3,
      ukuranMasukan,
      ukuranMasukan,
    ]);

    const namaMasukan = sesi.inputNames[0];
    if (!namaMasukan) throw new Error('Model tidak punya masukan');

    const keluaran = await sesi.run({ [namaMasukan]: tensor });
    const namaKeluaran = sesi.outputNames[0];
    if (!namaKeluaran) throw new Error('Model tidak punya keluaran');

    const mentah = keluaran[namaKeluaran]?.data as Float32Array | undefined;
    if (!mentah) throw new Error('Keluaran model kosong');

    const { lolos, ditolakGating } = dekode(mentah, p.lb, ambangKeyakinan);
    const disaring = nms(gating(lolos, ambangKeyakinan), ambangIoU);

    kirim({
      jenis: 'hasil',
      id: p.id,
      deteksi: disaring,
      ditolakGating,
      latensiMs: performance.now() - mulai,
    });
  } catch (galat) {
    kirim({
      jenis: 'galat',
      pesan: galat instanceof Error ? galat.message : String(galat),
    });
  } finally {
    // Wajib ditutup. ImageBitmap tidak dikumpulkan sampah secara andal, dan
    // membiarkannya pada 10 bingkai per detik akan menghabiskan memori HP
    // kelas bawah dalam hitungan menit.
    p.bingkai.close();
  }
}

diri.onmessage = (peristiwa: MessageEvent<PesanKeWorker>): void => {
  const pesan = peristiwa.data;
  if (pesan.jenis === 'init') {
    void init(pesan).catch((galat: unknown) => {
      kirim({
        jenis: 'galat',
        pesan: galat instanceof Error ? galat.message : String(galat),
      });
    });
    return;
  }
  void deteksi(pesan);
};
