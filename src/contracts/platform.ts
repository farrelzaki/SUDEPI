/**
 * Kontrak lapisan perangkat.
 *
 * Seluruh pemanggilan Capacitor disembunyikan di balik antarmuka ini.
 * Alasannya praktis: `pnpm dev` di browser desktop tidak punya Capacitor, dan
 * kita ingin bisa mengembangkan sebagian besar aplikasi tanpa HP tertancap.
 */

import { AMBANG_IOU, AMBANG_KEYAKINAN, FPS_MAKS } from './vision';

export type PolaGetar = 'ringan' | 'sedang' | 'berhasil' | 'gagal';

/** Jalur input utama. Lihat ADR-0005 soal kenapa taktil yang utama. */
export type ModeInput = 'taktil' | 'suara';

/**
 * Dari mana pengguna mendengar hasil deteksi.
 *
 * Halaman web tidak dapat mengetahui apakah TalkBack sedang aktif, jadi ini
 * disediakan sebagai pilihan eksplisit, bukan deteksi otomatis.
 * Bawaannya 'aplikasi' supaya tetap bersuara walau tanpa pembaca layar.
 */
export type SumberSuara = 'aplikasi' | 'talkback';

export interface Pengaturan {
  readonly ambangKeyakinan: number;
  readonly ambangIoU: number;
  readonly targetFps: number;
  readonly senterOtomatis: boolean;
  readonly audioDucking: boolean;
  /** Pengali kecepatan ucapan, 1 = normal. */
  readonly kecepatanUcap: number;
  readonly modeInput: ModeInput;
  readonly sumberSuara: SumberSuara;
}

export const PENGATURAN_BAWAAN: Pengaturan = {
  ambangKeyakinan: AMBANG_KEYAKINAN,
  ambangIoU: AMBANG_IOU,
  targetFps: FPS_MAKS,
  senterOtomatis: true,
  audioDucking: true,
  kecepatanUcap: 1,
  modeInput: 'taktil',
  sumberSuara: 'aplikasi',
};

export interface Platform {
  getar(pola: PolaGetar): Promise<void>;
  setSenter(nyala: boolean): Promise<void>;
  bacaPengaturan(): Promise<Pengaturan>;
  tulisPengaturan(sebagian: Partial<Pengaturan>): Promise<void>;
}
