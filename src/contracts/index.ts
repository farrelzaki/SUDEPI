/**
 * Titik masuk tunggal untuk seluruh kontrak lintas-modul.
 *
 * Impor selalu dari sini: `import type { HasilPindai } from '@/contracts'`
 * — bukan dari berkas satuan. Kalau nanti ada berkas yang dipecah atau
 * digabung, pemanggilnya tidak ikut berubah.
 *
 * PENTING: berkas di folder ini BEKU. Jangan ubah tanpa kesepakatan lisan
 * lebih dulu, dan kalau berubah, lakukan dalam satu commit tersendiri yang
 * hanya menyentuh `src/contracts/`. Dua orang sedang menulis kode di sisi
 * berlawanan dari tipe-tipe ini secara bersamaan.
 */

export * from './uang';
export * from './vision';
export * from './suara';
export * from './platform';
export * from './transaksi';
