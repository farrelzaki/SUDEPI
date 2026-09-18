/**
 * Penyangga pemindaian.
 *
 * Fungsi murni. Tanpa I/O, tanpa Dexie, tanpa waktu sistem.
 *
 * KENAPA ADA. Pemindaian berjalan 5 sampai 10 bingkai per detik, masing-masing
 * menghasilkan beberapa deteksi. Menulis setiap deteksi ke IndexedDB saat itu
 * juga berarti ratusan transaksi tulis per menit, di utas yang sama dengan UI.
 * Pratinjau kamera akan tersendat, dan penyebabnya sangat sulit dilacak karena
 * tidak ada yang tampak salah di kode kamera.
 *
 * Jadi: kumpulkan di memori, ringkas, tulis sekali saat fase berakhir.
 *
 * Yang disimpan hanyalah deteksi yang IKUT MENENTUKAN KEPUTUSAN — himpunan yang
 * lolos voting — ditambah hitungan yang ditolak beserta alasannya. Ini tetap
 * memenuhi kebutuhan jejak audit Abstain Policy tanpa membanjiri basis data
 * dengan bingkai yang tidak pernah mempengaruhi apa pun.
 */

import type { Deteksi, HasilPindai } from '@/contracts';

export interface RingkasanPindai {
  readonly jumlahBingkai: number;
  readonly latensiRerataMs: number;
  readonly latensiMaksMs: number;
  readonly fpsRerata: number;
  readonly lumaRerata: number;
  readonly senterPernahAktif: boolean;
  /** Deteksi dari bingkai stabil terakhir. Kosong kalau tidak pernah stabil. */
  readonly deteksiFinal: readonly Deteksi[];
  /** Berapa bingkai berakhir abstain. Indikator kesehatan model. */
  readonly jumlahAbstain: number;
  readonly pernahStabil: boolean;
}

export interface Penyangga {
  tambah(hasil: HasilPindai): void;
  ringkas(): RingkasanPindai;
  kosongkan(): void;
}

const RINGKASAN_KOSONG: RingkasanPindai = {
  jumlahBingkai: 0,
  latensiRerataMs: 0,
  latensiMaksMs: 0,
  fpsRerata: 0,
  lumaRerata: 0,
  senterPernahAktif: false,
  deteksiFinal: [],
  jumlahAbstain: 0,
  pernahStabil: false,
};

export function buatPenyangga(): Penyangga {
  let jumlah = 0;
  let totalLatensi = 0;
  let latensiMaks = 0;
  let totalFps = 0;
  let totalLuma = 0;
  let senterPernahAktif = false;
  let jumlahAbstain = 0;
  let deteksiFinal: readonly Deteksi[] = [];
  let pernahStabil = false;

  return {
    tambah(hasil) {
      jumlah += 1;
      totalLatensi += hasil.latensiMs;
      if (hasil.latensiMs > latensiMaks) latensiMaks = hasil.latensiMs;
      totalFps += hasil.fps;
      totalLuma += hasil.luma;
      if (hasil.senterAktif) senterPernahAktif = true;
      if (hasil.status === 'abstain') jumlahAbstain += 1;
      if (hasil.status === 'stabil') {
        // Bingkai stabil TERAKHIR yang menang, bukan yang pertama. Pengguna
        // mungkin menambah lembaran di tengah pemindaian, dan yang benar
        // adalah apa yang terakhir dilihat sistem.
        deteksiFinal = hasil.deteksi;
        pernahStabil = true;
      }
    },

    ringkas() {
      if (jumlah === 0) return RINGKASAN_KOSONG;
      return {
        jumlahBingkai: jumlah,
        latensiRerataMs: totalLatensi / jumlah,
        latensiMaksMs: latensiMaks,
        fpsRerata: totalFps / jumlah,
        lumaRerata: totalLuma / jumlah,
        senterPernahAktif,
        deteksiFinal,
        jumlahAbstain,
        pernahStabil,
      };
    },

    kosongkan() {
      jumlah = 0;
      totalLatensi = 0;
      latensiMaks = 0;
      totalFps = 0;
      totalLuma = 0;
      senterPernahAktif = false;
      jumlahAbstain = 0;
      deteksiFinal = [];
      pernahStabil = false;
    },
  };
}

/**
 * Menghitung ringkasan harian dari daftar transaksi.
 *
 * Fungsi murni, dipisah dari basis data supaya bisa diuji langsung. Rasio
 * abstain adalah angka terpenting di sini: ia memberi tahu seberapa sering
 * sistem menolak menjawab, dan itulah indikator paling jujur tentang apakah
 * model bekerja di lapangan atau hanya di set validasi.
 */
export interface RingkasanHarian {
  readonly jumlahTransaksi: number;
  readonly jumlahSelesai: number;
  readonly jumlahDibatalkan: number;
  readonly jumlahAbstain: number;
  readonly rasioAbstain: number;
  readonly durasiRerataMs: number;
}

export function ringkasHarian(
  transaksi: readonly {
    readonly status: 'selesai' | 'dibatalkan' | 'abstain';
    readonly durasiMs: number;
  }[],
): RingkasanHarian {
  const jumlahTransaksi = transaksi.length;
  if (jumlahTransaksi === 0) {
    return {
      jumlahTransaksi: 0,
      jumlahSelesai: 0,
      jumlahDibatalkan: 0,
      jumlahAbstain: 0,
      rasioAbstain: 0,
      durasiRerataMs: 0,
    };
  }

  const hitung = (s: string): number =>
    transaksi.filter((t) => t.status === s).length;

  const jumlahAbstain = hitung('abstain');

  return {
    jumlahTransaksi,
    jumlahSelesai: hitung('selesai'),
    jumlahDibatalkan: hitung('dibatalkan'),
    jumlahAbstain,
    rasioAbstain: jumlahAbstain / jumlahTransaksi,
    durasiRerataMs:
      transaksi.reduce((j, t) => j + t.durasiMs, 0) / jumlahTransaksi,
  };
}

/** Kunci tanggal waktu-lokal, YYYY-MM-DD. Waktu disuntikkan, bukan dibaca. */
export function kunciTanggal(padaMs: number): string {
  const d = new Date(padaMs);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
