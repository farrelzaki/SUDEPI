/**
 * Domain uang Rupiah.
 *
 * Model mengenali 15 kelas: 7 nominal x 2 tahun emisi, ditambah 1 kelas koin.
 * Koin hanya dideteksi KEBERADAANNYA, tidak pernah nilainya — nilainya
 * diturunkan dari selisih di `core/koin.ts`.
 */

export type Nominal = 1000 | 2000 | 5000 | 10000 | 20000 | 50000 | 100000;

export type Emisi = 2016 | 2022;

/** Indeks keluaran model, 0..14. */
export type KodeKelas = number;

export interface Denominasi {
  readonly kodeKelas: KodeKelas;
  /** null hanya untuk kelas koin. */
  readonly nominal: Nominal | null;
  readonly emisi: Emisi | null;
  readonly koin: boolean;
}

export const NOMINAL_URUT: readonly Nominal[] = [
  1000, 2000, 5000, 10000, 20000, 50000, 100000,
];

/** Pecahan kertas terkecil. Dipakai sebagai batas atas dugaan nilai koin. */
export const NOMINAL_TERKECIL: Nominal = 1000;

export const JUMLAH_KELAS = 15;

export const KODE_KELAS_KOIN = 14;

/**
 * Pemetaan indeks kelas model ke nominal Rupiah.
 *
 * PENTING: urutan di sini WAJIB sama persis dengan urutan `names` pada
 * `data.yaml` yang dipakai saat melatih model. Kalau tidak, sistem akan
 * menyebut nominal yang salah dengan penuh keyakinan — kegagalan paling
 * berbahaya yang bisa terjadi pada produk ini.
 *
 * Susunan: 0-6 = TE 2016 (menaik), 7-13 = TE 2022 (menaik), 14 = koin.
 */
export const TABEL_DENOMINASI: readonly Denominasi[] = [
  ...NOMINAL_URUT.map((nominal, i) => ({
    kodeKelas: i,
    nominal,
    emisi: 2016 as Emisi,
    koin: false,
  })),
  ...NOMINAL_URUT.map((nominal, i) => ({
    kodeKelas: i + NOMINAL_URUT.length,
    nominal,
    emisi: 2022 as Emisi,
    koin: false,
  })),
  { kodeKelas: KODE_KELAS_KOIN, nominal: null, emisi: null, koin: true },
];

/** Mengembalikan null kalau kode di luar 0..14, bukan melempar error. */
export function denominasiDariKode(kode: KodeKelas): Denominasi | null {
  return TABEL_DENOMINASI[kode] ?? null;
}
