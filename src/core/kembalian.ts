/**
 * Kalkulator kembalian.
 *
 * Fungsi murni. Tanpa I/O, tanpa state.
 *
 * Seluruh nilai Rupiah adalah bilangan bulat. Tidak ada sen, tidak ada `float`,
 * tidak ada perbandingan dengan toleransi epsilon. Uang pecahan terkecil yang
 * beredar adalah Rp1.000 untuk kertas dan Rp100 untuk koin, jadi tidak ada
 * alasan menyentuh bilangan pecahan di mana pun.
 */

export type AlasanTolakBayar =
  /** Uang yang dibayarkan kurang dari total belanja. */
  | 'bayar-kurang'
  /** Bukan bilangan bulat, negatif, NaN, atau tak hingga. */
  | 'nilai-tidak-sah';

export type HasilKembalian =
  | { readonly ok: true; readonly kembalian: number }
  | { readonly ok: false; readonly alasan: AlasanTolakBayar };

/** Rupiah yang sah: bilangan bulat, tidak negatif, berhingga. */
export function nominalSah(nilai: number): boolean {
  return Number.isSafeInteger(nilai) && nilai >= 0;
}

/**
 * Menghitung kembalian.
 *
 * Pembayaran kurang dari belanja DITOLAK di sini, bukan belakangan. Exsum
 * Bab III Fase 2 menyebutnya eksplisit, dan alasannya bukan sekadar kerapian:
 * kalau baru ditolak di Fase 3, pedagang sudah terlanjur melihat angka yang
 * salah di layar yang dibalik ke arahnya.
 */
export function hitungKembalian(
  totalBelanja: number,
  uangDibayar: number,
): HasilKembalian {
  if (!nominalSah(totalBelanja) || !nominalSah(uangDibayar)) {
    return { ok: false, alasan: 'nilai-tidak-sah' };
  }
  if (uangDibayar < totalBelanja) {
    return { ok: false, alasan: 'bayar-kurang' };
  }
  return { ok: true, kembalian: uangDibayar - totalBelanja };
}
