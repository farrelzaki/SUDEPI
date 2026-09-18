/**
 * Kontrak lapisan penglihatan.
 *
 * Aturan yang mengikat seluruh implementasi di bawah antarmuka ini:
 * pemanggil TIDAK PERNAH perlu menyaring ulang. Kalau `HasilPindai.status`
 * bernilai 'stabil', isi `deteksi` sudah lolos confidence gating, NMS, dan
 * voting temporal. Kalau bukan 'stabil', `deteksi` kosong dan `totalKertas`
 * bernilai 0.
 *
 * Ini disengaja: supaya mustahil ada kode di `ui/` atau `core/` yang secara
 * tidak sengaja membaca hasil mentah lalu menyebut nominal yang belum diyakini.
 */

import type { KodeKelas, Nominal } from './uang';

/** Ternormalisasi 0..1 terhadap bingkai asli, bukan piksel. */
export interface Kotak {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Deteksi {
  readonly kodeKelas: KodeKelas;
  /** null kalau koin. */
  readonly nominal: Nominal | null;
  readonly koin: boolean;
  /** 0..1. Dijamin >= AMBANG_KEYAKINAN saat sampai ke pemanggil. */
  readonly skor: number;
  readonly kotak: Kotak;
  /** IoU tertinggi terhadap kotak lain sebelum NMS. Untuk jejak audit. */
  readonly iouMaks: number;
}

export type StatusPindai =
  /** Bingkai kosong. Belum perlu bicara. */
  | 'tidak-ada-objek'
  /** Ada deteksi, voting temporal belum lolos. Jangan bicara dulu. */
  | 'belum-stabil'
  /** Boleh diucapkan. */
  | 'stabil'
  /** Ada objek tapi tidak pernah lolos ambang. Minta pindai ulang. */
  | 'abstain';

export interface HasilPindai {
  readonly status: StatusPindai;
  /** Hanya berisi hasil final saat status === 'stabil'. Selain itu kosong. */
  readonly deteksi: readonly Deteksi[];
  /** Jumlah seluruh uang kertas dalam Rupiah. 0 kalau bukan 'stabil'. */
  readonly totalKertas: number;
  readonly adaKoin: boolean;
  readonly latensiMs: number;
  readonly fps: number;
  /** Kecerahan rata-rata 0..1. Dipakai memicu senter otomatis. */
  readonly luma: number;
  readonly senterAktif: boolean;
}

/** Lapisan terbawah: satu bingkai masuk, kotak keluar. Tanpa state. */
export interface MesinInferensi {
  siap(): Promise<void>;
  /** Sudah menerapkan NMS dan confidence gating. Belum voting temporal. */
  deteksi(bingkai: ImageBitmap): Promise<readonly Deteksi[]>;
  tutup(): void;
}

/** Fase pemindaian: 1 = bidik uang bayar, 4 = cek kembalian. */
export type FasePindai = 1 | 4;

/** Lapisan atas: mengelola kamera, laju bingkai, senter, dan voting temporal. */
export interface PemindaiKamera {
  mulai(fase: FasePindai): Promise<void>;
  berhenti(): void;
  /** Mengembalikan fungsi untuk berhenti berlangganan. */
  langgan(pendengar: (hasil: HasilPindai) => void): () => void;
  setSenter(nyala: boolean): Promise<void>;
}

/* ---------------------------------------------------------------------------
 * Tetapan bersama.
 *
 * Angka-angka ini HANYA boleh hidup di sini. Jangan pernah menulis 0.85
 * sebagai literal di tempat lain — saat kalibrasi dengan uang lecek nanti,
 * kita harus bisa mengubahnya di satu tempat.
 * ------------------------------------------------------------------------- */

export const AMBANG_KEYAKINAN = 0.70;
export const AMBANG_IOU = 0.4;

/** Deteksi yang sama harus muncul di VOTING_BUTUH dari VOTING_DARI bingkai. */
export const VOTING_BUTUH = 3;
export const VOTING_DARI = 5;

/**
 * Di atas nilai IoU ini, lembaran dianggap terlalu berdempetan dan pengguna
 * diminta merenggangkannya. Mitigasi risiko nomor 2 pada Lampiran 8.
 *
 * Sengaja LEBIH RENDAH dari AMBANG_IOU. Pada rentang antara keduanya, kedua
 * kotak masih lolos NMS — jadi jumlahnya kemungkinan benar, tetapi sudah
 * mendekati ambang penyaringan dan satu gerakan tangan bisa membuat salah
 * satunya hilang. Di atas AMBANG_IOU, salah satu kotak memang sudah disaring,
 * dan muncul pertanyaan yang tidak bisa dijawab dari satu bingkai: tadi itu
 * satu lembar yang terbaca dua kali, atau dua lembar yang bertumpuk?
 *
 * Sistem tidak bisa menjawabnya, dan tidak boleh menebak. Tapi pengguna bisa
 * menyelesaikannya dalam satu detik — cukup renggangkan lembarannya. Karena
 * itu peringatan ini berguna pada KEDUA keadaan.
 */
export const AMBANG_BERDEMPETAN = 0.25;

/** Sisi masukan model. Lihat ADR-0001 soal kenapa 320, bukan 640. */
export const UKURAN_MASUKAN = 320;

/** Laju pemindaian adaptif. */
export const FPS_MIN = 5;
export const FPS_MAKS = 10;

/** Di bawah nilai luma ini, senter otomatis dinyalakan. */
export const AMBANG_LUMA_GELAP = 0.25;
