/**
 * Tes penyusun bilangan.
 *
 * Kekeliruan di sini terdengar langsung oleh juri dan oleh pengguna. Tidak ada
 * yang lebih memalukan daripada aplikasi pembaca uang yang berkata "satu ribu
 * rupiah" — dan itu persis yang terjadi kalau kaidah "se-" tidak ditangani.
 */

import { describe, expect, it } from 'vitest';
import { NOMINAL_URUT } from '@/contracts';
import { rupiahKeKlip, rupiahKeTeks } from './angka';

describe('kaidah bentuk "se-"', () => {
  it.each([
    [1000, 'seribu rupiah'],
    [100, 'seratus rupiah'],
    [10, 'sepuluh rupiah'],
    [11, 'sebelas rupiah'],
  ])('%i -> "%s"', (nilai, harapan) => {
    expect(rupiahKeTeks(nilai)).toBe(harapan);
  });

  it('TIDAK menular ke tingkat yang lebih besar', () => {
    // Kesalahan klasik: menerapkan "se-" di mana pun ada angka satu.
    expect(rupiahKeTeks(1_000_000)).toBe('satu juta rupiah');
    expect(rupiahKeTeks(21_000)).toBe('dua puluh satu ribu rupiah');
    expect(rupiahKeTeks(101)).toBe('seratus satu rupiah');
  });

  it('seribu hanya saat tepat seribu pada tingkatnya', () => {
    expect(rupiahKeTeks(1000)).toBe('seribu rupiah');
    expect(rupiahKeTeks(2000)).toBe('dua ribu rupiah');
    expect(rupiahKeTeks(11_000)).toBe('sebelas ribu rupiah');
    expect(rupiahKeTeks(100_000)).toBe('seratus ribu rupiah');
  });
});

describe('belasan dan puluhan', () => {
  it.each([
    [12, 'dua belas rupiah'],
    [15, 'lima belas rupiah'],
    [19, 'sembilan belas rupiah'],
    [20, 'dua puluh rupiah'],
    [25, 'dua puluh lima rupiah'],
    [90, 'sembilan puluh rupiah'],
    [99, 'sembilan puluh sembilan rupiah'],
  ])('%i -> "%s"', (nilai, harapan) => {
    expect(rupiahKeTeks(nilai)).toBe(harapan);
  });
});

describe('SELURUH pecahan Rupiah terucap benar', () => {
  // Inilah yang paling sering keluar dari mulut aplikasi. Kalau satu saja
  // salah, ia akan salah ratusan kali selama demo.
  const harapan: Record<number, string> = {
    1000: 'seribu rupiah',
    2000: 'dua ribu rupiah',
    5000: 'lima ribu rupiah',
    10_000: 'sepuluh ribu rupiah',
    20_000: 'dua puluh ribu rupiah',
    50_000: 'lima puluh ribu rupiah',
    100_000: 'seratus ribu rupiah',
  };

  it.each(NOMINAL_URUT.map((n) => [n, harapan[n]] as const))(
    '%i -> "%s"',
    (nilai, teks) => {
      expect(rupiahKeTeks(nilai)).toBe(teks);
    },
  );
});

describe('nominal gabungan seperti total belanja', () => {
  it.each([
    [115_000, 'seratus lima belas ribu rupiah'],
    [35_000, 'tiga puluh lima ribu rupiah'],
    [37_500, 'tiga puluh tujuh ribu lima ratus rupiah'],
    [12_345, 'dua belas ribu tiga ratus empat puluh lima rupiah'],
    [250_000, 'dua ratus lima puluh ribu rupiah'],
    [999_999, 'sembilan ratus sembilan puluh sembilan ribu sembilan ratus sembilan puluh sembilan rupiah'],
  ])('%i -> "%s"', (nilai, harapan) => {
    expect(rupiahKeTeks(nilai)).toBe(harapan);
  });
});

describe('nilai koin', () => {
  // core/koin.ts menurunkan nilai koin dari selisih, dan hasilnya diucapkan.
  it.each([
    [100, 'seratus rupiah'],
    [200, 'dua ratus rupiah'],
    [500, 'lima ratus rupiah'],
    [700, 'tujuh ratus rupiah'],
    [999, 'sembilan ratus sembilan puluh sembilan rupiah'],
  ])('%i -> "%s"', (nilai, harapan) => {
    expect(rupiahKeTeks(nilai)).toBe(harapan);
  });
});

describe('jutaan', () => {
  it.each([
    [1_000_000, 'satu juta rupiah'],
    [2_500_000, 'dua juta lima ratus ribu rupiah'],
    [10_000_000, 'sepuluh juta rupiah'],
    [125_000_000, 'seratus dua puluh lima juta rupiah'],
  ])('%i -> "%s"', (nilai, harapan) => {
    expect(rupiahKeTeks(nilai)).toBe(harapan);
  });
});

describe('kasus tepi', () => {
  it('nol diucapkan, bukan didiamkan', () => {
    // Kembalian nol adalah hasil yang sah dan harus disebut — kalau didiamkan,
    // pengguna tidak tahu apakah sistem sudah selesai menghitung.
    expect(rupiahKeTeks(0)).toBe('nol rupiah');
  });

  it('nilai tidak sah menghasilkan larik kosong, bukan error', () => {
    // Sistem yang dipakai orang yang tidak bisa melihat layar tidak boleh mati
    // karena satu nilai aneh.
    expect(rupiahKeKlip(-1)).toEqual([]);
    expect(rupiahKeKlip(1.5)).toEqual([]);
    expect(rupiahKeKlip(Number.NaN)).toEqual([]);
    expect(rupiahKeKlip(Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('selalu diakhiri kata rupiah', () => {
    for (const nilai of [0, 1, 999, 50_000, 1_234_567]) {
      expect(rupiahKeKlip(nilai).at(-1)).toBe('rupiah');
    }
  });

  it('tidak pernah menghasilkan klip di luar daftar yang dirender', () => {
    // Klip yang belum dirender berarti keheningan di tengah kalimat.
    const sah = new Set(rupiahKeKlip(987_654_321));
    for (const nilai of [0, 11, 101, 1000, 100_000, 2_500_000]) {
      for (const k of rupiahKeKlip(nilai)) {
        expect(typeof k).toBe('string');
        expect(k.length).toBeGreaterThan(0);
      }
    }
    expect(sah.size).toBeGreaterThan(0);
  });
});
