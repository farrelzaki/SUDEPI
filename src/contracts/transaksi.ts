/**
 * Kontrak state machine transaksi.
 *
 * Ditulis sebagai reducer MURNI. Ia tidak menyentuh kamera, suara, atau basis
 * data. Ia mengembalikan state baru DAN daftar efek yang harus dijalankan
 * pemanggil. Itulah yang membuatnya bisa diuji penuh dalam milidetik.
 *
 * Dua sifat yang wajib dijaga dan keduanya punya tes:
 *
 * 1. `BATAL` sah dari fase mana pun kecuali SIAGA. Pengguna harus selalu bisa
 *    keluar. Satu fase yang tidak bisa dibatalkan adalah jebakan bagi orang
 *    yang tidak bisa melihat di mana dia terjebak.
 * 2. Pembayaran kurang dari belanja ditolak di KALKULATOR, sebelum masuk
 *    LAYAR_KASIR. Menolaknya belakangan berarti pedagang sudah terlanjur
 *    melihat angka yang salah.
 */

import type { FasePindai, HasilPindai } from './vision';
import type { PolaGetar } from './platform';
import type { Ucapan } from './suara';

export type Fase =
  | 'SIAGA'
  /** Fase 1 — bidik uang yang akan dibayarkan. */
  | 'PINDAI_BAYAR'
  /** Fase 2 — kalkulator taktil. */
  | 'KALKULATOR'
  /** Fase 3 — layar dibalik ke pedagang. Opsional, bisa dilewati. */
  | 'LAYAR_KASIR'
  /** Fase 4 — pindai uang kembalian. */
  | 'PINDAI_KEMBALIAN'
  | 'SELESAI';

export interface StateTransaksi {
  readonly fase: Fase;
  readonly totalBelanja: number | null;
  readonly uangDibayar: number | null;
  readonly kembalianWajib: number | null;
  readonly kembalianTerverifikasi: number | null;
  /** Selisih kembalian wajib dengan uang kertas terdeteksi di Fase 4. */
  readonly nominalKoin: number | null;
  readonly hasilPindaiTerakhir: HasilPindai | null;
  /**
   * Waktu mulai transaksi, milidetik epoch. Disuntikkan dari luar lewat
   * peristiwa MULAI — reducer tidak boleh memanggil Date.now() sendiri,
   * karena itu membuat tesnya tidak deterministik.
   */
  readonly mulaiPadaMs: number;
  readonly alasanAbstain: string | null;
}

export type Peristiwa =
  | { readonly jenis: 'MULAI'; readonly padaMs: number }
  | { readonly jenis: 'HASIL_PINDAI'; readonly muatan: HasilPindai }
  /** Ketuk ganda, atau aktivasi tombol utama lewat TalkBack. */
  | { readonly jenis: 'KONFIRMASI' }
  /** Escape-hatch: tombol Batalkan permanen atau gestur tahan. ADR-0006. */
  | { readonly jenis: 'BATAL' }
  | { readonly jenis: 'SET_BELANJA'; readonly nilai: number }
  | { readonly jenis: 'SET_BAYAR'; readonly nilai: number }
  | { readonly jenis: 'LEWATI_LAYAR_KASIR' }
  | { readonly jenis: 'ULANGI_PINDAI' };

export type Efek =
  | { readonly jenis: 'UCAP'; readonly ucapan: Ucapan }
  | { readonly jenis: 'GETAR'; readonly pola: PolaGetar }
  | { readonly jenis: 'MULAI_PINDAI'; readonly fase: FasePindai }
  | { readonly jenis: 'HENTIKAN_PINDAI' }
  | { readonly jenis: 'SIMPAN_TRANSAKSI' };

export interface HasilReduksi {
  readonly state: StateTransaksi;
  readonly efek: readonly Efek[];
}

export const STATE_AWAL: StateTransaksi = {
  fase: 'SIAGA',
  totalBelanja: null,
  uangDibayar: null,
  kembalianWajib: null,
  kembalianTerverifikasi: null,
  nominalKoin: null,
  hasilPindaiTerakhir: null,
  mulaiPadaMs: 0,
  alasanAbstain: null,
};

/**
 * Murni. Tanpa I/O, tanpa Date.now(), tanpa Math.random().
 *
 * Peristiwa yang tidak sah pada suatu fase WAJIB dikembalikan tanpa perubahan
 * dan tanpa efek — bukan melempar error. Sistem yang dipakai tunanetra tidak
 * boleh mati karena ketukan tak terduga. Tapi setiap penolakan itu wajib
 * punya tes.
 *
 * Implementasi ada di `core/mesin.ts` (milik Farrel).
 */
export type Reduksi = (
  state: StateTransaksi,
  peristiwa: Peristiwa,
) => HasilReduksi;

/** Target durasi satu transaksi utuh, sesuai exsum Bab III Fase 2. */
export const TARGET_DURASI_TRANSAKSI_MS = 15_000;
