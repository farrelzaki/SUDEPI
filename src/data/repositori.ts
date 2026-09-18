/**
 * Penulisan riwayat transaksi.
 *
 * Satu-satunya tempat yang menulis ke basis data. Aturan pentingnya ada di
 * `penyangga.ts`: kumpulkan di memori selama memindai, tulis SEKALI saat fase
 * berakhir.
 *
 * Seluruh penulisan dibungkus agar kegagalannya tidak pernah menjalar ke
 * pengguna. Riwayat transaksi berguna untuk kalibrasi dan untuk Lampiran 11,
 * tetapi ia bukan bagian dari tugas utama aplikasi. Kalau IndexedDB penuh atau
 * rusak, pengguna tetap harus bisa menghitung kembaliannya.
 */

import type { StateTransaksi } from '@/contracts';
import type { DbSudepi } from './db';
import { kunciTanggal, ringkasHarian, type RingkasanPindai } from './penyangga';
import type {
  BarisHasilDeteksi,
  JenisKejadian,
  StatusTransaksi,
} from './skema';

/** Id acak pendek. Tidak perlu kriptografis — ini hanya kunci lokal. */
function idBaru(awalan: string): string {
  return `${awalan}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface Repositori {
  simpanTransaksi(
    state: StateTransaksi,
    status: StatusTransaksi,
    selesaiPadaMs: number,
    idModel: string | null,
  ): Promise<string | null>;

  simpanPemindaian(
    idTransaksi: string,
    fase: 1 | 4,
    mulaiPadaMs: number,
    selesaiPadaMs: number,
    ringkasan: RingkasanPindai,
  ): Promise<void>;

  catatKejadian(
    jenis: JenisKejadian,
    rincian: string,
    padaMs: number,
    idTransaksi?: string | null,
  ): Promise<void>;

  perbaruiAgregat(padaMs: number): Promise<void>;
}

export function buatRepositori(db: DbSudepi): Repositori {
  /**
   * Menelan kegagalan penulisan.
   *
   * Disengaja, dan bukan kemalasan: aplikasi ini dipakai orang yang sedang
   * berdiri di depan kasir. Melemparkan error karena basis data penuh akan
   * menghentikan transaksinya di tengah jalan, padahal riwayat sama sekali
   * tidak dibutuhkan untuk menyelesaikan transaksi itu.
   */
  async function aman<T>(kerja: () => Promise<T>): Promise<T | null> {
    try {
      return await kerja();
    } catch {
      return null;
    }
  }

  return {
    async simpanTransaksi(state, status, selesaiPadaMs, idModel) {
      return aman(async () => {
        const idTransaksi = idBaru('trx');
        await db.sesi_transaksi.put({
          idTransaksi,
          mulaiPadaMs: state.mulaiPadaMs,
          selesaiPadaMs,
          durasiMs: Math.max(0, selesaiPadaMs - state.mulaiPadaMs),
          totalBelanja: state.totalBelanja,
          uangDibayar: state.uangDibayar,
          kembalianWajib: state.kembalianWajib,
          kembalianTerverifikasi: state.kembalianTerverifikasi,
          nominalKoin: state.nominalKoin,
          status,
          idModel,
        });
        return idTransaksi;
      });
    },

    async simpanPemindaian(idTransaksi, fase, mulaiPadaMs, selesaiPadaMs, r) {
      await aman(async () => {
        const idPemindaian = idBaru('pnd');

        // Satu transaksi Dexie untuk keduanya: kalau deteksinya gagal ditulis,
        // sesi pemindaiannya ikut batal. Sesi tanpa deteksi akan terbaca
        // seolah tidak ada yang terlihat sama sekali, dan itu menyesatkan saat
        // menelusuri kenapa sistem abstain.
        await db.transaction('rw', db.sesi_pemindaian, db.hasil_deteksi, async () => {
          await db.sesi_pemindaian.put({
            idPemindaian,
            idTransaksi,
            fase,
            mulaiPadaMs,
            durasiMs: Math.max(0, selesaiPadaMs - mulaiPadaMs),
            jumlahBingkai: r.jumlahBingkai,
            latensiRerataMs: r.latensiRerataMs,
            latensiMaksMs: r.latensiMaksMs,
            fpsRerata: r.fpsRerata,
            lumaRerata: r.lumaRerata,
            senterPernahAktif: r.senterPernahAktif,
          });

          // Hanya deteksi yang ikut menentukan keputusan. Menulis seluruh
          // bingkai akan membanjiri basis data tanpa menambah satu pun
          // informasi yang berguna.
          const baris: BarisHasilDeteksi[] = r.deteksiFinal.map((d) => ({
            idDeteksi: idBaru('det'),
            idPemindaian,
            kodeKelas: d.kodeKelas,
            nominal: d.nominal,
            skor: d.skor,
            kotak: d.kotak,
            iouMaks: d.iouMaks,
            status: 'lolos',
          }));
          if (baris.length > 0) await db.hasil_deteksi.bulkPut(baris);
        });
      });
    },

    async catatKejadian(jenis, rincian, padaMs, idTransaksi = null) {
      await aman(() =>
        db.log_kejadian.put({
          idKejadian: idBaru('kjd'),
          idTransaksi,
          padaMs,
          jenis,
          rincian,
        }),
      );
    },

    async perbaruiAgregat(padaMs) {
      await aman(async () => {
        const idMetrik = kunciTanggal(padaMs);
        const awal = new Date(padaMs);
        awal.setHours(0, 0, 0, 0);
        const akhir = awal.getTime() + 24 * 60 * 60 * 1000;

        const transaksi = await db.sesi_transaksi
          .where('mulaiPadaMs')
          .between(awal.getTime(), akhir, true, false)
          .toArray();

        const r = ringkasHarian(transaksi);

        const pemindaian = await db.sesi_pemindaian.toArray();
        const latensiRerataMs =
          pemindaian.length === 0
            ? 0
            : pemindaian.reduce((j, p) => j + p.latensiRerataMs, 0) /
              pemindaian.length;

        await db.agregat_metrik.put({ idMetrik, ...r, latensiRerataMs });
      });
    },
  };
}
