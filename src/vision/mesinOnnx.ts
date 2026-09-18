/**
 * Implementasi `MesinInferensi` yang memakai ONNX Runtime Web di Web Worker.
 *
 * Berkas ini tipis dengan sengaja: ia hanya menjembatani janji (Promise) ke
 * pesan worker. Seluruh logika penglihatan ada di `decode.ts`, `nms.ts`, dan
 * `voting.ts` sebagai fungsi murni yang bisa diuji tanpa worker sama sekali.
 */

import { AMBANG_IOU, AMBANG_KEYAKINAN, UKURAN_MASUKAN, type Deteksi, type MesinInferensi } from '@/contracts';
import { hitungLetterbox } from './decode';
import type { PesanDariWorker } from './protokolWorker';

export interface OpsiMesinOnnx {
  /** Lokasi bobot. Relatif terhadap bundel, bukan URL jaringan. */
  readonly urlModel?: string;
  readonly ambangKeyakinan?: number;
  readonly ambangIoU?: number;
}

export interface HasilDeteksiMentah {
  readonly deteksi: readonly Deteksi[];
  /** Kotak tingkat kedua. Lihat catatan dua tingkat di `voting.ts`. */
  readonly lemah: readonly Deteksi[];
  readonly ditolakGating: number;
  readonly latensiMs: number;
}

/**
 * Mesin dengan informasi tambahan yang dibutuhkan pemindai.
 *
 * `MesinInferensi` pada kontrak hanya mengembalikan `Deteksi[]`. Pemindai juga
 * perlu tahu berapa objek yang terlihat namun gagal lolos ambang, karena
 * itulah yang membedakan "meja kosong" dari "ada uang tapi belum yakin".
 */
export interface MesinOnnx extends MesinInferensi {
  deteksiRinci(bingkai: ImageBitmap): Promise<HasilDeteksiMentah>;
}

export function buatMesinOnnx(opsi: OpsiMesinOnnx = {}): MesinOnnx {
  // Diselesaikan menjadi URL mutlak DI SINI, di utas utama, sebelum dikirim ke
  // worker.
  //
  // Alasannya ditemukan saat menjalankan APK di HP sungguhan. Path relatif
  // seperti './model/sudepi.onnx' diselesaikan relatif terhadap berkas yang
  // memakainya — dan yang memakainya adalah worker, yang tinggal di
  // `assets/worker-xxxx.js`. Hasilnya ONNX Runtime mencari model di
  // `/assets/model/sudepi.onnx`, padahal berkasnya ada di `/model/`.
  //
  // Kegagalannya tidak kentara: model tidak pernah ditemukan, pemindai gagal
  // diam-diam, dan pesan galatnya hanya muncul di logcat.
  const urlModel = new URL(
    opsi.urlModel ?? './model/sudepi.onnx',
    globalThis.location.href,
  ).href;

  let worker: Worker | null = null;
  let idBerikut = 1;
  const menunggu = new Map<
    number,
    { selesai: (h: HasilDeteksiMentah) => void; gagal: (g: Error) => void }
  >();
  let siapSelesai: (() => void) | null = null;
  let siapGagal: ((g: Error) => void) | null = null;

  return {
    async siap() {
      if (worker) return;

      worker = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (p: MessageEvent<PesanDariWorker>): void => {
        const pesan = p.data;

        if (pesan.jenis === 'siap') {
          siapSelesai?.();
          siapSelesai = null;
          siapGagal = null;
          return;
        }

        if (pesan.jenis === 'galat') {
          const galat = new Error(pesan.pesan);
          // Galat saat pemuatan model membatalkan `siap()`; galat saat
          // inferensi membatalkan seluruh permintaan yang masih menunggu.
          if (siapGagal) {
            siapGagal(galat);
            siapSelesai = null;
            siapGagal = null;
            return;
          }
          for (const { gagal } of menunggu.values()) gagal(galat);
          menunggu.clear();
          return;
        }

        const penunggu = menunggu.get(pesan.id);
        if (!penunggu) return;
        menunggu.delete(pesan.id);
        penunggu.selesai({
          deteksi: pesan.deteksi,
          lemah: pesan.lemah,
          ditolakGating: pesan.ditolakGating,
          latensiMs: pesan.latensiMs,
        });
      };

      await new Promise<void>((selesai, gagal) => {
        siapSelesai = selesai;
        siapGagal = gagal;
        worker?.postMessage({
          jenis: 'init',
          urlModel,
          ambangKeyakinan: opsi.ambangKeyakinan ?? AMBANG_KEYAKINAN,
          ambangIoU: opsi.ambangIoU ?? AMBANG_IOU,
          ukuranMasukan: UKURAN_MASUKAN,
        });
      });
    },

    async deteksiRinci(bingkai: ImageBitmap): Promise<HasilDeteksiMentah> {
      if (!worker) {
        bingkai.close();
        throw new Error('Mesin belum siap. Panggil siap() lebih dulu.');
      }

      const id = idBerikut;
      idBerikut += 1;

      const lb = hitungLetterbox(bingkai.width, bingkai.height, UKURAN_MASUKAN);

      return new Promise<HasilDeteksiMentah>((selesai, gagal) => {
        menunggu.set(id, { selesai, gagal });
        // Bitmap dipindahkan, bukan disalin — nol salinan piksel.
        worker?.postMessage({ jenis: 'deteksi', id, bingkai, lb }, [bingkai]);
      });
    },

    async deteksi(bingkai: ImageBitmap) {
      return (await this.deteksiRinci(bingkai)).deteksi;
    },

    tutup() {
      worker?.terminate();
      worker = null;
      for (const { gagal } of menunggu.values()) {
        gagal(new Error('Mesin ditutup'));
      }
      menunggu.clear();
    },
  };
}
