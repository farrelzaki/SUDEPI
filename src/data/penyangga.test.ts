import { describe, expect, it } from 'vitest';
import type { Deteksi, HasilPindai } from '@/contracts';
import { buatPenyangga, kunciTanggal, ringkasHarian } from './penyangga';

function deteksi(kodeKelas: number, nominal: number): Deteksi {
  return {
    kodeKelas,
    nominal: nominal as never,
    koin: false,
    skor: 0.95,
    kotak: { x: 0, y: 0, w: 0.4, h: 0.2 },
    iouMaks: 0,
  };
}

function pindai(
  status: HasilPindai['status'],
  opsi: Partial<HasilPindai> = {},
): HasilPindai {
  return {
    status,
    deteksi: [],
    totalKertas: 0,
    adaKoin: false,
    latensiMs: 120,
    fps: 8,
    luma: 0.6,
    senterAktif: false,
    ...opsi,
  };
}

describe('penyangga pemindaian', () => {
  it('merata-ratakan metrik antar bingkai', () => {
    const p = buatPenyangga();
    p.tambah(pindai('tidak-ada-objek', { latensiMs: 100, fps: 10, luma: 0.4 }));
    p.tambah(pindai('tidak-ada-objek', { latensiMs: 200, fps: 6, luma: 0.8 }));

    const r = p.ringkas();
    expect(r.jumlahBingkai).toBe(2);
    expect(r.latensiRerataMs).toBe(150);
    expect(r.latensiMaksMs).toBe(200);
    expect(r.fpsRerata).toBe(8);
    expect(r.lumaRerata).toBeCloseTo(0.6, 6);
  });

  it('mengingat latensi TERBURUK, bukan hanya rata-rata', () => {
    // Rata-rata bisa menyembunyikan lonjakan yang justru dirasakan pengguna
    // sebagai tersendat. Saat kalibrasi, angka inilah yang penting.
    const p = buatPenyangga();
    p.tambah(pindai('stabil', { latensiMs: 110 }));
    p.tambah(pindai('stabil', { latensiMs: 480 }));
    p.tambah(pindai('stabil', { latensiMs: 120 }));
    expect(p.ringkas().latensiMaksMs).toBe(480);
  });

  it('menghitung berapa bingkai berakhir abstain', () => {
    const p = buatPenyangga();
    p.tambah(pindai('abstain'));
    p.tambah(pindai('belum-stabil'));
    p.tambah(pindai('abstain'));
    p.tambah(pindai('stabil'));
    expect(p.ringkas().jumlahAbstain).toBe(2);
  });

  it('menyimpan deteksi dari bingkai stabil TERAKHIR', () => {
    // Pengguna mungkin menambah lembaran di tengah pemindaian. Yang benar
    // adalah apa yang terakhir dilihat sistem, bukan yang pertama.
    const p = buatPenyangga();
    p.tambah(pindai('stabil', { deteksi: [deteksi(5, 50_000)] }));
    p.tambah(pindai('belum-stabil'));
    p.tambah(pindai('stabil', { deteksi: [deteksi(5, 50_000), deteksi(4, 20_000)] }));

    const r = p.ringkas();
    expect(r.deteksiFinal).toHaveLength(2);
    expect(r.pernahStabil).toBe(true);
  });

  it('bingkai tidak stabil tidak menghapus deteksi final', () => {
    const p = buatPenyangga();
    p.tambah(pindai('stabil', { deteksi: [deteksi(5, 50_000)] }));
    p.tambah(pindai('abstain'));
    p.tambah(pindai('tidak-ada-objek'));
    expect(p.ringkas().deteksiFinal).toHaveLength(1);
  });

  it('tidak pernah stabil berarti tidak ada deteksi final', () => {
    const p = buatPenyangga();
    p.tambah(pindai('abstain'));
    p.tambah(pindai('belum-stabil'));

    const r = p.ringkas();
    expect(r.pernahStabil).toBe(false);
    expect(r.deteksiFinal).toEqual([]);
  });

  it('mencatat kalau senter pernah menyala sekalipun sekali', () => {
    const p = buatPenyangga();
    p.tambah(pindai('tidak-ada-objek', { senterAktif: false }));
    p.tambah(pindai('tidak-ada-objek', { senterAktif: true }));
    p.tambah(pindai('tidak-ada-objek', { senterAktif: false }));
    expect(p.ringkas().senterPernahAktif).toBe(true);
  });

  it('penyangga kosong tidak menghasilkan NaN', () => {
    // Pembagian dengan nol di sini akan menulis NaN ke basis data dan merusak
    // seluruh ringkasan harian tanpa pesan galat.
    const r = buatPenyangga().ringkas();
    expect(r.latensiRerataMs).toBe(0);
    expect(r.fpsRerata).toBe(0);
    expect(r.lumaRerata).toBe(0);
    expect(Number.isNaN(r.latensiRerataMs)).toBe(false);
  });

  it('kosongkan mengembalikan ke keadaan awal', () => {
    const p = buatPenyangga();
    p.tambah(pindai('stabil', { deteksi: [deteksi(5, 50_000)] }));
    p.kosongkan();
    expect(p.ringkas().jumlahBingkai).toBe(0);
    expect(p.ringkas().deteksiFinal).toEqual([]);
  });
});

describe('ringkasHarian', () => {
  const t = (status: 'selesai' | 'dibatalkan' | 'abstain', durasiMs: number) => ({
    status,
    durasiMs,
  });

  it('menghitung rasio abstain', () => {
    // Angka terpenting di seluruh basis data: seberapa sering sistem menolak
    // menjawab. Itulah indikator paling jujur apakah model bekerja di lapangan
    // atau hanya di set validasi.
    const r = ringkasHarian([
      t('selesai', 12_000),
      t('selesai', 10_000),
      t('abstain', 20_000),
      t('dibatalkan', 5000),
    ]);
    expect(r.jumlahTransaksi).toBe(4);
    expect(r.jumlahSelesai).toBe(2);
    expect(r.jumlahAbstain).toBe(1);
    expect(r.jumlahDibatalkan).toBe(1);
    expect(r.rasioAbstain).toBe(0.25);
  });

  it('menghitung durasi rata-rata', () => {
    const r = ringkasHarian([t('selesai', 10_000), t('selesai', 20_000)]);
    expect(r.durasiRerataMs).toBe(15_000);
  });

  it('hari tanpa transaksi tidak menghasilkan NaN', () => {
    const r = ringkasHarian([]);
    expect(r.rasioAbstain).toBe(0);
    expect(r.durasiRerataMs).toBe(0);
  });
});

describe('kunciTanggal', () => {
  it('memakai waktu lokal, bukan UTC', () => {
    // Pedagang dan pengguna hidup di waktu lokal. Ringkasan "hari ini" yang
    // memakai UTC akan memotong hari di tengah sore bagi pengguna Indonesia.
    const d = new Date(2026, 8, 18, 23, 30);
    expect(kunciTanggal(d.getTime())).toBe('2026-09-18');
  });

  it('memberi nol di depan untuk bulan dan tanggal satu digit', () => {
    const d = new Date(2026, 0, 5, 12, 0);
    expect(kunciTanggal(d.getTime())).toBe('2026-01-05');
  });
});
