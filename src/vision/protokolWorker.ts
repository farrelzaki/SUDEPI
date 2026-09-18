/**
 * Protokol pesan antara utas utama dan worker inferensi.
 *
 * Dipisah ke berkasnya sendiri supaya kedua sisi mengimpor tipe yang sama
 * persis. Protokol yang didefinisikan dua kali akan menyimpang cepat atau
 * lambat, dan kesalahannya baru muncul saat berjalan.
 */

import type { Deteksi } from '@/contracts';
import type { Letterbox } from './decode';

export type PesanKeWorker =
  | {
      readonly jenis: 'init';
      readonly urlModel: string;
      readonly ambangKeyakinan: number;
      readonly ambangIoU: number;
      readonly ukuranMasukan: number;
    }
  | {
      readonly jenis: 'deteksi';
      readonly id: number;
      readonly bingkai: ImageBitmap;
      readonly lb: Letterbox;
    };

export type PesanDariWorker =
  | { readonly jenis: 'siap' }
  | { readonly jenis: 'galat'; readonly pesan: string }
  | {
      readonly jenis: 'hasil';
      readonly id: number;
      readonly deteksi: readonly Deteksi[];
      /** Objek yang terlihat namun gagal lolos ambang. Memicu Abstain. */
      readonly ditolakGating: number;
      readonly latensiMs: number;
    };
