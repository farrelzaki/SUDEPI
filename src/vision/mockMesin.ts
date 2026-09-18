/**
 * Mesin inferensi bohongan.
 *
 * Gunanya: membangun dan menguji sisa aplikasi tanpa model ONNX, tanpa kamera,
 * dan tanpa HP. Perilakunya mengikuti kontrak yang sama persis dengan mesin
 * sungguhan, termasuk janji bahwa keluarannya sudah lolos gating.
 */

import {
  AMBANG_KEYAKINAN,
  denominasiDariKode,
  KODE_KELAS_KOIN,
  NOMINAL_URUT,
  type Deteksi,
  type KodeKelas,
  type MesinInferensi,
} from '@/contracts';

export interface OpsiMockMesin {
  /** Jeda buatan per bingkai, meniru latensi inferensi sungguhan. */
  readonly latensiMs?: number;
  /** Urutan naskah yang diputar berulang. Kosong = selalu tidak ada objek. */
  readonly naskah?: readonly (readonly KodeKelas[])[];
}

/** Membuat satu deteksi dengan kotak yang tidak bertumpuk dengan tetangganya. */
export function buatDeteksi(
  kodeKelas: KodeKelas,
  urutanKe: number,
  skor = 0.95,
): Deteksi {
  const d = denominasiDariKode(kodeKelas);
  return {
    kodeKelas,
    nominal: d?.nominal ?? null,
    koin: d?.koin ?? false,
    skor,
    kotak: { x: 0.1, y: 0.1 + urutanKe * 0.22, w: 0.6, h: 0.18 },
    iouMaks: 0,
  };
}

/**
 * Naskah bawaan, sengaja memuat kasus buruk — bukan hanya jalur bahagia.
 *
 * Kalau mock hanya memutar jalur bahagia, bug jalur buruk baru ketahuan di
 * jam ke-21, saat tidak ada lagi waktu memperbaikinya.
 */
export const NASKAH_BAWAAN: readonly (readonly KodeKelas[])[] = [
  // Tidak ada objek — kamera menghadap meja kosong.
  [],
  // Selembar 50.000 TE 2022.
  [12],
  // Tiga lembar sekaligus: 100.000 + 20.000 + 5.000, campur emisi.
  [13, 11, 9],
  // Uang kertas plus koin.
  [10, KODE_KELAS_KOIN],
  // Hanya koin, tanpa uang kertas.
  [KODE_KELAS_KOIN],
];

export function buatMockMesin(opsi: OpsiMockMesin = {}): MesinInferensi {
  const latensiMs = opsi.latensiMs ?? 120;
  const naskah = opsi.naskah ?? NASKAH_BAWAAN;
  let bingkaiKe = 0;
  let ditutup = false;

  return {
    async siap() {
      await tidur(50);
    },

    async deteksi() {
      if (ditutup) return [];
      await tidur(latensiMs);

      if (naskah.length === 0) return [];
      // Tiap adegan bertahan 10 bingkai, supaya voting temporal sempat lolos.
      const adegan = naskah[Math.floor(bingkaiKe / 10) % naskah.length] ?? [];
      bingkaiKe += 1;

      return adegan.map((kode, i) => buatDeteksi(kode, i, AMBANG_KEYAKINAN + 0.1));
    },

    tutup() {
      ditutup = true;
    },
  };
}

/** Semua pecahan sekaligus. Berguna untuk menguji tata letak yang padat. */
export const SEMUA_PECAHAN_TE2022: readonly KodeKelas[] = NOMINAL_URUT.map(
  (_, i) => i + NOMINAL_URUT.length,
);

function tidur(ms: number): Promise<void> {
  return new Promise((selesai) => setTimeout(selesai, ms));
}
