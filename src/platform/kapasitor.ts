/**
 * Implementasi `Platform` di atas Capacitor.
 *
 * Seluruh pemanggilan Capacitor disembunyikan di balik antarmuka ini, dengan
 * alasan yang sangat praktis: `pnpm dev` di browser desktop tidak punya
 * Capacitor, dan kita ingin membangun sebagian besar aplikasi tanpa HP
 * tertancap. Lihat `mock.ts` untuk pasangannya.
 *
 * Senter TIDAK ada di sini. Ia diatur lewat `MediaStreamTrack` langsung di
 * `vision/pemindai.ts`, karena senter adalah sifat dari aliran kamera yang
 * sedang hidup, bukan sifat perangkat. Memakai Web API juga berarti satu
 * plugin native lebih sedikit, dan setiap plugin adalah satu kemungkinan
 * kegagalan Gradle tambahan di tengah lomba.
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import {
  PENGATURAN_BAWAAN,
  type Pengaturan,
  type Platform,
  type PolaGetar,
} from '@/contracts';

const KUNCI_PENGATURAN = 'sudepi.pengaturan';

/**
 * Pemetaan pola getar ke getaran native.
 *
 * Haptik adalah satu-satunya isyarat yang tetap sampai ketika pasar terlalu
 * bising untuk mendengar apa pun, jadi polanya harus bisa dibedakan dengan
 * jari, bukan sekadar "bergetar".
 */
async function jalankanGetar(pola: PolaGetar): Promise<void> {
  switch (pola) {
    case 'ringan':
      await Haptics.impact({ style: ImpactStyle.Light });
      return;
    case 'sedang':
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    case 'berhasil':
      await Haptics.notification({ type: NotificationType.Success });
      return;
    case 'gagal':
      await Haptics.notification({ type: NotificationType.Error });
      return;
  }
}

export function buatPlatformKapasitor(): Platform {
  return {
    async getar(pola) {
      try {
        await jalankanGetar(pola);
      } catch {
        // Perangkat tanpa motor getar, atau izin ditolak. Bukan alasan
        // menghentikan transaksi — suara tetap jalan.
      }
    },

    async setSenter() {
      // Sengaja tidak melakukan apa-apa. Lihat catatan di kepala berkas:
      // senter dikendalikan lewat aliran kamera di vision/pemindai.ts.
    },

    async bacaPengaturan(): Promise<Pengaturan> {
      try {
        const { value } = await Preferences.get({ key: KUNCI_PENGATURAN });
        if (!value) return PENGATURAN_BAWAAN;
        // Sebar di atas bawaan, supaya pengaturan lama dari versi sebelumnya
        // tetap terbaca ketika ada kunci baru yang belum pernah disimpan.
        return { ...PENGATURAN_BAWAAN, ...(JSON.parse(value) as Partial<Pengaturan>) };
      } catch {
        // Data rusak tidak boleh membuat aplikasi gagal dibuka. Pengguna lebih
        // baik kehilangan preferensinya daripada kehilangan aplikasinya.
        return PENGATURAN_BAWAAN;
      }
    },

    async tulisPengaturan(sebagian) {
      const kini = await this.bacaPengaturan();
      await Preferences.set({
        key: KUNCI_PENGATURAN,
        value: JSON.stringify({ ...kini, ...sebagian }),
      });
    },
  };
}
