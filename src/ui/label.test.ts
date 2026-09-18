/**
 * Tes label tombol utama.
 *
 * Label ini adalah satu-satunya hal yang dibacakan TalkBack sebelum pengguna
 * memutuskan untuk mengetuk. Kalau ia menjanjikan sesuatu yang kemudian
 * ditolak reducer, pengguna yang tidak bisa melihat layar hanya mengetuk dan
 * tidak terjadi apa-apa — tanpa cara mengetahui penyebabnya.
 *
 * Dua kegagalan seperti itu ditemukan saat menelusuri antarmuka sungguhan.
 * Berkas ini menjaganya supaya tidak kembali.
 */

import { describe, expect, it } from 'vitest';
import { STATE_AWAL, type HasilPindai, type StateTransaksi } from '@/contracts';
import { labelUtama } from './label';

function pindai(status: HasilPindai['status'], totalKertas = 0): HasilPindai {
  return {
    status,
    deteksi: [],
    totalKertas: status === 'stabil' ? totalKertas : 0,
    adaKoin: false,
    latensiMs: 120,
    fps: 8,
    luma: 0.6,
    senterAktif: false,
  };
}

const state = (sebagian: Partial<StateTransaksi> = {}): StateTransaksi => ({
  ...STATE_AWAL,
  ...sebagian,
});

describe('label selalu memberi tahu apa yang bisa DILAKUKAN', () => {
  it.each([
    ['SIAGA' as const, null],
    ['PINDAI_BAYAR' as const, null],
    ['KALKULATOR' as const, null],
    ['LAYAR_KASIR' as const, null],
    ['PINDAI_KEMBALIAN' as const, null],
    ['SELESAI' as const, null],
  ])('%s tidak pernah kosong', (fase, hasil) => {
    const teks = labelUtama(fase, hasil, state());
    expect(teks.length).toBeGreaterThan(10);
  });

  it('saat mencari uang, memberi tahu jarak yang harus dipakai', () => {
    // "Memindai" tidak berguna bagi pengguna. "Arahkan kamera, jarak dua puluh
    // sentimeter" memberi tahu apa yang harus dilakukan tubuhnya.
    const teks = labelUtama('PINDAI_BAYAR', pindai('tidak-ada-objek'), state());
    expect(teks).toMatch(/arahkan/i);
    expect(teks).toMatch(/sentimeter/i);
  });

  it('saat abstain, memberi tahu cara memperbaiki keadaan', () => {
    const teks = labelUtama('PINDAI_BAYAR', pindai('abstain'), state());
    expect(teks).toMatch(/dekatkan|terang/i);
  });
});

describe('label TIDAK menjanjikan yang akan ditolak', () => {
  it('mengundang ketukan hanya kalau hasilnya stabil', () => {
    const stabil = labelUtama('PINDAI_BAYAR', pindai('stabil', 50_000), state());
    expect(stabil).toMatch(/ketuk untuk lanjut/i);

    const belum = labelUtama('PINDAI_BAYAR', pindai('belum-stabil'), state());
    expect(belum).not.toMatch(/ketuk untuk lanjut/i);
  });

  it('Fase 4: TIDAK mengundang ketukan kalau koin gagal diturunkan', () => {
    // Bug nyata: label berbunyi "ketuk untuk menyelesaikan transaksi" padahal
    // reducer menolak karena selisihnya terlalu besar untuk disebut koin.
    // Pengguna mengetuk, tidak terjadi apa-apa, dan tidak tahu kenapa.
    const teks = labelUtama(
      'PINDAI_KEMBALIAN',
      pindai('stabil', 5000),
      state({ kembalianWajib: 24_000, nominalKoin: null }),
    );
    expect(teks).not.toMatch(/ketuk untuk menyelesaikan/i);
    expect(teks).toMatch(/belum cocok/i);
    expect(teks).toMatch(/pindai lagi/i);
  });

  it('Fase 4: mengundang ketukan kalau koin berhasil diturunkan', () => {
    const teks = labelUtama(
      'PINDAI_KEMBALIAN',
      pindai('stabil', 5000),
      state({ kembalianWajib: 5000, nominalKoin: 0 }),
    );
    expect(teks).toMatch(/ketuk untuk menyelesaikan/i);
  });

  it('Fase 4: menyebutkan nilai koin kalau ada', () => {
    const teks = labelUtama(
      'PINDAI_KEMBALIAN',
      pindai('stabil', 15_000),
      state({ kembalianWajib: 15_500, nominalKoin: 500 }),
    );
    expect(teks).toMatch(/ditambah koin lima ratus rupiah/i);
  });

  it('Fase 4: tidak menyebut koin kalau nominalnya nol', () => {
    const teks = labelUtama(
      'PINDAI_KEMBALIAN',
      pindai('stabil', 15_000),
      state({ kembalianWajib: 15_000, nominalKoin: 0 }),
    );
    expect(teks).not.toMatch(/koin/i);
  });
});

describe('nominal diucapkan sebagai kata, bukan angka', () => {
  it('memakai penyusun bilangan Indonesia', () => {
    // Pembaca layar akan melafalkan "125000" sebagai deret digit atau dengan
    // intonasi yang salah. Kata-katanya harus sudah jadi sejak di label.
    const teks = labelUtama('PINDAI_BAYAR', pindai('stabil', 125_000), state());
    expect(teks).toContain('seratus dua puluh lima ribu rupiah');
    expect(teks).not.toContain('125000');
    expect(teks).not.toContain('125.000');
  });
});
