import { describe, expect, it } from 'vitest';
import { hitungKembalian, nominalSah } from './kembalian';

describe('nominalSah', () => {
  it('menerima bilangan bulat tidak negatif', () => {
    expect(nominalSah(0)).toBe(true);
    expect(nominalSah(1000)).toBe(true);
    expect(nominalSah(100_000)).toBe(true);
  });

  it('menolak negatif, pecahan, NaN, dan tak hingga', () => {
    expect(nominalSah(-1)).toBe(false);
    expect(nominalSah(1000.5)).toBe(false);
    expect(nominalSah(Number.NaN)).toBe(false);
    expect(nominalSah(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('hitungKembalian', () => {
  it('menghitung kembalian yang wajar', () => {
    expect(hitungKembalian(35_000, 50_000)).toEqual({ ok: true, kembalian: 15_000 });
  });

  it('kembalian nol saat uang pas', () => {
    expect(hitungKembalian(50_000, 50_000)).toEqual({ ok: true, kembalian: 0 });
  });

  it('MENOLAK bayar kurang dari belanja', () => {
    // Ditolak di sini, bukan belakangan. Kalau lolos ke Fase 3, pedagang
    // sudah terlanjur melihat angka yang salah di layar yang dibalik.
    expect(hitungKembalian(50_000, 20_000)).toEqual({
      ok: false,
      alasan: 'bayar-kurang',
    });
  });

  it('menolak kurang walau hanya selisih satu rupiah', () => {
    expect(hitungKembalian(50_000, 49_999)).toEqual({
      ok: false,
      alasan: 'bayar-kurang',
    });
  });

  it('menolak nilai yang tidak sah', () => {
    for (const [belanja, bayar] of [
      [-1, 50_000],
      [50_000, -1],
      [1000.5, 50_000],
      [Number.NaN, 50_000],
      [50_000, Number.POSITIVE_INFINITY],
    ] as const) {
      expect(hitungKembalian(belanja, bayar)).toEqual({
        ok: false,
        alasan: 'nilai-tidak-sah',
      });
    }
  });

  it('hasilnya selalu bilangan bulat', () => {
    const hasil = hitungKembalian(33_000, 100_000);
    expect(hasil.ok).toBe(true);
    if (hasil.ok) expect(Number.isInteger(hasil.kembalian)).toBe(true);
  });
});
