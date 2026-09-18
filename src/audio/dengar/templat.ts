/**
 * Penyimpanan contoh suara pengguna.
 *
 * Satu-satunya berkas di folder ini yang menyentuh dunia luar.
 *
 * DISIMPAN DI PERANGKAT, TIDAK PERNAH DIKIRIM KE MANA PUN. Yang tersimpan pun
 * bukan rekaman suaranya melainkan cirinya — deretan angka MFCC yang tidak bisa
 * dikembalikan menjadi suara yang bisa didengar. Itu bukan kebetulan: suara
 * adalah data pribadi, dan bentuk paling aman untuk menyimpannya adalah bentuk
 * yang tidak bisa diputar ulang.
 *
 * Memakai `localStorage`, bukan IndexedDB yang dipakai riwayat transaksi.
 * Alasannya sederhana: ini pengaturan aplikasi, bukan catatan transaksi, dan
 * seluruh isinya hanya beberapa ratus kilobita. Menambah tabel Dexie berarti
 * menaikkan versi skema — pekerjaan yang tidak sepadan untuk data yang tidak
 * pernah dikueri.
 */

import { JUMLAH_KOEFISIEN, type Bingkai } from './mfcc';
import type { Contoh } from './pengenal';

const KUNCI = 'sudepi.suara.contoh.v1';

/** Bentuk tersimpan: angka biasa, supaya bisa jadi JSON. */
interface ContohTersimpan {
  readonly kata: string;
  readonly bingkai: number[][];
}

/**
 * Dibulatkan ke dua angka di belakang koma sebelum disimpan.
 *
 * Ketelitian di bawah itu tidak mengubah hasil pencocokan sama sekali —
 * jaraknya bergerak di satuan, bukan di perseratus — sementara ukurannya
 * menyusut lebih dari separuh.
 */
function keTersimpan(c: Contoh): ContohTersimpan {
  return {
    kata: c.kata,
    bingkai: c.bingkai.map((b) =>
      Array.from(b, (x) => Math.round(x * 100) / 100),
    ),
  };
}

function dariTersimpan(c: ContohTersimpan): Contoh {
  return {
    kata: c.kata,
    bingkai: c.bingkai.map((baris) => {
      const b = new Float32Array(JUMLAH_KOEFISIEN);
      for (let i = 0; i < JUMLAH_KOEFISIEN; i += 1) b[i] = baris[i] ?? 0;
      return b as Bingkai;
    }),
  };
}

export function bacaContoh(): readonly Contoh[] {
  try {
    const teks = localStorage.getItem(KUNCI);
    if (!teks) return [];
    const isi = JSON.parse(teks) as ContohTersimpan[];
    if (!Array.isArray(isi)) return [];
    return isi.map(dariTersimpan);
  } catch {
    // Isi yang rusak diperlakukan sebagai belum ada. Melempar di sini akan
    // mematikan seluruh aplikasi karena sebuah fitur tambahan.
    return [];
  }
}

export function tulisContoh(contoh: readonly Contoh[]): void {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(contoh.map(keTersimpan)));
  } catch {
    // Penyimpanan penuh atau diblokir. Fitur suara tidak akan bertahan sampai
    // pembukaan berikutnya, tetapi sisa aplikasi tidak terganggu sama sekali.
  }
}

export function hapusContoh(): void {
  try {
    localStorage.removeItem(KUNCI);
  } catch {
    // Tidak ada yang bisa dilakukan, dan tidak ada yang perlu.
  }
}
