/**
 * Tes integrasi alur transaksi, dari sudut pandang TELINGA pengguna.
 *
 * Tes lain memeriksa state. Berkas ini memeriksa **apa yang sebenarnya
 * didengar** sepanjang satu transaksi — karena itulah produknya. Pengguna
 * SUDEPI tidak pernah melihat `StateTransaksi`; ia hanya mendengar urutan
 * kalimat dan merasakan getaran.
 *
 * Kalau urutan ucapan salah, tidak ada tes unit yang akan menangkapnya, dan
 * kekeliruannya baru terdengar di depan juri.
 */

import { describe, expect, it } from 'vitest';
import {
  STATE_AWAL,
  type Efek,
  type HasilPindai,
  type Peristiwa,
  type PolaGetar,
  type StateTransaksi,
} from '@/contracts';
import { keTeks } from '@/audio/pengucap';
import { reduksi } from './mesin';

/** Menjalankan peristiwa berurutan sambil mengumpulkan seluruh efeknya. */
function jalankanAlur(...peristiwa: readonly Peristiwa[]): {
  readonly state: StateTransaksi;
  readonly efek: readonly Efek[];
  readonly ucapan: readonly string[];
  readonly getaran: readonly PolaGetar[];
} {
  let state = STATE_AWAL;
  const efek: Efek[] = [];

  for (const p of peristiwa) {
    const hasil = reduksi(state, p);
    state = hasil.state;
    efek.push(...hasil.efek);
  }

  return {
    state,
    efek,
    ucapan: efek.flatMap((e) => (e.jenis === 'UCAP' ? [keTeks(e.ucapan)] : [])),
    getaran: efek.flatMap((e) => (e.jenis === 'GETAR' ? [e.pola] : [])),
  };
}

function pindai(
  status: HasilPindai['status'],
  nominal: readonly number[] = [],
  adaKoin = false,
): HasilPindai {
  const stabil = status === 'stabil';
  return {
    status,
    deteksi: stabil
      ? [
          ...nominal.map((n, i) => ({
            kodeKelas: i,
            nominal: n as never,
            koin: false,
            skor: 0.95,
            kotak: { x: 0, y: i * 0.2, w: 0.5, h: 0.15 },
            iouMaks: 0,
          })),
          ...(adaKoin
            ? [
                {
                  kodeKelas: 7,
                  nominal: null,
                  koin: true,
                  skor: 0.95,
                  kotak: { x: 0.6, y: 0.6, w: 0.2, h: 0.2 },
                  iouMaks: 0,
                },
              ]
            : []),
        ]
      : [],
    totalKertas: stabil ? nominal.reduce((a, b) => a + b, 0) : 0,
    adaKoin: stabil && adaKoin,
    latensiMs: 120,
    fps: 8,
    luma: 0.6,
    senterAktif: false,
  };
}

describe('satu transaksi utuh, didengar dari awal sampai akhir', () => {
  it('belanja 35.000 dibayar 50.000, kembalian 15.000', () => {
    const { state, ucapan, getaran } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [50_000]) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 35_000 },
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [10_000, 5000]) },
      { jenis: 'KONFIRMASI' },
    );

    expect(state.fase).toBe('SELESAI');
    expect(ucapan).toEqual([
      'Arahkan kamera ke uang',
      'Terdeteksi lima puluh ribu rupiah Total lima puluh ribu rupiah',
      'Uang dibayar lima puluh ribu rupiah Total belanja',
      'Total belanja tiga puluh lima ribu rupiah',
      'Kembalian lima belas ribu rupiah',
      'Arahkan kamera ke uang',
      'Kembalian lima belas ribu rupiah',
      'Transaksi selesai',
    ]);

    // Getaran berhasil menandai setiap penguncian nominal — satu-satunya
    // isyarat yang tetap sampai ketika pasar terlalu bising untuk mendengar.
    expect(getaran).toContain('berhasil');
  });

  it('menyebut tiap lembar lalu totalnya pada tumpukan', () => {
    const { ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [100_000, 20_000, 5000]) },
    );
    expect(ucapan[1]).toBe(
      'Terdeteksi seratus ribu rupiah dua puluh ribu rupiah lima ribu rupiah ' +
        'Total seratus dua puluh lima ribu rupiah',
    );
  });

  it('menyebut keberadaan koin tanpa menyebut nilainya di Fase 1', () => {
    // Nilai koin baru diketahui di Fase 4, dari selisih. Menyebut angka di
    // Fase 1 berarti menebak.
    const { ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [20_000], true) },
    );
    expect(ucapan[1]).toContain('ditambah koin');
    expect(ucapan[1]).not.toMatch(/ratus rupiah$/);
  });

  it('menyebut nilai koin di Fase 4, diturunkan dari selisih', () => {
    const { state, ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [50_000]) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 49_500 },
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [], true) },
    );
    expect(state.nominalKoin).toBe(500);
    expect(ucapan.at(-1)).toBe('Kembalian nol rupiah ditambah koin lima ratus rupiah');
  });
});

describe('yang didengar saat ada yang salah', () => {
  it('abstain terdengar sebagai ajakan mengulang, bukan kesalahan', () => {
    const { ucapan, getaran } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('abstain') },
    );
    expect(ucapan.at(-1)).toBe('Belum yakin. Coba pindai lagi');
    expect(getaran.at(-1)).toBe('gagal');
  });

  it('TIDAK menyebut nominal apa pun saat abstain', () => {
    // Inilah janji inti produk. Kalau tes ini gagal, sistem berbohong kepada
    // orang yang tidak bisa memeriksa ulang jawabannya.
    const { ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('abstain') },
      { jenis: 'HASIL_PINDAI', muatan: pindai('belum-stabil') },
    );
    for (const u of ucapan) {
      expect(u).not.toMatch(/ribu rupiah/);
    }
  });

  it('bayar kurang terdengar jelas dan tidak memajukan fase', () => {
    const { state, ucapan, getaran } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [20_000]) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 50_000 },
      { jenis: 'KONFIRMASI' },
    );
    expect(state.fase).toBe('KALKULATOR');
    expect(ucapan.at(-1)).toBe('Uang kurang dari total belanja');
    expect(getaran.at(-1)).toBe('gagal');
  });

  it('diam total saat hasil belum stabil', () => {
    // Bicara setengah matang lebih buruk daripada diam: pengguna akan
    // menurunkan tangannya mengira sudah selesai.
    const { ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('belum-stabil') },
      { jenis: 'HASIL_PINDAI', muatan: pindai('tidak-ada-objek') },
    );
    expect(ucapan).toEqual(['Arahkan kamera ke uang']);
  });

  it('pembatalan terdengar berbeda dari penyelesaian', () => {
    const batal = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [50_000]) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'BATAL' },
    );
    expect(batal.ucapan.at(-1)).toBe('Transaksi dibatalkan');
    expect(batal.state).toEqual(STATE_AWAL);
  });

  it('selesai TIDAK terdengar sebagai dibatalkan', () => {
    // Mengucapkan kata yang salah kepada orang yang hanya punya suara sebagai
    // umpan balik akan membuatnya mengira transaksinya gagal.
    const { state, ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [50_000]) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 50_000 },
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', []) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
    );
    expect(state).toEqual(STATE_AWAL);
    expect(ucapan).not.toContain('Transaksi dibatalkan');
    expect(ucapan).toContain('Transaksi selesai');
  });
});

describe('urutan efek perangkat', () => {
  it('pemindaian dihentikan sebelum masuk kalkulator', () => {
    // Kamera yang terus hidup di fase kalkulator memboroskan baterai dan
    // memanaskan HP, dan pengguna tidak akan menyadarinya.
    const { efek } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [50_000]) },
      { jenis: 'KONFIRMASI' },
    );
    expect(efek.map((e) => e.jenis)).toContain('HENTIKAN_PINDAI');
  });

  it('pemindaian Fase 4 dimulai setelah layar kasir', () => {
    const { efek } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [50_000]) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 35_000 },
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
    );
    const mulaiPindai = efek.filter((e) => e.jenis === 'MULAI_PINDAI');
    expect(mulaiPindai.map((e) => (e.jenis === 'MULAI_PINDAI' ? e.fase : 0))).toEqual([
      1, 4,
    ]);
  });

  it('transaksi disimpan tepat sekali, saat selesai', () => {
    const { efek } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [50_000]) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 50_000 },
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', []) },
      { jenis: 'KONFIRMASI' },
    );
    expect(efek.filter((e) => e.jenis === 'SIMPAN_TRANSAKSI')).toHaveLength(1);
  });

  it('transaksi yang dibatalkan TIDAK disimpan', () => {
    const { efek } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [50_000]) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'BATAL' },
    );
    expect(efek.filter((e) => e.jenis === 'SIMPAN_TRANSAKSI')).toHaveLength(0);
  });
});
