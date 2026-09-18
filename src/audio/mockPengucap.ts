/**
 * Pengucap bohongan.
 *
 * Mencatat apa yang seharusnya diucapkan tanpa membunyikan apa pun. Dua
 * gunanya: mengembangkan UI tanpa suara berulang-ulang di kuping, dan menguji
 * bahwa alur transaksi mengucapkan hal yang benar pada saat yang benar.
 */

import type { Pengucap, Ucapan } from '@/contracts';
import { keTeks } from './pengucap';

export interface MockPengucap extends Pengucap {
  /** Seluruh ucapan sejak dibuat, dalam bentuk teks. */
  readonly riwayat: readonly string[];
  bersihkanRiwayat(): void;
  readonly sedangRedam: boolean;
}

export interface OpsiMockPengucap {
  /** Jeda buatan per ucapan, meniru lamanya audio sungguhan. */
  readonly durasiMs?: number;
  readonly catatKeKonsol?: boolean;
}

export function buatMockPengucap(opsi: OpsiMockPengucap = {}): MockPengucap {
  const durasiMs = opsi.durasiMs ?? 0;
  const catat = opsi.catatKeKonsol ?? false;
  const riwayat: string[] = [];
  let redam = false;
  let dibatalkan = false;

  return {
    riwayat,

    get sedangRedam() {
      return redam;
    },

    async siap() {
      // Tidak ada yang perlu dimuat.
    },

    async ucap(ucapan: Ucapan) {
      dibatalkan = false;
      const teks = keTeks(ucapan);
      riwayat.push(teks);
      if (catat) console.log('[ucap]', teks);
      if (durasiMs > 0) {
        await new Promise<void>((selesai) => setTimeout(selesai, durasiMs));
      }
      if (dibatalkan) return;
    },

    hentikan() {
      dibatalkan = true;
    },

    redam(aktif: boolean) {
      redam = aktif;
    },

    bersihkanRiwayat() {
      riwayat.length = 0;
    },
  };
}
