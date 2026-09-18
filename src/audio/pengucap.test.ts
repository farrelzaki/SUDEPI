import { describe, expect, it } from 'vitest';
import { frasa, rupiah, urutan } from '@/contracts';
import { keTeks, keUrutanPotongan } from './pengucap';
import { buatMockPengucap } from './mockPengucap';

describe('keUrutanPotongan', () => {
  it('frasa menjadi satu potongan', () => {
    expect(keUrutanPotongan(frasa('kembalian'))).toEqual(['kembalian']);
  });

  it('rupiah dipecah menjadi klip bilangan', () => {
    expect(keUrutanPotongan(rupiah(50_000))).toEqual([
      'lima',
      'puluh',
      'ribu',
      'rupiah',
    ]);
  });

  it('urutan diratakan, termasuk yang bersarang', () => {
    const u = urutan(
      frasa('kembalian'),
      rupiah(1000),
      urutan(frasa('ditambah_koin'), rupiah(500)),
    );
    expect(keUrutanPotongan(u)).toEqual([
      'kembalian',
      'seribu',
      'rupiah',
      'ditambah_koin',
      'lima',
      'ratus',
      'rupiah',
    ]);
  });
});

describe('keTeks', () => {
  it('menerjemahkan frasa ke kalimat Indonesia', () => {
    expect(keTeks(frasa('belum_yakin_ulangi'))).toBe('Belum yakin. Coba pindai lagi');
  });

  it('merangkai frasa dan nominal', () => {
    expect(keTeks(urutan(frasa('kembalian'), rupiah(15_000)))).toBe(
      'Kembalian lima belas ribu rupiah',
    );
  });

  it('kalimat lengkap Fase 4 dengan koin', () => {
    const u = urutan(
      frasa('kembalian'),
      rupiah(15_000),
      frasa('ditambah_koin'),
      rupiah(500),
    );
    expect(keTeks(u)).toBe(
      'Kembalian lima belas ribu rupiah ditambah koin lima ratus rupiah',
    );
  });

  it('nominal tidak sah tidak menghasilkan kalimat rusak', () => {
    expect(keTeks(rupiah(-1))).toBe('');
  });
});

describe('mockPengucap', () => {
  it('mencatat riwayat ucapan', async () => {
    const p = buatMockPengucap();
    await p.siap();
    await p.ucap(frasa('arahkan_kamera'));
    await p.ucap(rupiah(20_000));
    expect(p.riwayat).toEqual(['Arahkan kamera ke uang', 'dua puluh ribu rupiah']);
  });

  it('melacak keadaan peredaman', async () => {
    const p = buatMockPengucap();
    expect(p.sedangRedam).toBe(false);
    p.redam(true);
    expect(p.sedangRedam).toBe(true);
    p.redam(false);
    expect(p.sedangRedam).toBe(false);
  });

  it('riwayat bisa dibersihkan antar tes', async () => {
    const p = buatMockPengucap();
    await p.ucap(frasa('total'));
    p.bersihkanRiwayat();
    expect(p.riwayat).toEqual([]);
  });
});
