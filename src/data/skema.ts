/**
 * Skema basis data lokal.
 *
 * Delapan object store sesuai Lampiran 7 exsum, nama dipertahankan persis
 * supaya dokumen dan kode bisa dibaca berdampingan.
 *
 * Seluruh data tinggal di IndexedDB dalam sandbox aplikasi dan TIDAK PERNAH
 * meninggalkan perangkat. Itu bukan kebetulan melainkan sifat arsitektur: tidak
 * ada satu pun kode jaringan di aplikasi ini, jadi secara struktural tidak ada
 * tempat untuk pergi. Inilah jawaban atas risiko nomor 7 di Lampiran 8.
 */

import type { Kotak, ModeInput, SumberSuara } from '@/contracts';

/** Tabel referensi statis. Diisi sekali saat basis data dibuat. */
export interface BarisDenominasi {
  readonly kodeKelas: number;
  readonly nominal: number | null;
  readonly koin: boolean;
  /** Naskah luaran suara berbahasa Indonesia, untuk penelusuran. */
  readonly naskahSuara: string;
}

/**
 * Bobot model yang sedang terpasang.
 *
 * Setiap hasil deteksi menyimpan `idModel`, sehingga saat ada kesalahan
 * pembacaan nominal kita bisa menelusuri versi mana yang memproduksinya. Tanpa
 * ini, membandingkan dua hasil kalibrasi jadi menebak-nebak.
 */
export interface BarisVersiModel {
  readonly idModel: string;
  readonly ukuranByte: number;
  readonly checksum: string;
  readonly jumlahKelas: number;
  readonly ukuranMasukan: number;
  /** mAP@0.5 pada set validasi. null kalau belum diukur. */
  readonly mAP: number | null;
  readonly dipasangPadaMs: number;
}

/** Rekaman tunggal preferensi pengguna. */
export interface BarisPengaturan {
  /** Selalu bernilai 'tunggal'. Store ini hanya boleh punya satu baris. */
  readonly id: 'tunggal';
  readonly ambangKeyakinan: number;
  readonly ambangIoU: number;
  readonly targetFps: number;
  readonly senterOtomatis: boolean;
  readonly audioDucking: boolean;
  readonly kecepatanUcap: number;
  readonly modeInput: ModeInput;
  readonly sumberSuara: SumberSuara;
}

export type StatusTransaksi = 'selesai' | 'dibatalkan' | 'abstain';

/** Induk satu transaksi utuh Fase 1 sampai 4. */
export interface BarisSesiTransaksi {
  readonly idTransaksi: string;
  readonly mulaiPadaMs: number;
  readonly selesaiPadaMs: number;
  /** Target di exsum: di bawah 15 detik. */
  readonly durasiMs: number;
  readonly totalBelanja: number | null;
  readonly uangDibayar: number | null;
  readonly kembalianWajib: number | null;
  readonly kembalianTerverifikasi: number | null;
  readonly nominalKoin: number | null;
  readonly status: StatusTransaksi;
  readonly idModel: string | null;
}

/** Satu peristiwa pemindaian kamera. */
export interface BarisSesiPemindaian {
  readonly idPemindaian: string;
  readonly idTransaksi: string;
  /** 1 = bidik uang bayar, 4 = cek kembalian. */
  readonly fase: 1 | 4;
  readonly mulaiPadaMs: number;
  readonly durasiMs: number;
  readonly jumlahBingkai: number;
  readonly latensiRerataMs: number;
  readonly latensiMaksMs: number;
  readonly fpsRerata: number;
  readonly lumaRerata: number;
  readonly senterPernahAktif: boolean;
}

/**
 * Status sebuah kotak deteksi setelah melewati rantai penyaringan.
 *
 * Di sinilah Abstain Policy meninggalkan jejak audit: kalau sistem menolak
 * menyebut nominal, alasannya terbaca di sini.
 */
export type StatusDeteksi =
  | 'lolos'
  | 'ditolak-gating'
  | 'ditolak-iou'
  | 'tidak-stabil';

export interface BarisHasilDeteksi {
  readonly idDeteksi: string;
  readonly idPemindaian: string;
  readonly kodeKelas: number;
  readonly nominal: number | null;
  readonly skor: number;
  readonly kotak: Kotak;
  readonly iouMaks: number;
  readonly status: StatusDeteksi;
}

export type JenisKejadian =
  | 'abstain'
  | 'batal'
  | 'senter-otomatis'
  | 'suara-gagal'
  | 'uang-kurang'
  | 'model-gagal-dimuat';

/** Jejak peristiwa non-deteksi. */
export interface BarisLogKejadian {
  readonly idKejadian: string;
  readonly idTransaksi: string | null;
  readonly padaMs: number;
  readonly jenis: JenisKejadian;
  readonly rincian: string;
}

/**
 * Ringkasan harian.
 *
 * Memenuhi kebutuhan tahap Check pada Lampiran 11, yaitu pengukuran 50 kali
 * simulasi transaksi. Dihitung dari store lain, bukan ditulis langsung.
 */
export interface BarisAgregatMetrik {
  /** Tanggal YYYY-MM-DD dalam waktu lokal. */
  readonly idMetrik: string;
  readonly jumlahTransaksi: number;
  readonly jumlahSelesai: number;
  readonly jumlahDibatalkan: number;
  readonly jumlahAbstain: number;
  /** 0..1. Indikator utama kesehatan model di lapangan. */
  readonly rasioAbstain: number;
  readonly latensiRerataMs: number;
  readonly durasiRerataMs: number;
}
