/**
 * Pengenal kosakata tertutup: dari gelombang suara menjadi nominal Rupiah.
 *
 * Fungsi murni. Seluruh berkas ini bisa diuji tanpa mikrofon, tanpa perangkat,
 * dan tanpa model apa pun — yang masuk hanya angka, yang keluar juga angka.
 *
 * Rantainya:
 *
 *   gelombang -> MFCC -> pisahkan kata -> cocokkan tiap potongan -> urai
 *
 * Tiga lapisan pertama ada di berkas tetangga. Berkas ini merangkainya, lalu
 * menyerahkan deretan kata kepada `audio/urai.ts` yang sudah punya tiga puluh
 * lima tes sendiri.
 *
 * KAPAN IA HARUS MENOLAK. Menolak jauh lebih penting daripada menebak. Sebuah
 * nominal yang salah menjadi kembalian yang salah, dan pengguna kami tidak
 * punya cara memeriksanya. Karena itu ada dua gerbang:
 *
 *   1. JARAK — potongan yang tidak cukup mirip dengan contoh mana pun ditolak
 *      seluruhnya, bukan dipaksakan ke kata terdekat.
 *   2. SELISIH — kalau dua kata sama-sama mendekati, keduanya diragukan.
 *      "Tujuh" dan "puluh" berbunyi mirip; memilih salah satunya secara asal
 *      berarti selisih sepuluh kali lipat pada nominalnya.
 */

import { uraiNominal } from '../urai';
import { hitungMfcc, kurangiRerata, type Bingkai } from './mfcc';
import { pisahkanKata } from './segmen';
import { jarakDtw } from './dtw';

/** Contoh suara satu kata, sudah menjadi ciri. */
export interface Contoh {
  readonly kata: string;
  readonly bingkai: readonly Bingkai[];
}

export interface OpsiPengenal {
  /**
   * Jarak DTW maksimum agar sebuah potongan diterima.
   *
   * Nilainya diturunkan dari pengukuran, bukan dipilih rapi: ucapan yang sama
   * dari orang yang sama biasanya berjarak di bawah 20, sementara kata yang
   * berbeda melompat jauh di atasnya.
   */
  readonly jarakMaks?: number;
  /**
   * Seberapa jauh juara harus unggul dari runner-up, dalam pecahan.
   *
   * 0,08 berarti kata terbaik harus setidaknya 8% lebih dekat daripada kata
   * kedua. Di bawah itu sistem menyatakan dirinya ragu, dan diam.
   */
  readonly selisihMin?: number;
}

export interface HasilKata {
  readonly kata: string;
  readonly jarak: number;
  /** Kata terdekat kedua. Berguna saat menelusuri salah dengar. */
  readonly saingan: string | null;
}

/**
 * Mencocokkan satu potongan dengan seluruh contoh yang dimiliki.
 *
 * Mengembalikan `null` bila tidak ada yang cukup meyakinkan.
 */
export function cocokkanKata(
  potongan: readonly Bingkai[],
  contoh: readonly Contoh[],
  opsi: OpsiPengenal = {},
): HasilKata | null {
  const jarakMaks = opsi.jarakMaks ?? 26;
  const selisihMin = opsi.selisihMin ?? 0.08;
  if (contoh.length === 0 || potongan.length === 0) return null;

  // Jarak terbaik PER KATA, bukan per contoh. Kata yang kebetulan punya lebih
  // banyak contoh tidak boleh lebih mungkin menang hanya karena jumlahnya.
  const terdekat = new Map<string, number>();
  for (const c of contoh) {
    const d = jarakDtw(potongan, c.bingkai);
    const sekarang = terdekat.get(c.kata);
    if (sekarang === undefined || d < sekarang) terdekat.set(c.kata, d);
  }

  const urut = [...terdekat.entries()].sort((a, b) => a[1] - b[1]);
  const juara = urut[0];
  if (!juara) return null;

  const [kata, jarak] = juara;
  if (!Number.isFinite(jarak) || jarak > jarakMaks) return null;

  const kedua = urut[1];
  if (kedua) {
    const selisih = (kedua[1] - jarak) / Math.max(jarak, 1e-6);
    if (selisih < selisihMin) return null;
  }

  return { kata, jarak, saingan: kedua?.[0] ?? null };
}

/**
 * Mengambil ciri SATU kata dari rekaman pendek, untuk dijadikan contoh latih.
 *
 * Potongan terpanjang yang dipilih, bukan yang pertama: saat melatih suara,
 * pengguna kadang berdeham atau menggeser jari di layar lebih dulu, dan bunyi
 * itu selalu lebih pendek daripada katanya.
 *
 * Mengembalikan `null` bila tidak ada ucapan yang terdengar sama sekali —
 * contoh latih yang berisi keheningan akan meracuni seluruh pengenalan
 * sesudahnya, dan lebih baik meminta pengguna mengulang.
 */
export function ciriSatuKata(contohSuara: Float32Array): readonly Bingkai[] | null {
  const { bingkai, energi } = hitungMfcc(contohSuara);
  const potongan = pisahkanKata(energi);
  if (potongan.length === 0) return null;

  let terpanjang = potongan[0];
  for (const p of potongan) {
    if (p.akhir - p.mulai > (terpanjang?.akhir ?? 0) - (terpanjang?.mulai ?? 0)) {
      terpanjang = p;
    }
  }
  if (!terpanjang) return null;
  return kurangiRerata(bingkai.slice(terpanjang.mulai, terpanjang.akhir));
}

export interface HasilDengar {
  /** Nominal yang terbaca, atau null kalau tidak bisa dipastikan. */
  readonly nominal: number | null;
  /** Kata yang berhasil dikenali, berurutan. Untuk jejak dan penelusuran. */
  readonly kata: readonly string[];
  /** Berapa potongan suara yang ditemukan, termasuk yang ditolak. */
  readonly jumlahPotongan: number;
}

/**
 * Rantai penuh: gelombang suara menjadi nominal.
 *
 * Potongan yang tidak dikenali DILEWATI, bukan membatalkan seluruh ucapan.
 * Alasannya praktis: orang sering menambahkan kata di luar kosakata kami —
 * "totalnya lima puluh ribu", "eh, lima puluh ribu" — dan menolak seluruh
 * kalimat karena satu kata asing akan membuat fitur ini terasa rewel.
 *
 * Yang TIDAK dilewati adalah keraguan pada kata yang memang milik kosakata.
 * Itu ditangani `cocokkanKata`, dan hasilnya sama: potongan itu tidak masuk
 * hitungan sama sekali.
 */
export function dengarNominal(
  contohSuara: Float32Array,
  contoh: readonly Contoh[],
  opsi: OpsiPengenal = {},
): HasilDengar {
  const { bingkai, energi } = hitungMfcc(contohSuara);
  const potongan = pisahkanKata(energi);

  const kata: string[] = [];
  for (const p of potongan) {
    // Dinormalkan PER POTONGAN. Lihat catatan di `kurangiRerata`.
    const irisan = kurangiRerata(bingkai.slice(p.mulai, p.akhir));
    const hasil = cocokkanKata(irisan, contoh, opsi);
    if (hasil) kata.push(hasil.kata);
  }

  const urai = kata.length > 0 ? uraiNominal(kata.join(' ')) : null;
  return {
    nominal: urai?.nominal ?? null,
    kata,
    jumlahPotongan: potongan.length,
  };
}
