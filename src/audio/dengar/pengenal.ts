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
import { hitungMfcc, kurangiRerata, tambahDelta, type Bingkai } from './mfcc';
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
   * Skalanya berubah total setelah ciri disetarakan ragamnya — dulu berkisar
   * belasan sampai tiga puluhan, kini satuan. Angka awal ini sengaja longgar;
   * nilai sebenarnya ditetapkan dari jejak `[KATA]` di perangkat, bukan
   * ditebak.
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
/**
 * Mengurutkan seluruh kata menurut kedekatannya dengan sebuah potongan.
 *
 * Dipisahkan dari `cocokkanKata` supaya kalibrasi bisa melihat peringkat PENUH,
 * termasuk pada potongan yang akhirnya ditolak. Menetapkan ambang tanpa melihat
 * jarak yang ditolak sama saja dengan menebak — dan kami sudah pernah membayar
 * mahal untuk ambang yang ditebak.
 */
export function peringkatKata(
  potongan: readonly Bingkai[],
  contoh: readonly Contoh[],
): readonly (readonly [string, number])[] {
  // Jarak terbaik PER KATA, bukan per contoh. Kata yang kebetulan punya lebih
  // banyak contoh tidak boleh lebih mungkin menang hanya karena jumlahnya.
  const terdekat = new Map<string, number>();
  for (const c of contoh) {
    const d = jarakDtw(potongan, c.bingkai);
    const sekarang = terdekat.get(c.kata);
    if (sekarang === undefined || d < sekarang) terdekat.set(c.kata, d);
  }
  return [...terdekat.entries()].sort((a, b) => a[1] - b[1]);
}

export function cocokkanKata(
  potongan: readonly Bingkai[],
  contoh: readonly Contoh[],
  opsi: OpsiPengenal = {},
): HasilKata | null {
  const jarakMaks = opsi.jarakMaks ?? 6;
  const selisihMin = opsi.selisihMin ?? 0.08;
  if (contoh.length === 0 || potongan.length === 0) return null;

  const urut = peringkatKata(potongan, contoh);
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
/**
 * Bingkai minimum agar sebuah rekaman layak menjadi contoh latih.
 *
 * Sepuluh bingkai adalah 100 milidetik. Lebih pendek dari itu bukan kata yang
 * diucapkan melainkan dentum, dan contoh latih yang buruk MERACUNI seluruh
 * pengenalan sesudahnya tanpa pernah terlihat — ia diam-diam menarik setiap
 * ucapan lain ke arah yang salah.
 */
const MIN_BINGKAI_CONTOH = 10;

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
  if (terpanjang.akhir - terpanjang.mulai < MIN_BINGKAI_CONTOH) return null;
  return tambahDelta(kurangiRerata(bingkai.slice(terpanjang.mulai, terpanjang.akhir)));
}

/** Peringkat satu potongan, untuk jejak kalibrasi. */
export interface RincianPotongan {
  /** Kata yang diterima, atau null bila potongan ini ditolak. */
  readonly diterima: string | null;
  readonly juara: string;
  readonly jarak: number;
  readonly kedua: string | null;
  readonly jarakKedua: number | null;
}

export interface HasilDengar {
  /** Nominal yang terbaca, atau null kalau tidak bisa dipastikan. */
  readonly nominal: number | null;
  /** Kata yang berhasil dikenali, berurutan. Untuk jejak dan penelusuran. */
  readonly kata: readonly string[];
  /** Berapa potongan suara yang ditemukan, termasuk yang ditolak. */
  readonly jumlahPotongan: number;
  /** Peringkat per potongan. Dipakai menetapkan ambang dari pengukuran. */
  readonly rincian: readonly RincianPotongan[];
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
function sekaliJalan(
  bingkai: readonly Bingkai[],
  energi: Float32Array,
  contoh: readonly Contoh[],
  opsi: OpsiPengenal,
  margin: number,
): HasilDengar {
  const potongan = pisahkanKata(energi, { margin });

  const kata: string[] = [];
  const rincian: RincianPotongan[] = [];

  for (const p of potongan) {
    // Dinormalkan PER POTONGAN. Lihat catatan di `kurangiRerata`.
    const irisan = tambahDelta(kurangiRerata(bingkai.slice(p.mulai, p.akhir)));
    const hasil = cocokkanKata(irisan, contoh, opsi);
    if (hasil) kata.push(hasil.kata);

    const urut = peringkatKata(irisan, contoh);
    const juara = urut[0];
    const kedua = urut[1];
    if (juara) {
      rincian.push({
        diterima: hasil?.kata ?? null,
        juara: juara[0],
        jarak: juara[1],
        kedua: kedua?.[0] ?? null,
        jarakKedua: kedua?.[1] ?? null,
      });
    }
  }

  const urai = kata.length > 0 ? uraiNominal(kata.join(' ')) : null;
  return {
    nominal: urai?.nominal ?? null,
    kata,
    jumlahPotongan: potongan.length,
    rincian,
  };
}

/**
 * Margin yang lebih peka untuk percobaan kedua.
 *
 * Bahaya terbesar pemisah kata adalah ucapan cepat: "limapuluhribu" yang
 * diucapkan tanpa jeda menjadi SATU potongan, dan seluruh nominal gagal
 * terbaca. Margin yang lebih rendah membuat lembah energi di antara suku kata
 * cukup untuk memotong.
 *
 * Tidak dipakai sebagai margin baku karena ia juga membuat derau lebih mudah
 * dianggap kata. Dicoba hanya bila percobaan pertama tidak menghasilkan apa-apa
 * — pada titik itu, tidak ada yang bisa hilang.
 */
const MARGIN_PEKA = 0.7;

export function dengarNominal(
  contohSuara: Float32Array,
  contoh: readonly Contoh[],
  opsi: OpsiPengenal = {},
): HasilDengar {
  const { bingkai, energi } = hitungMfcc(contohSuara);

  const pertama = sekaliJalan(bingkai, energi, contoh, opsi, 1.2);
  if (pertama.nominal !== null) return pertama;

  // Percobaan kedua, lebih peka. Hasilnya dipakai hanya bila ia benar-benar
  // menemukan nominal; kalau tidak, laporan percobaan pertama yang
  // dikembalikan, sebab jejaknya lebih mewakili apa yang sebenarnya terdengar.
  const kedua = sekaliJalan(bingkai, energi, contoh, opsi, MARGIN_PEKA);
  return kedua.nominal !== null ? kedua : pertama;
}
