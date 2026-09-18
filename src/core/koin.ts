/**
 * Presensi koin.
 *
 * Koin tidak pernah dikenali nilainya oleh model — hanya keberadaannya. Nilai
 * koin DITURUNKAN dari selisih antara kembalian yang wajib diterima dan jumlah
 * uang kertas yang terdeteksi:
 *
 *     nominalKoin = kembalianWajib - totalKertasTerdeteksi
 *
 * Di sinilah kekeliruan paling mungkin lolos ke demo, jadi setiap cabang di
 * bawah punya tesnya sendiri.
 */

import { NOMINAL_TERKECIL } from '@/contracts';
import { nominalSah } from './kembalian';

export type AlasanTolakKoin =
  /**
   * Selisih mencapai Rp1.000 atau lebih. Itu berarti ada UANG KERTAS yang
   * tidak terdeteksi, bukan koin. Menyebutnya koin akan menyesatkan pengguna
   * tentang sejumlah uang yang sebenarnya cukup besar.
   */
  | 'selisih-terlalu-besar'
  /**
   * Uang kertas terdeteksi melebihi kembalian yang wajib. Entah pedagang
   * memberi lebih, entah deteksinya keliru. Sistem tidak boleh menebak yang
   * mana.
   */
  | 'kertas-melebihi-kembalian'
  | 'nilai-tidak-sah';

export type HasilKoin =
  | { readonly ok: true; readonly nominalKoin: number; readonly adaKoin: boolean }
  | { readonly ok: false; readonly alasan: AlasanTolakKoin };

/**
 * Menurunkan nominal koin dari selisih.
 *
 * Syaratnya: selisih tidak negatif dan lebih kecil dari pecahan kertas
 * terkecil. Di luar itu sistem WAJIB abstain dan meminta pindai ulang —
 * jangan pernah menambahkan cabang yang "menebak saja".
 */
export function turunkanKoin(
  kembalianWajib: number,
  totalKertasTerdeteksi: number,
): HasilKoin {
  if (!nominalSah(kembalianWajib) || !nominalSah(totalKertasTerdeteksi)) {
    return { ok: false, alasan: 'nilai-tidak-sah' };
  }

  const selisih = kembalianWajib - totalKertasTerdeteksi;

  if (selisih < 0) {
    return { ok: false, alasan: 'kertas-melebihi-kembalian' };
  }
  if (selisih >= NOMINAL_TERKECIL) {
    return { ok: false, alasan: 'selisih-terlalu-besar' };
  }

  return { ok: true, nominalKoin: selisih, adaKoin: selisih > 0 };
}
