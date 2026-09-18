/**
 * Kontrak keluaran suara.
 *
 * Pemanggil TIDAK PERNAH menyusun kalimat Indonesia sendiri. Selalu kirim
 * `{ jenis: 'rupiah', nilai: 115000 }` dan biarkan `audio/angka.ts` yang
 * mengubahnya jadi "seratus lima belas ribu rupiah".
 *
 * Alasannya: kalau penyusunan kalimat tersebar di banyak modul, cepat atau
 * lambat akan muncul "satu ribu rupiah" — dan kemungkinan besar baru ketahuan
 * di depan juri.
 */

export type IdFrasa =
  | 'arahkan_kamera'
  | 'belum_yakin_ulangi'
  | 'renggangkan_lembaran'
  | 'total_belanja'
  | 'uang_dibayar'
  | 'kembalian'
  | 'ditambah_koin'
  | 'uang_kurang'
  | 'transaksi_dibatalkan'
  | 'transaksi_selesai'
  | 'mode_siaga'
  | 'terdeteksi'
  | 'total'
  | 'tidak_ada_uang';

export type Ucapan =
  | { readonly jenis: 'rupiah'; readonly nilai: number }
  | { readonly jenis: 'frasa'; readonly id: IdFrasa }
  | { readonly jenis: 'urutan'; readonly bagian: readonly Ucapan[] };

export interface Pengucap {
  siap(): Promise<void>;
  /** Selesai (resolve) saat audio benar-benar habis diputar. */
  ucap(ucapan: Ucapan): Promise<void>;
  /** Menghentikan ucapan yang sedang berjalan. */
  hentikan(): void;
  /**
   * Audio ducking: turunkan suara lain selagi sistem bicara.
   * Dipanggil dengan `true` sebelum bicara, `false` setelah selesai.
   */
  redam(aktif: boolean): void;
}

/* --- Pembantu penyusun ucapan, supaya pemanggil tidak merakit objek --- */

export const frasa = (id: IdFrasa): Ucapan => ({ jenis: 'frasa', id });

export const rupiah = (nilai: number): Ucapan => ({ jenis: 'rupiah', nilai });

export const urutan = (...bagian: readonly Ucapan[]): Ucapan => ({
  jenis: 'urutan',
  bagian,
});
