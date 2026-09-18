import { describe, expect, it } from 'vitest';
import { turunkanKoin } from './koin';

describe('turunkanKoin', () => {
  it('tidak ada koin saat uang kertas menutup seluruh kembalian', () => {
    expect(turunkanKoin(15_000, 15_000)).toEqual({
      ok: true,
      nominalKoin: 0,
      adaKoin: false,
    });
  });

  it('menurunkan nominal koin dari selisih', () => {
    // Kembalian wajib 15.500, terdeteksi 15.000 kertas -> 500 rupiah koin.
    expect(turunkanKoin(15_500, 15_000)).toEqual({
      ok: true,
      nominalKoin: 500,
      adaKoin: true,
    });
  });

  it('menerima selisih tepat di bawah pecahan kertas terkecil', () => {
    expect(turunkanKoin(15_999, 15_000)).toEqual({
      ok: true,
      nominalKoin: 999,
      adaKoin: true,
    });
  });

  it('MENOLAK selisih 1.000 atau lebih — itu uang kertas yang terlewat', () => {
    // Inilah kekeliruan yang paling mungkin lolos ke demo: menyebut selisih
    // Rp1.000 sebagai "koin" padahal ada selembar uang yang tidak terdeteksi.
    expect(turunkanKoin(16_000, 15_000)).toEqual({
      ok: false,
      alasan: 'selisih-terlalu-besar',
    });
    expect(turunkanKoin(65_000, 15_000)).toEqual({
      ok: false,
      alasan: 'selisih-terlalu-besar',
    });
  });

  it('MENOLAK saat uang kertas terdeteksi melebihi kembalian wajib', () => {
    expect(turunkanKoin(15_000, 20_000)).toEqual({
      ok: false,
      alasan: 'kertas-melebihi-kembalian',
    });
  });

  it('menolak nilai yang tidak sah', () => {
    expect(turunkanKoin(-1, 0)).toEqual({ ok: false, alasan: 'nilai-tidak-sah' });
    expect(turunkanKoin(15_000, 1.5)).toEqual({
      ok: false,
      alasan: 'nilai-tidak-sah',
    });
    expect(turunkanKoin(Number.NaN, 0)).toEqual({
      ok: false,
      alasan: 'nilai-tidak-sah',
    });
  });
});
