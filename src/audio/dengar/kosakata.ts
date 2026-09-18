/**
 * Kosakata yang dikenali.
 *
 * INI SUMBER SELURUH KEKUATAN PENDEKATAN INI. Pengenalan ucapan bebas
 * membutuhkan model bahasa berukuran puluhan megabita dan data latih ribuan
 * jam. Pengenalan kosakata TERTUTUP hanya perlu membandingkan sebuah ucapan
 * dengan tujuh belas contoh — dan itu bisa dijalankan di ponsel mana pun,
 * tanpa unduhan, tanpa jaringan, tanpa ketergantungan pada apa yang kebetulan
 * terpasang di perangkat.
 *
 * Kami tidak butuh mesin yang mengerti kalimat. Kami butuh mesin yang mengerti
 * ANGKA, dan angka dalam Bahasa Indonesia hanya butuh tujuh belas kata.
 *
 * Urutannya disengaja: sembilan digit lebih dulu, lalu bentuk khusus, lalu
 * pengali. Alur pelatihan suara mengikuti urutan ini, dan menaruh yang paling
 * akrab di depan membuat pengguna cepat paham iramanya.
 */

import type { Klip } from '../angka';

export interface KataKosakata {
  /** Dipakai pengurai bilangan di `audio/urai.ts`. */
  readonly kata: string;
  /** Klip suara untuk memandu pelatihan: "ucapkan ...". */
  readonly klip: Klip;
}

export const KOSAKATA: readonly KataKosakata[] = [
  { kata: 'satu', klip: 'satu' },
  { kata: 'dua', klip: 'dua' },
  { kata: 'tiga', klip: 'tiga' },
  { kata: 'empat', klip: 'empat' },
  { kata: 'lima', klip: 'lima' },
  { kata: 'enam', klip: 'enam' },
  { kata: 'tujuh', klip: 'tujuh' },
  { kata: 'delapan', klip: 'delapan' },
  { kata: 'sembilan', klip: 'sembilan' },
  { kata: 'nol', klip: 'nol' },
  { kata: 'sepuluh', klip: 'sepuluh' },
  { kata: 'sebelas', klip: 'sebelas' },
  { kata: 'belas', klip: 'belas' },
  { kata: 'puluh', klip: 'puluh' },
  { kata: 'ratus', klip: 'ratus' },
  { kata: 'ribu', klip: 'ribu' },
  { kata: 'juta', klip: 'juta' },
];

export const JUMLAH_KOSAKATA = KOSAKATA.length;
