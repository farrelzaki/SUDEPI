/**
 * Dynamic Time Warping — mengukur kemiripan dua ucapan.
 *
 * Fungsi murni.
 *
 * MASALAH YANG DISELESAIKANNYA. Orang tidak pernah mengucapkan kata yang sama
 * dengan panjang yang sama. "Lima" bisa selesai dalam 300 ms atau meregang
 * sampai 600 ms, dan bagian mana yang meregang pun berbeda-beda — kadang
 * vokalnya, kadang jeda sebelum konsonan terakhir. Membandingkannya bingkai
 * demi bingkai secara lurus akan menyatakan dua ucapan itu sangat berbeda,
 * padahal telinga mana pun mendengarnya sama.
 *
 * DTW mencari cara MELURUSKAN keduanya: jalur perjodohan yang boleh maju lebih
 * cepat di satu sisi dan lebih lambat di sisi lain, lalu melaporkan seberapa
 * jauh keduanya setelah diluruskan sebaik mungkin.
 *
 * Dua batasan penting dipasang:
 *
 *   PITA SAKOE-CHIBA — perjodohan tidak boleh menyimpang terlalu jauh dari
 *   garis diagonal. Tanpa itu, DTW bisa meregangkan satu bingkai vokal menjadi
 *   seluruh kata lain, dan menyatakan "lima" mirip dengan "tiga" hanya karena
 *   keduanya punya vokal. Pita ini juga yang membuat perhitungannya cepat.
 *
 *   PEMBAGIAN PANJANG JALUR — jarak dibagi banyaknya langkah. Tanpa itu, kata
 *   yang panjang selalu terlihat lebih "jauh" daripada kata pendek, dan
 *   pengenalan akan selalu condong memilih kata terpendek.
 */

import { DIMENSI_CIRI, type Bingkai } from './mfcc';

/** Jarak Euclidean antara dua vektor ciri. */
function jarakBingkai(a: Bingkai, b: Bingkai): number {
  let jumlah = 0;
  for (let i = 0; i < DIMENSI_CIRI; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    jumlah += d * d;
  }
  return Math.sqrt(jumlah);
}

/**
 * Jarak DTW ternormalisasi antara dua deret bingkai.
 *
 * Semakin kecil semakin mirip. Mengembalikan `Infinity` bila salah satu deret
 * kosong — bukan nol, karena "tidak ada apa-apa" harus dianggap sangat berbeda
 * dari kata mana pun, bukan sangat mirip dengan semuanya.
 */
export function jarakDtw(
  a: readonly Bingkai[],
  b: readonly Bingkai[],
  lebarPita = 0.25,
): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Infinity;

  // Pita minimal harus cukup lebar untuk menampung selisih panjang kedua
  // deret; kalau tidak, jalurnya mustahil sampai ke ujung dan hasilnya tak
  // terhingga untuk pasangan yang sebenarnya mirip.
  const pita = Math.max(
    Math.abs(n - m) + 1,
    Math.ceil(lebarPita * Math.max(n, m)),
  );

  // Dua baris saja, bukan matriks penuh: hanya baris sebelumnya yang dibutuhkan.
  let sebelum = new Float64Array(m + 1).fill(Infinity);
  let kini = new Float64Array(m + 1).fill(Infinity);
  // Panjang jalur ditelusuri sejajar, supaya normalisasinya memakai jumlah
  // langkah yang benar-benar diambil, bukan perkiraan.
  let langkahSebelum = new Float64Array(m + 1);
  let langkahKini = new Float64Array(m + 1);

  sebelum[0] = 0;

  for (let i = 1; i <= n; i += 1) {
    kini.fill(Infinity);
    langkahKini.fill(0);

    const dari = Math.max(1, i - pita);
    const sampai = Math.min(m, i + pita);

    for (let j = dari; j <= sampai; j += 1) {
      const biaya = jarakBingkai(a[i - 1] as Bingkai, b[j - 1] as Bingkai);

      const diagonal = sebelum[j - 1] ?? Infinity;
      const atas = sebelum[j] ?? Infinity;
      const kiri = kini[j - 1] ?? Infinity;

      let terbaik = diagonal;
      let langkah = (langkahSebelum[j - 1] ?? 0) + 1;

      if (atas < terbaik) {
        terbaik = atas;
        langkah = (langkahSebelum[j] ?? 0) + 1;
      }
      if (kiri < terbaik) {
        terbaik = kiri;
        langkah = (langkahKini[j - 1] ?? 0) + 1;
      }

      if (terbaik === Infinity) continue;
      kini[j] = terbaik + biaya;
      langkahKini[j] = langkah;
    }

    [sebelum, kini] = [kini, sebelum];
    [langkahSebelum, langkahKini] = [langkahKini, langkahSebelum];
  }

  const total = sebelum[m] ?? Infinity;
  const langkah = langkahSebelum[m] ?? 0;
  if (!Number.isFinite(total) || langkah === 0) return Infinity;
  return total / langkah;
}
