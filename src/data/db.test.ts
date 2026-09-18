/**
 * Tes basis data.
 *
 * Memakai `fake-indexeddb`, sehingga skema dan penulisannya benar-benar
 * dijalankan — bukan diasumsikan. Skema yang salah baru ketahuan saat aplikasi
 * dibuka di HP, dan gejalanya biasanya hanya "riwayat kosong" tanpa pesan apa
 * pun.
 */

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { JUMLAH_KELAS, STATE_AWAL, type Deteksi } from '@/contracts';
import { bacaPengaturan, DbSudepi, siapkanDb, tulisPengaturan } from './db';
import { buatRepositori } from './repositori';
import { buatPenyangga } from './penyangga';

let db: DbSudepi;
let nomor = 0;

beforeEach(async () => {
  // Nama unik per tes supaya keadaannya benar-benar bersih.
  nomor += 1;
  db = new DbSudepi(`sudepi_tes_${nomor}`);
  await db.open();
  await siapkanDb(db);
});

describe('skema', () => {
  it('membuka delapan object store sesuai Lampiran 7', () => {
    const nama = db.tables.map((t) => t.name).sort();
    expect(nama).toEqual([
      'agregat_metrik',
      'denominasi',
      'hasil_deteksi',
      'log_kejadian',
      'pengaturan',
      'sesi_pemindaian',
      'sesi_transaksi',
      'versi_model',
    ]);
  });

  it('mengisi tabel denominasi dengan seluruh kelas', async () => {
    const semua = await db.denominasi.toArray();
    expect(semua).toHaveLength(JUMLAH_KELAS);
  });

  it('menyimpan naskah suara siap ucap, bukan angka mentah', async () => {
    // Supaya saat menelusuri riwayat kita melihat apa yang benar-benar
    // didengar pengguna.
    const limaPuluh = await db.denominasi.get(5);
    expect(limaPuluh?.naskahSuara).toBe('lima puluh ribu rupiah');
  });

  it('bisa disiapkan berkali-kali tanpa menggandakan isi', async () => {
    await siapkanDb(db);
    await siapkanDb(db);
    expect(await db.denominasi.count()).toBe(JUMLAH_KELAS);
  });
});

describe('pengaturan', () => {
  it('terisi nilai bawaan saat pertama dibuat', async () => {
    const p = await bacaPengaturan(db);
    expect(p.ambangKeyakinan).toBe(0.85);
    expect(p.modeInput).toBe('taktil');
  });

  it('menyimpan perubahan sebagian tanpa menghapus sisanya', async () => {
    await tulisPengaturan(db, { ambangKeyakinan: 0.9 });
    const p = await bacaPengaturan(db);
    expect(p.ambangKeyakinan).toBe(0.9);
    expect(p.ambangIoU).toBe(0.4);
  });

  it('TIDAK menimpa preferensi pengguna saat aplikasi dibuka lagi', async () => {
    // Kalau siapkanDb menimpa pengaturan, kalibrasi ambang yang sudah disetel
    // akan hilang setiap aplikasi dijalankan ulang.
    await tulisPengaturan(db, { ambangKeyakinan: 0.95, kecepatanUcap: 1.5 });
    await siapkanDb(db);
    const p = await bacaPengaturan(db);
    expect(p.ambangKeyakinan).toBe(0.95);
    expect(p.kecepatanUcap).toBe(1.5);
  });

  it('hanya pernah ada satu baris pengaturan', async () => {
    await tulisPengaturan(db, { ambangKeyakinan: 0.9 });
    await tulisPengaturan(db, { ambangKeyakinan: 0.88 });
    expect(await db.pengaturan.count()).toBe(1);
  });
});

describe('repositori', () => {
  const deteksi = (kodeKelas: number, nominal: number): Deteksi => ({
    kodeKelas,
    nominal: nominal as never,
    koin: false,
    skor: 0.95,
    kotak: { x: 0, y: 0, w: 0.4, h: 0.2 },
    iouMaks: 0.1,
  });

  it('menyimpan transaksi beserta durasinya', async () => {
    const repo = buatRepositori(db);
    const id = await repo.simpanTransaksi(
      'trx_uji',
      { ...STATE_AWAL, mulaiPadaMs: 1000, totalBelanja: 35_000, kembalianWajib: 15_000 },
      'selesai',
      13_500,
      'model_v1',
    );

    expect(id).toBe('trx_uji');
    const t = await db.sesi_transaksi.get('trx_uji');
    expect(t?.durasiMs).toBe(12_500);
    expect(t?.status).toBe('selesai');
    expect(t?.idModel).toBe('model_v1');
  });

  it('menyimpan pemindaian beserta deteksi finalnya', async () => {
    const repo = buatRepositori(db);
    const p = buatPenyangga();
    p.tambah({
      status: 'stabil',
      deteksi: [deteksi(5, 50_000), deteksi(4, 20_000)],
      totalKertas: 70_000,
      adaKoin: false,
      latensiMs: 130,
      fps: 8,
      luma: 0.5,
      senterAktif: false,
    });

    await repo.simpanPemindaian('trx_1', 1, 1000, 4000, p.ringkas());

    const sesi = await db.sesi_pemindaian.toArray();
    expect(sesi).toHaveLength(1);
    expect(sesi[0]?.fase).toBe(1);
    expect(sesi[0]?.durasiMs).toBe(3000);

    const det = await db.hasil_deteksi.toArray();
    expect(det).toHaveLength(2);
    expect(det.every((d) => d.status === 'lolos')).toBe(true);
  });

  it('TIDAK menulis deteksi kalau tidak pernah stabil', async () => {
    // Inilah aturan buffer-di-memori. Bingkai yang tidak pernah menentukan
    // keputusan tidak boleh membanjiri basis data.
    const repo = buatRepositori(db);
    const p = buatPenyangga();
    for (let i = 0; i < 50; i += 1) {
      p.tambah({
        status: 'abstain',
        deteksi: [],
        totalKertas: 0,
        adaKoin: false,
        latensiMs: 120,
        fps: 8,
        luma: 0.2,
        senterAktif: true,
      });
    }

    await repo.simpanPemindaian('trx_1', 1, 1000, 8000, p.ringkas());

    expect(await db.hasil_deteksi.count()).toBe(0);
    const sesi = await db.sesi_pemindaian.toArray();
    // Sesinya tetap tercatat: justru penting untuk menelusuri kenapa abstain.
    expect(sesi[0]?.jumlahBingkai).toBe(50);
    expect(sesi[0]?.senterPernahAktif).toBe(true);
  });

  it('mencatat kejadian non-deteksi', async () => {
    const repo = buatRepositori(db);
    await repo.catatKejadian('abstain', 'keyakinan di bawah ambang', 5000, 'trx_1');
    await repo.catatKejadian('uang-kurang', 'bayar 20000 belanja 50000', 6000, 'trx_1');

    const log = await db.log_kejadian.toArray();
    expect(log).toHaveLength(2);
    expect(log.map((l) => l.jenis).sort()).toEqual(['abstain', 'uang-kurang']);
  });

  it('menghitung agregat harian dari transaksi yang tersimpan', async () => {
    const repo = buatRepositori(db);
    const kini = new Date(2026, 8, 18, 10, 0).getTime();

    await repo.simpanTransaksi('t1', { ...STATE_AWAL, mulaiPadaMs: kini }, 'selesai', kini + 10_000, null);
    await repo.simpanTransaksi('t2', { ...STATE_AWAL, mulaiPadaMs: kini + 1 }, 'selesai', kini + 14_000, null);
    await repo.simpanTransaksi('t3', { ...STATE_AWAL, mulaiPadaMs: kini + 2 }, 'abstain', kini + 20_000, null);

    await repo.perbaruiAgregat(kini);

    const m = await db.agregat_metrik.get('2026-09-18');
    expect(m?.jumlahTransaksi).toBe(3);
    expect(m?.jumlahAbstain).toBe(1);
    expect(m?.rasioAbstain).toBeCloseTo(1 / 3, 6);
  });

  it('kegagalan penulisan TIDAK menjalar ke pemanggil', async () => {
    // Pengguna sedang berdiri di depan kasir. Basis data penuh tidak boleh
    // menghentikan transaksinya — riwayat tidak dibutuhkan untuk menghitung
    // kembalian.
    const dbTertutup = new DbSudepi(`sudepi_tertutup_${nomor}`);
    dbTertutup.close();
    const repo = buatRepositori(dbTertutup);

    await expect(
      repo.catatKejadian('abstain', 'apa pun', 1000),
    ).resolves.toBeUndefined();
    await expect(
      repo.simpanTransaksi('t_gagal', STATE_AWAL, 'selesai', 1000, null),
    ).resolves.toBeNull();
  });
});
