/**
 * Pemindai kamera.
 *
 * Menyatukan seluruh rantai: kamera -> bingkai -> worker -> voting temporal ->
 * `HasilPindai`. Ini satu-satunya berkas di `vision/` yang menyentuh dunia
 * nyata; sisanya fungsi murni.
 *
 * Ia memenuhi kontrak penting dari `contracts/vision.ts`: pemanggil tidak
 * pernah perlu menyaring ulang. Kalau status bukan 'stabil', `deteksi` kosong
 * dan `totalKertas` bernilai 0. Mustahil ada kode di `ui/` atau `core/` yang
 * tidak sengaja menyebut nominal yang belum diyakini.
 */

import {
  AMBANG_LUMA_GELAP,
  FPS_MAKS,
  VOTING_DARI,
  type Deteksi,
  type FasePindai,
  type HasilPindai,
  type PemindaiKamera,
  type StatusPindai,
} from '@/contracts';
import { buatMesinOnnx, type MesinOnnx } from './mesinOnnx';
import { votingTemporal } from './voting';

export interface OpsiPemindai {
  readonly video: HTMLVideoElement;
  readonly mesin?: MesinOnnx;
  readonly targetFps?: number;
  readonly senterOtomatis?: boolean;
}

export function buatPemindai(opsi: OpsiPemindai): PemindaiKamera {
  const { video } = opsi;
  const mesin = opsi.mesin ?? buatMesinOnnx();
  const jedaMs = 1000 / (opsi.targetFps ?? FPS_MAKS);
  const senterOtomatis = opsi.senterOtomatis ?? true;

  const pendengar = new Set<(h: HasilPindai) => void>();
  let aliran: MediaStream | null = null;
  let jalan = false;
  let senterAktif = false;
  let sibuk = false;

  /** Jendela bingkai untuk voting temporal. */
  let jendela: (readonly Deteksi[])[] = [];
  /** Berapa bingkai terakhir yang melihat objek tapi gagal lolos ambang. */
  let beruntunRagu = 0;
  let waktuBingkaiTerakhir = 0;
  let fpsTerukur = 0;

  function siarkan(h: HasilPindai): void {
    for (const p of pendengar) p(h);
  }

  /**
   * Kecerahan rata-rata bingkai, 0..1.
   *
   * Dihitung dari petak kecil 32x32, bukan bingkai penuh — cukup untuk
   * memutuskan senter, dan biayanya mendekati nol. Memakai bingkai penuh pada
   * 10 fps akan terasa di HP kelas bawah.
   */
  function hitungLuma(sumber: CanvasImageSource): number {
    const k = kanvasLuma();
    const ctx = k.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 1;
    ctx.drawImage(sumber, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);
    let jumlah = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Luma BT.601 — pembobotan yang sesuai persepsi mata.
      jumlah +=
        0.299 * (data[i] ?? 0) +
        0.587 * (data[i + 1] ?? 0) +
        0.114 * (data[i + 2] ?? 0);
    }
    return jumlah / (32 * 32) / 255;
  }

  let _kanvasLuma: OffscreenCanvas | null = null;
  function kanvasLuma(): OffscreenCanvas {
    _kanvasLuma ??= new OffscreenCanvas(32, 32);
    return _kanvasLuma;
  }

  async function setSenterInternal(nyala: boolean): Promise<void> {
    const jalur = aliran?.getVideoTracks()[0];
    if (!jalur) return;
    try {
      // Torch lewat Web API langsung, tanpa plugin Capacitor. Satu risiko
      // build Gradle lebih sedikit.
      await jalur.applyConstraints({
        advanced: [{ torch: nyala } as MediaTrackConstraintSet],
      });
      senterAktif = nyala;
    } catch {
      // Sebagian perangkat tidak mendukung torch. Bukan alasan menghentikan
      // pemindaian — sistem cukup lebih sering abstain di tempat gelap.
      senterAktif = false;
    }
  }

  async function prosesBingkai(): Promise<void> {
    if (!jalan || sibuk || video.readyState < 2) return;
    sibuk = true;

    try {
      const luma = hitungLuma(video);
      if (senterOtomatis) {
        if (luma < AMBANG_LUMA_GELAP && !senterAktif) await setSenterInternal(true);
        else if (luma > AMBANG_LUMA_GELAP * 2 && senterAktif) {
          await setSenterInternal(false);
        }
      }

      const bingkai = await createImageBitmap(video);
      const hasil = await mesin.deteksiRinci(bingkai);

      const kini = performance.now();
      if (waktuBingkaiTerakhir > 0) {
        fpsTerukur = 1000 / Math.max(1, kini - waktuBingkaiTerakhir);
      }
      waktuBingkaiTerakhir = kini;

      jendela.push(hasil.deteksi);
      if (jendela.length > VOTING_DARI) jendela = jendela.slice(-VOTING_DARI);

      beruntunRagu =
        hasil.deteksi.length === 0 && hasil.ditolakGating > 0 ? beruntunRagu + 1 : 0;

      const voting = votingTemporal(jendela);

      // Abstain menang atas 'tidak-ada-objek'. Kalau beberapa bingkai
      // berturut-turut melihat sesuatu tapi tidak pernah yakin, pengguna perlu
      // diberi tahu — bukan dibiarkan dalam keheningan sambil mengira
      // kameranya belum mengarah ke uang.
      const status: StatusPindai =
        voting.status === 'tidak-ada-objek' && beruntunRagu >= VOTING_DARI
          ? 'abstain'
          : voting.status;

      const stabil = status === 'stabil';
      siarkan({
        status,
        deteksi: stabil ? voting.deteksi : [],
        totalKertas: stabil
          ? voting.deteksi.reduce((j, d) => j + (d.nominal ?? 0), 0)
          : 0,
        adaKoin: stabil ? voting.deteksi.some((d) => d.koin) : false,
        latensiMs: hasil.latensiMs,
        fps: fpsTerukur,
        luma,
        senterAktif,
      });
    } catch {
      // Satu bingkai gagal bukan alasan menghentikan pemindaian. Bingkai
      // berikutnya datang 100 ms lagi.
    } finally {
      sibuk = false;
    }
  }

  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    async mulai(_fase: FasePindai) {
      this.berhenti();
      jendela = [];
      beruntunRagu = 0;
      waktuBingkaiTerakhir = 0;

      aliran = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.srcObject = aliran;
      await video.play();

      await mesin.siap();

      jalan = true;
      timer = setInterval(() => void prosesBingkai(), jedaMs);
    },

    berhenti() {
      jalan = false;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      if (senterAktif) void setSenterInternal(false);
      for (const jalur of aliran?.getTracks() ?? []) jalur.stop();
      aliran = null;
      video.srcObject = null;
    },

    langgan(p) {
      pendengar.add(p);
      return () => pendengar.delete(p);
    },

    setSenter: setSenterInternal,
  };
}
