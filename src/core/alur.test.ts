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
 *
 * ALURNYA BERUBAH DI ADR-0014. Transaksi kini dimulai langsung dari kalkulator:
 * uang yang dipegang dimasukkan lebih dulu, lalu total belanja. Kamera tidak
 * lagi muncul di awal — ia hanya dipakai di akhir untuk memeriksa kembalian.
 * Tes pendengaran untuk alat baca uang pindah ke `pembaca.test.ts`.
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
      ? nominal.map((n, i) => ({
          kodeKelas: i,
          nominal: n as never,
          koin: false,
          skor: 0.95,
          kotak: { x: 0, y: i * 0.1, w: 0.5, h: 0.2 },
          iouMaks: 0,
        }))
      : [],
    totalKertas: stabil ? nominal.reduce((a, b) => a + b, 0) : 0,
    adaKoin: stabil ? adaKoin : false,
    latensiMs: 120,
    fps: 8,
    luma: 0.6,
    senterAktif: false,
  };
}

/** Pembuka yang dipakai hampir semua tes: masuk transaksi, isi kedua nominal. */
function transaksi(bayar: number, belanja: number): readonly Peristiwa[] {
  return [
    { jenis: 'MULAI', padaMs: 1000 },
    { jenis: 'SET_BAYAR', nilai: bayar },
    { jenis: 'SET_BELANJA', nilai: belanja },
  ];
}

describe('satu transaksi utuh, didengar dari awal sampai akhir', () => {
  it('bayar 50.000 untuk belanja 35.000, kembalian 15.000', () => {
    const { state, ucapan, getaran } = jalankanAlur(
      ...transaksi(50_000, 35_000),
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [10_000, 5000]) },
      { jenis: 'KONFIRMASI' },
    );

    expect(state.fase).toBe('SELESAI');
    expect(ucapan).toEqual([
      // Masuk transaksi langsung menyebut kolom yang harus diisi lebih dulu.
      'Uang dibayar',
      'lima puluh ribu rupiah',
      'tiga puluh lima ribu rupiah',
      'Kembalian lima belas ribu rupiah',
      'Arahkan kamera ke uang',
      'Kembalian lima belas ribu rupiah',
      'Transaksi selesai',
    ]);

    // Getaran menandai penguncian nominal — satu-satunya isyarat yang tetap
    // sampai ketika pasar terlalu bising untuk mendengar.
    expect(getaran).toContain('berhasil');
  });

  it('menyebut nilai koin di akhir, diturunkan dari selisih', () => {
    const { state, ucapan } = jalankanAlur(
      ...transaksi(50_000, 49_500),
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', [], true) },
    );
    expect(state.nominalKoin).toBe(500);
    expect(ucapan.at(-1)).toBe(
      'Kembalian nol rupiah ditambah koin lima ratus rupiah',
    );
  });

  it('uang pas tetap menyelesaikan transaksi', () => {
    const { state } = jalankanAlur(
      ...transaksi(50_000, 50_000),
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', []) },
      { jenis: 'KONFIRMASI' },
    );
    expect(state.fase).toBe('SELESAI');
  });
});

describe('yang didengar saat ada yang salah', () => {
  it('bayar kurang terdengar jelas dan tidak memajukan fase', () => {
    const { state, ucapan, getaran } = jalankanAlur(
      ...transaksi(20_000, 50_000),
      { jenis: 'KONFIRMASI' },
    );
    expect(state.fase).toBe('KALKULATOR');
    expect(ucapan.at(-1)).toBe('Uang kurang dari total belanja');
    expect(getaran.at(-1)).toBe('gagal');
  });

  it('belum lengkap tidak memajukan fase, dan tidak berbohong', () => {
    // Total belanja belum diisi. Sistem harus DIAM, bukan melanjutkan dengan
    // angka yang belum ada.
    const { state, ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'SET_BAYAR', nilai: 50_000 },
      { jenis: 'KONFIRMASI' },
    );
    expect(state.fase).toBe('KALKULATOR');
    expect(ucapan).not.toContain('Transaksi selesai');
  });

  it('pembatalan terdengar berbeda dari penyelesaian', () => {
    const batal = jalankanAlur(...transaksi(50_000, 35_000), {
      jenis: 'BATAL',
    });
    expect(batal.ucapan.at(-1)).toBe('Transaksi dibatalkan');
    expect(batal.state).toEqual(STATE_AWAL);
  });

  it('selesai TIDAK terdengar sebagai dibatalkan', () => {
    // Mengucapkan kata yang salah kepada orang yang hanya punya suara sebagai
    // umpan balik akan membuatnya mengira transaksinya gagal.
    const { state, ucapan } = jalankanAlur(
      ...transaksi(50_000, 50_000),
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
  it('kamera TIDAK menyala di awal transaksi', () => {
    // Inti perubahan ADR-0014. Kamera yang menyala sejak awal memboroskan
    // baterai dan memanaskan HP sepanjang pengguna mengetik nominal — dan
    // pengguna yang tidak bisa melihat layar tidak akan menyadarinya.
    const { efek } = jalankanAlur(...transaksi(50_000, 35_000));
    expect(efek.map((e) => e.jenis)).not.toContain('MULAI_PINDAI');
  });

  it('pemindaian hanya dimulai sekali, untuk kembalian', () => {
    const { efek } = jalankanAlur(
      ...transaksi(50_000, 35_000),
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
    );
    const mulai = efek.filter((e) => e.jenis === 'MULAI_PINDAI');
    expect(
      mulai.map((e) => (e.jenis === 'MULAI_PINDAI' ? e.fase : 0)),
    ).toEqual([4]);
  });

  it('transaksi disimpan tepat sekali, saat selesai', () => {
    const { efek } = jalankanAlur(
      ...transaksi(50_000, 50_000),
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', []) },
      { jenis: 'KONFIRMASI' },
    );
    expect(efek.filter((e) => e.jenis === 'SIMPAN_TRANSAKSI')).toHaveLength(1);
  });

  it('transaksi yang dibatalkan TETAP disimpan', () => {
    // Lampiran 7 mencantumkan "dibatalkan" sebagai status yang sah, dan
    // angkanya justru yang dibutuhkan tahap Check pada Lampiran 11. Seberapa
    // sering pengguna menyerah di tengah jalan adalah ukuran kegunaan yang
    // lebih jujur daripada seberapa sering ia berhasil.
    const { efek } = jalankanAlur(...transaksi(50_000, 35_000), {
      jenis: 'BATAL',
    });
    expect(efek.filter((e) => e.jenis === 'SIMPAN_TRANSAKSI')).toHaveLength(1);
  });
});

describe('kembali ke Mode Siaga', () => {
  it('mengumumkan siap setelah transaksi selesai', () => {
    // Tanpa ini pengguna hanya mendengar kesunyian setelah menekan, dan tidak
    // tahu apakah aplikasi sudah siap dipakai lagi.
    const { state, ucapan } = jalankanAlur(
      ...transaksi(50_000, 50_000),
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', []) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
    );
    expect(state.fase).toBe('SIAGA');
    expect(ucapan.at(-1)).toBe('Siap memindai');
  });
});

describe('umpan balik saat memasukkan nominal', () => {
  it('setiap perubahan nominal diucapkan dan bergetar', () => {
    const { ucapan, getaran } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'SET_BAYAR', nilai: 50_000 },
    );
    expect(ucapan.at(-1)).toBe('lima puluh ribu rupiah');
    expect(getaran.at(-1)).toBe('ringan');
  });

  it('penekanan beruntun mengucapkan TOTAL BERJALAN, bukan yang ditambahkan', () => {
    // Pengguna perlu tahu di mana angkanya sekarang, bukan apa yang barusan
    // ditekan — ia tidak bisa melihat layar untuk memeriksanya.
    const { ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'SET_BELANJA', nilai: 5 },
      { jenis: 'SET_BELANJA', nilai: 50 },
      { jenis: 'SET_BELANJA', nilai: 500 },
    );
    expect(ucapan.slice(-3)).toEqual([
      'lima rupiah',
      'lima puluh rupiah',
      'lima ratus rupiah',
    ]);
  });

  it('tombol hapus juga terdengar', () => {
    const { ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'SET_BELANJA', nilai: 50_000 },
      { jenis: 'SET_BELANJA', nilai: 0 },
    );
    expect(ucapan.at(-1)).toBe('nol rupiah');
  });

  it('TIDAK mengulang awalan pada tiap tekan', () => {
    // Konteksnya sudah disebut saat masuk fase; mengulanginya tiap tekan
    // membuat pengguna menunggu dua kata sebelum mendengar hal yang ia
    // butuhkan.
    const { ucapan } = jalankanAlur(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'SET_BELANJA', nilai: 35_000 },
    );
    expect(ucapan.at(-1)).toBe('tiga puluh lima ribu rupiah');
  });
});
