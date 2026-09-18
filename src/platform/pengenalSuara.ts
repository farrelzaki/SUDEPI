/**
 * Pengenalan suara luring.
 *
 * Pembungkus tipis di atas plugin Java kami di `native/android/`. Seluruh
 * keputusan penting ada di sana; yang dikerjakan berkas ini hanya menerjemahkan
 * hasilnya menjadi bentuk yang enak dipakai antarmuka, dan menyediakan tiruan
 * untuk browser.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR: tidak ada jalur mundur ke pengenalan lewat
 * jaringan, dalam keadaan apa pun. Kalau pengenalan luring tidak tersedia,
 * `periksa()` mengembalikan `tersedia: false` dan antarmuka menyembunyikan
 * fiturnya — pengguna tidak pernah ditawari sesuatu yang diam-diam mengirim
 * suaranya ke internet. Lihat ADR-0005 dan ADR-0013.
 */

import { registerPlugin } from '@capacitor/core';

/** Galat yang mungkin dilempar `dengar()`. Kodenya datang dari sisi Java. */
export type GalatDengar =
  | 'TIDAK_TERTANGKAP'
  | 'TIDAK_ADA_SUARA'
  | 'IZIN_DITOLAK'
  | 'SEDANG_SIBUK'
  | 'MIKROFON_BERMASALAH'
  | 'TERNYATA_DARING'
  | 'LURING_TIDAK_ADA'
  | 'BAHASA_TIDAK_ADA'
  | 'GAGAL_MULAI'
  /** Gagal yang tidak dikenali. Dianggap SEMENTARA — fitur tetap ditawarkan. */
  | 'GAGAL_LAIN';

export interface KeadaanSuara {
  /** Boleh ditawarkan kepada pengguna. */
  readonly tersedia: boolean;
  /** Izin mikrofon sudah diberikan. */
  readonly berizin: boolean;
}

export interface RekamanMentah {
  readonly contoh: Float32Array;
  readonly laju: number;
}

export interface PengenalSuara {
  periksa(): Promise<KeadaanSuara>;
  /**
   * Merekam suara mentah lewat `AudioRecord` di sisi Java.
   *
   * Jalur ini ada karena `getUserMedia` di dalam WebView menolak membuka
   * mikrofon pada sebagian perangkat — termasuk perangkat uji kami — dengan
   * `NotReadableError`, walaupun seluruh izin sudah diberikan.
   */
  rekam(durasiMs: number): Promise<RekamanMentah>;
  mintaIzin(): Promise<boolean>;
  /**
   * Mendengarkan satu ucapan.
   *
   * Mengembalikan BEBERAPA kemungkinan teks, bukan hanya yang teratas.
   * Pengurai bilangan kami sering bisa memahami kemungkinan kedua padahal
   * yang pertama tidak terbaca sebagai nominal.
   */
  dengar(): Promise<readonly string[]>;
  berhenti(): Promise<void>;
}

/* ----------------------------------------------------------- sisi natif */

interface PluginNatif {
  periksa(): Promise<{
    adaMesin: boolean;
    luring: boolean;
    izin: string;
    sdk: number;
  }>;
  mintaIzin(): Promise<{ izin: string }>;
  rekam(opsi: { durasiMs: number }): Promise<{
    pcm: string;
    laju: number;
    jumlah: number;
  }>;
  dengar(): Promise<{ teks: string[] }>;
  berhenti(): Promise<void>;
}

const natif = registerPlugin<PluginNatif>('PengenalSuara');

function buatNatif(): PengenalSuara {
  return {
    async periksa() {
      try {
        const r = await natif.periksa();
        console.log(
          `[SUARA] mesin=${r.adaMesin} luring=${r.luring} izin=${r.izin} sdk=${r.sdk}`,
        );
        return { tersedia: r.luring, berizin: r.izin === 'granted' };
      } catch {
        // Plugin tidak terpasang, misalnya saat berjalan di browser. Bukan
        // kegagalan — hanya berarti fitur ini tidak ada di sini.
        return { tersedia: false, berizin: false };
      }
    },

    async mintaIzin() {
      try {
        const r = await natif.mintaIzin();
        return r.izin === 'granted';
      } catch {
        return false;
      }
    },

    async rekam(durasiMs: number) {
      const r = await natif.rekam({ durasiMs });
      return { contoh: dariBase64Pcm16(r.pcm), laju: r.laju };
    },

    async dengar() {
      const r = await natif.dengar();
      return r.teks ?? [];
    },

    berhenti: () => natif.berhenti().catch(() => undefined),
  };
}

/* ------------------------------------------------------------ sisi tiruan */

/**
 * Tiruan untuk browser desktop.
 *
 * Melaporkan dirinya TIDAK tersedia, sama seperti perangkat tanpa mesin
 * luring. Dengan begitu jalur "fitur disembunyikan" ikut terbangun dan teruji
 * setiap kali kami menjalankan `pnpm dev`, bukan hanya di perangkat langka.
 */
export function buatMockPengenalSuara(): PengenalSuara {
  return {
    periksa: () => Promise.resolve({ tersedia: false, berizin: false }),
    rekam: () => Promise.reject(new Error('LURING_TIDAK_ADA')),
    mintaIzin: () => Promise.resolve(false),
    dengar: () => Promise.reject(new Error('LURING_TIDAK_ADA')),
    berhenti: () => Promise.resolve(),
  };
}

/** Memilih sendiri antara plugin natif dan tiruan. */
export function buatPengenalSuara(): PengenalSuara {
  return import.meta.env.PROD ? buatNatif() : buatMockPengenalSuara();
}

/**
 * Membongkar PCM 16-bit little-endian dari base64 menjadi gelombang -1..1.
 *
 * Dikirim sebagai base64, bukan larik angka JSON: dua setengah detik audio
 * adalah empat puluh ribu contoh, dan sebagai teks JSON itu menjadi ratusan
 * kilobyte yang harus diurai — penyeberangan jembatannya sendiri akan menjadi
 * bagian paling lambat dari seluruh proses.
 */
function dariBase64Pcm16(base64: string): Float32Array {
  const biner = atob(base64);
  const jumlah = Math.floor(biner.length / 2);
  const keluar = new Float32Array(jumlah);

  for (let i = 0; i < jumlah; i += 1) {
    const rendah = biner.charCodeAt(i * 2);
    const tinggi = biner.charCodeAt(i * 2 + 1);
    // Dua bita menjadi satu bilangan bertanda 16-bit.
    let nilai = (tinggi << 8) | rendah;
    if (nilai >= 0x8000) nilai -= 0x10000;
    keluar[i] = nilai / 32768;
  }
  return keluar;
}

/** Mengambil kode galat dari apa pun yang dilempar sisi natif. */
export function kodeGalat(e: unknown): GalatDengar {
  const pesan =
    e instanceof Error
      ? e.message
      : typeof e === 'string'
        ? e
        : String((e as { message?: string })?.message ?? '');

  const dikenal: readonly GalatDengar[] = [
    'TIDAK_TERTANGKAP',
    'TIDAK_ADA_SUARA',
    'IZIN_DITOLAK',
    'SEDANG_SIBUK',
    'MIKROFON_BERMASALAH',
    'TERNYATA_DARING',
    'LURING_TIDAK_ADA',
    'BAHASA_TIDAK_ADA',
    'GAGAL_MULAI',
    'GAGAL_LAIN',
  ];
  return dikenal.find((k) => pesan.includes(k)) ?? 'GAGAL_LAIN';
}
