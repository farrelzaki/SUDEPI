/**
 * Platform bohongan untuk `pnpm dev` di browser desktop.
 *
 * Tanpa ini, membuka aplikasi di laptop akan gagal begitu ada pemanggilan
 * Capacitor. Sebagian besar pekerjaan UI jadi bisa dikerjakan tanpa HP
 * tertancap, dan itu menghemat banyak waktu selama lomba.
 */

import {
  PENGATURAN_BAWAAN,
  type Pengaturan,
  type Platform,
  type PolaGetar,
} from '@/contracts';

export interface MockPlatform extends Platform {
  readonly getaran: readonly PolaGetar[];
  bersihkanRiwayat(): void;
}

export function buatMockPlatform(
  awal: Partial<Pengaturan> = {},
): MockPlatform {
  const getaran: PolaGetar[] = [];
  let pengaturan: Pengaturan = { ...PENGATURAN_BAWAAN, ...awal };

  return {
    getaran,

    async getar(pola) {
      getaran.push(pola);
    },

    async setSenter() {
      // Senter dikendalikan lewat aliran kamera, bukan lewat platform.
    },

    async bacaPengaturan() {
      return pengaturan;
    },

    async tulisPengaturan(sebagian) {
      pengaturan = { ...pengaturan, ...sebagian };
    },

    bersihkanRiwayat() {
      getaran.length = 0;
    },
  };
}

/**
 * Memilih platform sesuai lingkungan.
 *
 * Deteksinya memeriksa keberadaan objek `Capacitor` global, bukan `userAgent`.
 * User agent WebView Android sulit dibedakan dari Chrome biasa, dan menebak
 * salah berarti aplikasi memanggil plugin yang tidak ada.
 */
export async function pilihPlatform(): Promise<Platform> {
  const adaKapasitor =
    typeof globalThis === 'object' &&
    'Capacitor' in globalThis &&
    Boolean((globalThis as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor?.isNativePlatform?.());

  if (!adaKapasitor) return buatMockPlatform();

  const { buatPlatformKapasitor } = await import('./kapasitor');
  return buatPlatformKapasitor();
}
