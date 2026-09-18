/**
 * Jembatan ke mikrofon perangkat.
 *
 * Pembungkus tipis di atas plugin Java kami di `native/android/`. Tidak ada
 * logika pengenalan di sini sama sekali — seluruh pengenalan dikerjakan di
 * `src/audio/dengar/` sebagai fungsi murni yang bisa diuji tanpa perangkat.
 *
 * KENAPA MEREKAM LEWAT JAVA, BUKAN `getUserMedia`. Cara yang wajar adalah
 * meminta mikrofon dari dalam halaman, dan itu sudah dicoba: WebView menolaknya
 * dengan `NotReadableError: Could not start audio source`, walaupun izin
 * Android sudah diberikan, tidak ada aplikasi lain yang memegang mikrofon, dan
 * saklar privasi sistem tidak aktif. Lapisan penangkapan audio WebView memang
 * tidak dapat diandalkan di sebagian perangkat, dan perangkat uji kami termasuk
 * di dalamnya. `AudioRecord` di Java tidak punya persoalan itu.
 *
 * Lihat ADR-0013 untuk seluruh jalur yang pernah dicoba dan alasan masing-masing
 * ditinggalkan — termasuk mesin pengenalan bawaan Android, yang berjalan tetapi
 * tidak punya paket Bahasa Indonesia di perangkat ini.
 */

import { registerPlugin } from '@capacitor/core';

/** Galat yang mungkin dilempar `rekam()`. Kodenya datang dari sisi Java. */
export type GalatDengar =
  | 'IZIN_DITOLAK'
  | 'MIKROFON_BERMASALAH'
  | 'TIDAK_TERTANGKAP'
  | 'TIDAK_ADA_SUARA'
  | 'SEDANG_SIBUK'
  | 'JARINGAN_GAGAL'
  /** Gagal yang tidak dikenali. Dianggap SEMENTARA — fitur tetap ditawarkan. */
  | 'GAGAL_LAIN';

export interface RekamanMentah {
  /** Gelombang -1..1 pada `laju` contoh per detik. */
  readonly contoh: Float32Array;
  readonly laju: number;
}

export interface PengenalSuara {
  /** Meminta izin mikrofon. Selesai segera bila izinnya sudah ada. */
  mintaIzin(): Promise<boolean>;
  rekam(durasiMs: number): Promise<RekamanMentah>;
  /**
   * Pengenalan ucapan lewat mesin Android, mode DARING — Rencana B.
   *
   * Mengembalikan beberapa kemungkinan teks, diurut dari yang paling diyakini.
   * HANYA boleh dipanggil saat pengguna sendiri menyalakan mode daring:
   * yang dikirim ke server adalah suara orangnya.
   */
  dengarDaring(): Promise<readonly string[]>;
}

/* ----------------------------------------------------------- sisi natif */

interface PluginNatif {
  mintaIzin(): Promise<{ izin: string }>;
  rekam(opsi: { durasiMs: number }): Promise<{
    pcm: string;
    laju: number;
    jumlah: number;
  }>;
  dengarDaring(): Promise<{ teks: string[] }>;
}

const natif = registerPlugin<PluginNatif>('PengenalSuara');

function buatNatif(): PengenalSuara {
  return {
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

    async dengarDaring() {
      const r = await natif.dengarDaring();
      return r.teks ?? [];
    },
  };
}

/* ------------------------------------------------------------ sisi tiruan */

/**
 * Tiruan untuk browser desktop.
 *
 * Menolak merekam, sama seperti perangkat tanpa mikrofon. Dengan begitu jalur
 * kegagalan ikut terbangun dan teruji setiap kali kami menjalankan `pnpm dev`,
 * bukan hanya di perangkat.
 */
export function buatMockPengenalSuara(): PengenalSuara {
  return {
    mintaIzin: () => Promise.resolve(false),
    rekam: () => Promise.reject(new Error('MIKROFON_BERMASALAH')),
    dengarDaring: () => Promise.reject(new Error('MIKROFON_BERMASALAH')),
  };
}

/** Memilih sendiri antara plugin natif dan tiruan. */
export function buatPengenalSuara(): PengenalSuara {
  return import.meta.env.PROD ? buatNatif() : buatMockPengenalSuara();
}

/**
 * Membongkar PCM 16-bit little-endian dari base64 menjadi gelombang -1..1.
 *
 * Dikirim sebagai base64, bukan larik angka JSON: tiga detik audio adalah
 * empat puluh delapan ribu contoh, dan sebagai teks JSON itu menjadi ratusan
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
    'IZIN_DITOLAK',
    'MIKROFON_BERMASALAH',
    'TIDAK_TERTANGKAP',
    'TIDAK_ADA_SUARA',
    'SEDANG_SIBUK',
    'JARINGAN_GAGAL',
    'GAGAL_LAIN',
  ];
  return dikenal.find((k) => pesan.includes(k)) ?? 'GAGAL_LAIN';
}
