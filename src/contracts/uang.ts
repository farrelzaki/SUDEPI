/**
 * Domain uang Rupiah.
 *
 * Model mengenali 8 kelas: 7 pecahan kertas ditambah 1 kelas koin.
 *
 * Tahun emisi TIDAK dipisahkan menjadi kelas berbeda. Uang TE 2016 dan TE 2022
 * sama-sama masuk ke kelas nominal yang sama, karena sistem tidak pernah
 * mengucapkan tahun emisi kepada pengguna — yang keluar adalah "lima puluh
 * ribu rupiah", titik. Memisahkannya hanya membelah data latih tanpa menambah
 * kemampuan apa pun. Lihat ADR-0007.
 *
 * Koin hanya dideteksi KEBERADAANNYA, tidak pernah nilainya. Nilainya
 * diturunkan dari selisih di `core/koin.ts`.
 */

export type Nominal = 1000 | 2000 | 5000 | 10000 | 20000 | 50000 | 100000;

/** Indeks keluaran model, 0..7. */
export type KodeKelas = number;

export interface Denominasi {
  readonly kodeKelas: KodeKelas;
  /** null hanya untuk kelas koin. */
  readonly nominal: Nominal | null;
  readonly koin: boolean;
}

export const NOMINAL_URUT: readonly Nominal[] = [
  1000, 2000, 5000, 10000, 20000, 50000, 100000,
];

/** Pecahan kertas terkecil. Dipakai sebagai batas atas dugaan nilai koin. */
export const NOMINAL_TERKECIL: Nominal = 1000;

export const JUMLAH_KELAS = 8;

export const KODE_KELAS_KOIN = 7;

/**
 * Pemetaan indeks kelas model ke nominal Rupiah.
 *
 * PENTING: urutan di sini WAJIB sama persis dengan urutan `names` pada
 * `data.yaml` yang dipakai saat melatih model. Kalau tidak, sistem akan
 * menyebut nominal yang salah dengan penuh keyakinan — kegagalan paling
 * berbahaya yang bisa terjadi pada produk ini.
 *
 * Susunan: 0-6 = pecahan menaik, 7 = koin.
 */
export const TABEL_DENOMINASI: readonly Denominasi[] = [
  ...NOMINAL_URUT.map((nominal, i) => ({
    kodeKelas: i,
    nominal,
    koin: false,
  })),
  { kodeKelas: KODE_KELAS_KOIN, nominal: null, koin: true },
];

/** Mengembalikan null kalau kode di luar 0..7, bukan melempar error. */
export function denominasiDariKode(kode: KodeKelas): Denominasi | null {
  return TABEL_DENOMINASI[kode] ?? null;
}

/** Kode kelas untuk sebuah nominal. null kalau nominalnya tidak dikenal. */
export function kodeDariNominal(nominal: Nominal): KodeKelas | null {
  const i = NOMINAL_URUT.indexOf(nominal);
  return i === -1 ? null : i;
}
