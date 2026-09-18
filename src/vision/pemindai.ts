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
  /**
   * RUJUKAN ke elemen video, bukan elemennya langsung.
   *
   * React melepas dan membuat ulang elemen `<video>` setiap kali cabang render
   * di sekelilingnya berganti. Menyimpan elemennya di sini berarti pemindai
   * memegang elemen YATIM begitu itu terjadi: `srcObject` terisi rapi, kamera
   * menyala di tingkat sistem, tidak ada satu pun galat — tetapi gambarnya
   * masuk ke elemen yang sudah tidak ada di halaman.
   *
   * Itu persis yang terjadi pada transaksi KEDUA: layar kalkulator menempati
   * cabang render yang berbeda, sehingga melewatinya sekali saja sudah cukup
   * untuk membuat kamera mati diam-diam sampai aplikasi dibuka ulang.
   *
   * Dengan rujukan, elemennya dicari SAAT DIPAKAI, sehingga selalu yang
   * sedang benar-benar terpasang di halaman.
   */
  readonly videoRef: { readonly current: HTMLVideoElement | null };
  readonly mesin?: MesinOnnx;
  readonly targetFps?: number;
  readonly senterOtomatis?: boolean;
}

export function buatPemindai(opsi: OpsiPemindai): PemindaiKamera {
  const videoRef = opsi.videoRef;
  const mesin = opsi.mesin ?? buatMesinOnnx();
  /**
   * Jeda ISTIRAHAT antar bingkai, bukan periode timer.
   *
   * Versi pertama memakai setInterval dengan jeda 100 ms dan penjaga "sibuk".
   * Karena inferensi memakan sekitar 700 ms, timer menyala tujuh kali selama
   * satu inferensi — semuanya dilewati penjaga — lalu menyala lagi SEKETIKA
   * bingkai sebelumnya selesai. Hasilnya CPU bekerja beruntun tanpa jeda sama
   * sekali, dan HP menjadi panas dalam hitungan menit.
   *
   * Sekarang bingkai berikutnya dijadwalkan SETELAH yang sekarang selesai,
   * dengan jeda nyata di antaranya. Laju bingkai turun sedikit, suhu turun
   * banyak — dan pada 1,4 fps, satu bingkai lebih atau kurang tidak mengubah
   * apa pun yang dirasakan pengguna.
   */
  const jedaMs = Math.max(120, 1000 / (opsi.targetFps ?? FPS_MAKS));
  const senterOtomatis = opsi.senterOtomatis ?? true;

  const pendengar = new Set<(h: HasilPindai) => void>();
  let aliran: MediaStream | null = null;
  let jalan = false;
  let senterAktif = false;
  let sibuk = false;

  /** Jendela bingkai untuk voting temporal. */
  let jendela: (readonly Deteksi[])[] = [];
  /**
   * Jendela sejajar berisi kotak tingkat kedua. Dipakai HANYA untuk meneruskan
   * lembar yang sudah lahir dari bukti kuat, tidak pernah untuk melahirkannya.
   */
  let jendelaLemah: (readonly Deteksi[])[] = [];
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
    const video = videoRef.current;
    if (!jalan || sibuk || !video || video.readyState < 2) return;
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
      jendelaLemah.push(hasil.lemah);
      if (jendela.length > VOTING_DARI) {
        jendela = jendela.slice(-VOTING_DARI);
        jendelaLemah = jendelaLemah.slice(-VOTING_DARI);
      }

      beruntunRagu =
        hasil.deteksi.length === 0 && hasil.ditolakGating > 0 ? beruntunRagu + 1 : 0;

      const voting = votingTemporal(jendela, undefined, undefined, jendelaLemah);

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
      // Satu bingkai gagal bukan alasan menghentikan pemindaian. Penjadwalan
      // berikutnya tetap berjalan lewat blok finally di `jadwalkan`.
    } finally {
      sibuk = false;
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let lepasVisibilitas: (() => void) | null = null;
  let kunciLayar: WakeLockSentinel | null = null;

  /**
   * Menahan layar tetap menyala selama memindai.
   *
   * Tanpa ini, Android meredupkan lalu mematikan layar setelah beberapa detik
   * tanpa sentuhan — dan memindai uang justru berarti TIDAK menyentuh layar,
   * karena kedua tangan sedang memegang uang di depan kamera.
   *
   * Saat layar mati, kamera ikut berhenti dan aplikasi mendadak senyap.
   * Pengguna yang tidak bisa melihat layar tidak punya cara mengetahui
   * penyebabnya; yang ia tahu hanya sistemnya berhenti menjawab.
   */
  async function ambilKunciLayar(): Promise<void> {
    try {
      kunciLayar = await navigator.wakeLock?.request('screen') ?? null;
    } catch {
      // Sebagian perangkat menolak, misalnya saat baterai kritis. Bukan alasan
      // membatalkan pemindaian — hanya berarti layarnya bisa mati sendiri.
      kunciLayar = null;
    }
  }

  function lepasKunciLayar(): void {
    void kunciLayar?.release().catch(() => {});
    kunciLayar = null;
  }

  /** Menjadwalkan bingkai berikutnya setelah yang sekarang benar-benar usai. */
  function jadwalkan(): void {
    if (!jalan) return;
    timer = setTimeout(() => {
      void prosesBingkai().finally(jadwalkan);
    }, jedaMs);
  }

  /** Membereskan seluruh sumber daya. Aman dipanggil berulang. */
  function hentikan(): void {
    jalan = false;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lepasVisibilitas?.();
    lepasVisibilitas = null;
    lepasKunciLayar();
    if (senterAktif) void setSenterInternal(false);
    for (const jalur of aliran?.getTracks() ?? []) jalur.stop();
    aliran = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  /** Badan sebenarnya dari `mulai`, dipisah agar kegagalannya bisa dicatat. */
  async function mulaiInternal(): Promise<void> {
    hentikan();
    jendela = [];
    jendelaLemah = [];
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
    const video = videoRef.current;
    if (!video) {
      // Tidak ada elemen video yang terpasang. Alirannya dilepas kembali
      // supaya lampu kamera tidak menyala tanpa ada yang menontonnya.
      for (const jalur of aliran.getTracks()) jalur.stop();
      aliran = null;
      throw new Error('Elemen video belum terpasang saat pemindaian dimulai');
    }
    video.srcObject = aliran;

    // `play()` DITOLAK, bukan sekadar gagal, ketika pemutaran sebelumnya
    // baru saja dibatalkan — dan itu persis yang terjadi pada pemindaian
    // KEDUA, karena `berhenti()` mengosongkan `srcObject` beberapa milidetik
    // sebelumnya. Penolakan itu bernama AbortError dan tidak berbahaya:
    // videonya tetap berjalan.
    //
    // Sebelumnya penolakan tersebut melempar ke luar dan membatalkan sisa
    // fungsi ini, sehingga `jalan` tidak pernah menjadi true dan bingkai
    // tidak pernah dijadwalkan. Akibatnya kamera hidup sekali saja per
    // pembukaan aplikasi: transaksi pertama berhasil, transaksi kedua
    // menatap layar mati tanpa satu pun pesan galat.
    try {
      await video.play();
    } catch (galat) {
      console.warn('[KAMERA] play() ditolak, pemindaian tetap dilanjutkan', galat);
    }

    await mesin.siap();

    jalan = true;
    jadwalkan();
    void ambilKunciLayar();

    // Berhenti memindai saat aplikasi ditinggalkan.
    //
    // Tanpa ini, kamera dan inferensi terus berjalan di latar belakang:
    // baterai terkuras dan HP memanas tanpa ada yang menyadarinya — dan
    // pengguna yang tidak bisa melihat layar paling tidak mungkin menyadari.
    const padaVisibilitas = (): void => {
      if (document.hidden) {
        jalan = false;
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        if (senterAktif) void setSenterInternal(false);
        lepasKunciLayar();
      } else if (!jalan) {
        jalan = true;
        jadwalkan();
        // Kunci layar HILANG SENDIRI saat aplikasi ditinggalkan, jadi ia
        // harus diambil ulang, bukan sekadar dianggap masih dipegang.
        void ambilKunciLayar();
      }
    };
    document.addEventListener('visibilitychange', padaVisibilitas);
    lepasVisibilitas = () => {
      document.removeEventListener('visibilitychange', padaVisibilitas);
    };
  }

  return {
    async mulai(fase: FasePindai) {
      // Kegagalan memulai kamera TIDAK BOLEH senyap. Pemanggilnya memakai
      // `void`, jadi apa pun yang dilempar dari sini lenyap tanpa jejak — dan
      // bagi pengguna yang tidak bisa melihat layar, kamera mati terlihat
      // sama persis dengan kamera yang belum menemukan uang.
      try {
        await mulaiInternal();
      } catch (galat) {
        console.error('[KAMERA] gagal memulai pemindaian fase', fase, galat);
        throw galat;
      }
    },

    berhenti: hentikan,

    langgan(p) {
      pendengar.add(p);
      return () => pendengar.delete(p);
    },

    setSenter: setSenterInternal,
  };
}
