/**
 * Penyusun bilangan Bahasa Indonesia.
 *
 * Fungsi murni. Mengubah angka menjadi urutan potongan audio yang harus
 * diputar, bukan menjadi teks — teksnya hanya perantara untuk memilih klip.
 *
 * Bahasa Indonesia sangat menguntungkan di sini karena penyusunan bilangannya
 * teratur. Sekitar 20 potongan sudah cukup untuk melafalkan seluruh nominal
 * sampai ratusan juta, dan itulah yang membuat ADR-0003 (audio pra-render)
 * layak dijalani.
 *
 * Tiga kaidah yang gampang terlewat, dan ketiganya punya tes:
 *
 *   1.000   -> "seribu"        BUKAN "satu ribu"
 *     100   -> "seratus"       BUKAN "satu ratus"
 *      10   -> "sepuluh"       BUKAN "satu puluh"
 *      11   -> "sebelas"       BUKAN "satu belas"
 *
 * Bentuk "se-" hanya berlaku untuk satuan tepat di depan ribu/ratus/puluh,
 * dan TIDAK menular ke tingkat yang lebih besar: 1.000.000 adalah "satu juta",
 * bukan "sejuta", dan 21.000 adalah "dua puluh satu ribu".
 */

/** Nama potongan audio. Satu nilai di sini = satu berkas klip. */
export type Klip =
  | 'nol'
  | 'satu'
  | 'dua'
  | 'tiga'
  | 'empat'
  | 'lima'
  | 'enam'
  | 'tujuh'
  | 'delapan'
  | 'sembilan'
  | 'sepuluh'
  | 'sebelas'
  | 'belas'
  | 'puluh'
  | 'seratus'
  | 'ratus'
  | 'seribu'
  | 'ribu'
  | 'juta'
  | 'rupiah';

const SATUAN: readonly Klip[] = [
  'nol',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
];

/**
 * Menyusun bilangan 1..999.
 *
 * Dipakai berulang untuk tiap tingkat (juta, ribu, satuan), sehingga kaidah
 * "se-" cukup ditulis sekali di sini.
 */
function diBawahSeribu(n: number): Klip[] {
  const keluar: Klip[] = [];

  const ratusan = Math.floor(n / 100);
  const sisa = n % 100;

  if (ratusan === 1) keluar.push('seratus');
  else if (ratusan > 1) {
    const s = SATUAN[ratusan];
    if (s) keluar.push(s, 'ratus');
  }

  if (sisa === 0) return keluar;

  if (sisa < 10) {
    const s = SATUAN[sisa];
    if (s) keluar.push(s);
    return keluar;
  }

  if (sisa === 10) {
    keluar.push('sepuluh');
    return keluar;
  }

  if (sisa === 11) {
    keluar.push('sebelas');
    return keluar;
  }

  if (sisa < 20) {
    const s = SATUAN[sisa - 10];
    if (s) keluar.push(s, 'belas');
    return keluar;
  }

  const puluhan = Math.floor(sisa / 10);
  const satuan = sisa % 10;
  const p = SATUAN[puluhan];
  if (p) keluar.push(p, 'puluh');
  if (satuan > 0) {
    const s = SATUAN[satuan];
    if (s) keluar.push(s);
  }
  return keluar;
}

/**
 * Mengubah nominal Rupiah menjadi urutan klip, termasuk kata "rupiah".
 *
 * Nilai negatif atau bukan bilangan bulat mengembalikan larik kosong, bukan
 * melempar error. Sistem ini dipakai orang yang tidak bisa melihat layar; ia
 * tidak boleh mati karena satu nilai aneh. Pemanggil yang menerima larik
 * kosong harus memperlakukannya sebagai "tidak ada yang bisa diucapkan".
 */
export function rupiahKeKlip(nilai: number): readonly Klip[] {
  if (!Number.isSafeInteger(nilai) || nilai < 0) return [];
  if (nilai === 0) return ['nol', 'rupiah'];

  const keluar: Klip[] = [];

  const juta = Math.floor(nilai / 1_000_000);
  const ribu = Math.floor((nilai % 1_000_000) / 1000);
  const satuan = nilai % 1000;

  if (juta > 0) {
    keluar.push(...diBawahSeribu(juta), 'juta');
  }

  if (ribu > 0) {
    // "seribu" hanya kalau tepat seribu pada tingkat ini — 21.000 tetap
    // "dua puluh satu ribu", dan 1.000.000 sudah ditangani di tingkat juta.
    if (ribu === 1) keluar.push('seribu');
    else keluar.push(...diBawahSeribu(ribu), 'ribu');
  }

  if (satuan > 0) {
    keluar.push(...diBawahSeribu(satuan));
  }

  keluar.push('rupiah');
  return keluar;
}

/**
 * Bentuk teks dari urutan klip.
 *
 * Bukan untuk diucapkan — pengucapan memakai klip. Ini dipakai untuk
 * `aria-label`, keperluan debug, dan agar tesnya terbaca sebagai kalimat.
 */
export function klipKeTeks(klip: readonly Klip[]): string {
  return klip.join(' ');
}

/** Jalan pintas: nominal langsung menjadi kalimat. */
export function rupiahKeTeks(nilai: number): string {
  return klipKeTeks(rupiahKeKlip(nilai));
}
