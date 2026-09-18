/**
 * Pemindai kamera bohongan.
 *
 * Inilah yang dipakai `ui/` selama model dan kamera sungguhan belum siap.
 * Ia memutar naskah `HasilPindai` bersandar waktu, LENGKAP DENGAN KASUS BURUK:
 * tidak ada objek, belum stabil, dan abstain.
 *
 * Cara pakai di UI:
 *
 *   const pemindai = buatMockPemindai();
 *   const berhenti = pemindai.langgan(setHasil);
 *   await pemindai.mulai(1);
 */

import {
  buatDeteksi,
  NASKAH_BAWAAN,
} from './mockMesin';
import {
  KODE_KELAS_KOIN,
  type Deteksi,
  type FasePindai,
  type HasilPindai,
  type KodeKelas,
  type PemindaiKamera,
} from '@/contracts';

/** Satu langkah naskah: apa yang dilihat, dan berapa lama bertahan. */
export interface AdeganPindai {
  readonly status: HasilPindai['status'];
  readonly kelas: readonly KodeKelas[];
  readonly durasiMs: number;
  /** 0..1. Di bawah AMBANG_LUMA_GELAP akan memicu senter otomatis. */
  readonly luma?: number;
}

/**
 * Naskah bawaan meniru satu sesi pemindaian yang realistis: ragu sebentar,
 * sempat gagal, baru kemudian mantap. Bukan langsung berhasil.
 */
export const ADEGAN_BAWAAN: readonly AdeganPindai[] = [
  { status: 'tidak-ada-objek', kelas: [], durasiMs: 1200 },
  { status: 'belum-stabil', kelas: [5], durasiMs: 800 },
  // Kondisi temaram: uang terlihat tapi tidak pernah lolos ambang.
  { status: 'abstain', kelas: [5], durasiMs: 1500, luma: 0.15 },
  { status: 'belum-stabil', kelas: [6, 4], durasiMs: 600 },
  { status: 'stabil', kelas: [6, 4, 2], durasiMs: 3000 },
];

/** Naskah Fase 4: uang kembalian berupa kertas plus koin. */
export const ADEGAN_KEMBALIAN: readonly AdeganPindai[] = [
  { status: 'tidak-ada-objek', kelas: [], durasiMs: 800 },
  { status: 'belum-stabil', kelas: [2], durasiMs: 700 },
  { status: 'stabil', kelas: [2, KODE_KELAS_KOIN], durasiMs: 3000 },
];

export interface OpsiMockPemindai {
  readonly adeganFase1?: readonly AdeganPindai[];
  readonly adeganFase4?: readonly AdeganPindai[];
  /** Jeda antar pembaruan, meniru laju bingkai. */
  readonly intervalMs?: number;
}

export function buatMockPemindai(opsi: OpsiMockPemindai = {}): PemindaiKamera {
  const adeganFase1 = opsi.adeganFase1 ?? ADEGAN_BAWAAN;
  const adeganFase4 = opsi.adeganFase4 ?? ADEGAN_KEMBALIAN;
  const intervalMs = opsi.intervalMs ?? 150;

  const pendengar = new Set<(h: HasilPindai) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let senterAktif = false;

  function siarkan(hasil: HasilPindai): void {
    for (const p of pendengar) p(hasil);
  }

  return {
    async mulai(fase: FasePindai) {
      this.berhenti();
      const adegan = fase === 1 ? adeganFase1 : adeganFase4;
      if (adegan.length === 0) return;

      let mulaiAdeganMs = Date.now();
      let indeks = 0;

      timer = setInterval(() => {
        const kini = adegan[indeks % adegan.length];
        if (!kini) return;

        if (Date.now() - mulaiAdeganMs >= kini.durasiMs) {
          indeks += 1;
          mulaiAdeganMs = Date.now();
        }

        const stabil = kini.status === 'stabil';
        const deteksi: readonly Deteksi[] = stabil
          ? kini.kelas.map((kode, i) => buatDeteksi(kode, i))
          : [];

        siarkan({
          status: kini.status,
          deteksi,
          // Kontrak: totalKertas nol kalau bukan 'stabil'.
          totalKertas: deteksi.reduce((jml, d) => jml + (d.nominal ?? 0), 0),
          adaKoin: deteksi.some((d) => d.koin),
          latensiMs: 110 + Math.round(Math.random() * 40),
          fps: 8,
          luma: kini.luma ?? 0.6,
          senterAktif,
        });
      }, intervalMs);
    },

    berhenti() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },

    langgan(p) {
      pendengar.add(p);
      return () => pendengar.delete(p);
    },

    async setSenter(nyala: boolean) {
      senterAktif = nyala;
    },
  };
}

/** Diekspor ulang supaya `ui/` cukup mengimpor dari satu berkas. */
export { NASKAH_BAWAAN };
