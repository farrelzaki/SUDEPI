import { describe, expect, it } from 'vitest';
import { uraiPerintahNavigasi } from './perintah';

describe('uraiPerintahNavigasi', () => {
  it('mengenali perintah mulai transaksi di fase SIAGA', () => {
    expect(uraiPerintahNavigasi(['mulai transaksi'], 'SIAGA')).toEqual({
      jenis: 'MULAI_TRANSAKSI',
    });
    expect(uraiPerintahNavigasi(['transaksi'], 'SIAGA')).toEqual({
      jenis: 'MULAI_TRANSAKSI',
    });
    expect(uraiPerintahNavigasi(['buka transaksi baru'], 'SIAGA')).toEqual({
      jenis: 'MULAI_TRANSAKSI',
    });
    expect(uraiPerintahNavigasi(['hitung kembalian'], 'SIAGA')).toEqual({
      jenis: 'MULAI_TRANSAKSI',
    });
  });

  it('mengenali perintah lanjutkan di KALKULATOR', () => {
    expect(uraiPerintahNavigasi(['lanjutkan'], 'KALKULATOR')).toEqual({
      jenis: 'LANJUTKAN',
    });
    expect(uraiPerintahNavigasi(['lanjut'], 'KALKULATOR')).toEqual({
      jenis: 'LANJUTKAN',
    });
    expect(uraiPerintahNavigasi(['ke kasir'], 'KALKULATOR')).toEqual({
      jenis: 'LANJUTKAN',
    });
    expect(uraiPerintahNavigasi(['oke'], 'KALKULATOR')).toEqual({
      jenis: 'LANJUTKAN',
    });
  });

  it('mengenali nominal angka di KALKULATOR', () => {
    expect(uraiPerintahNavigasi(['lima puluh ribu'], 'KALKULATOR')).toEqual({
      jenis: 'NOMINAL',
      nilai: 50_000,
    });
    expect(uraiPerintahNavigasi(['30000'], 'KALKULATOR')).toEqual({
      jenis: 'NOMINAL',
      nilai: 30_000,
    });
  });

  it('mengenali periksa kembalian di LAYAR_KASIR', () => {
    expect(uraiPerintahNavigasi(['periksa kembalian'], 'LAYAR_KASIR')).toEqual({
      jenis: 'PERIKSA_KEMBALIAN',
    });
    expect(uraiPerintahNavigasi(['kembalian'], 'LAYAR_KASIR')).toEqual({
      jenis: 'PERIKSA_KEMBALIAN',
    });
    expect(uraiPerintahNavigasi(['lanjutkan'], 'LAYAR_KASIR')).toEqual({
      jenis: 'PERIKSA_KEMBALIAN',
    });
  });

  it('mengenali selesaikan transaksi di PINDAI_KEMBALIAN', () => {
    expect(
      uraiPerintahNavigasi(['selesaikan transaksi'], 'PINDAI_KEMBALIAN'),
    ).toEqual({
      jenis: 'SELESAIKAN_TRANSAKSI',
    });
    expect(uraiPerintahNavigasi(['selesai'], 'PINDAI_KEMBALIAN')).toEqual({
      jenis: 'SELESAIKAN_TRANSAKSI',
    });
    expect(uraiPerintahNavigasi(['sudah pas'], 'PINDAI_KEMBALIAN')).toEqual({
      jenis: 'SELESAIKAN_TRANSAKSI',
    });
    expect(uraiPerintahNavigasi(['beres'], 'PINDAI_KEMBALIAN')).toEqual({
      jenis: 'SELESAIKAN_TRANSAKSI',
    });
  });

  it('mengenali perintah kembali di SELESAI', () => {
    expect(uraiPerintahNavigasi(['selesai'], 'SELESAI')).toEqual({
      jenis: 'SELESAI',
    });
    expect(uraiPerintahNavigasi(['kembali ke beranda'], 'SELESAI')).toEqual({
      jenis: 'SELESAI',
    });
    expect(uraiPerintahNavigasi(['ke awal'], 'SELESAI')).toEqual({
      jenis: 'SELESAI',
    });
  });

  it('mengenali perintah batal di fase transaksi', () => {
    expect(uraiPerintahNavigasi(['batalkan'], 'KALKULATOR')).toEqual({
      jenis: 'BATAL',
    });
    expect(uraiPerintahNavigasi(['batal'], 'LAYAR_KASIR')).toEqual({
      jenis: 'BATAL',
    });
    expect(uraiPerintahNavigasi(['batal transaksi'], 'PINDAI_KEMBALIAN')).toEqual({
      jenis: 'BATAL',
    });
    // Di SIAGA, batal tidak berpengaruh
    expect(uraiPerintahNavigasi(['batal'], 'SIAGA')).toBeNull();
  });
});
