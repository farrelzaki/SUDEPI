/**
 * Tes state machine transaksi.
 *
 * Setengah dari berkas ini menguji peristiwa yang TIDAK SAH. Itu disengaja:
 * jalur bahagia akan ketahuan rusak saat demo, sedangkan transisi terlarang
 * yang diam-diam lolos justru membawa sistem ke keadaan mustahil — misalnya
 * menampilkan angka ke pedagang padahal nominalnya belum dikunci.
 */

import { describe, expect, it } from 'vitest';
import {
  STATE_AWAL,
  type Efek,
  type Fase,
  type HasilPindai,
  type Peristiwa,
  type StateTransaksi,
} from '@/contracts';
import { reduksi } from './mesin';

/* ------------------------------- pembantu ------------------------------- */

function pindai(
  status: HasilPindai['status'],
  totalKertas = 0,
  adaKoin = false,
): HasilPindai {
  const deteksi =
    status === 'stabil' && totalKertas > 0
      ? [
          {
            kodeKelas: 12,
            nominal: totalKertas as never,
            koin: false,
            skor: 0.95,
            kotak: { x: 0, y: 0, w: 0.5, h: 0.3 },
            iouMaks: 0,
          },
        ]
      : [];

  return {
    status,
    deteksi,
    totalKertas: status === 'stabil' ? totalKertas : 0,
    adaKoin: status === 'stabil' ? adaKoin : false,
    latensiMs: 120,
    fps: 8,
    luma: 0.6,
    senterAktif: false,
  };
}

/** Menjalankan serangkaian peristiwa dari STATE_AWAL. */
function jalankan(...peristiwa: readonly Peristiwa[]): StateTransaksi {
  return peristiwa.reduce<StateTransaksi>(
    (s, p) => reduksi(s, p).state,
    STATE_AWAL,
  );
}

const jenisEfek = (efek: readonly Efek[]): readonly string[] =>
  efek.map((e) => e.jenis);

/** Sampai ke KALKULATOR dengan hasil pindai stabil senilai `dibayar`. */
function sampaiKalkulator(dibayar = 100_000): StateTransaksi {
  return jalankan(
    { jenis: 'MULAI', padaMs: 1000 },
    { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', dibayar) },
    { jenis: 'KONFIRMASI' },
  );
}

/** Sampai ke PINDAI_KEMBALIAN dengan kembalian wajib 15.000. */
function sampaiPindaiKembalian(): StateTransaksi {
  return jalankan(
    { jenis: 'MULAI', padaMs: 1000 },
    { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 50_000) },
    { jenis: 'KONFIRMASI' },
    { jenis: 'SET_BELANJA', nilai: 35_000 },
    { jenis: 'KONFIRMASI' },
    { jenis: 'KONFIRMASI' },
  );
}

/* --------------------------------- tes ---------------------------------- */

describe('alur bahagia', () => {
  it('menjalani Fase 1 sampai 4 secara utuh', () => {
    const akhir = jalankan(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 50_000) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 35_000 },
      { jenis: 'KONFIRMASI' },
      { jenis: 'KONFIRMASI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 15_000) },
      { jenis: 'KONFIRMASI' },
    );

    expect(akhir.fase).toBe<Fase>('SELESAI');
    expect(akhir.totalBelanja).toBe(35_000);
    expect(akhir.uangDibayar).toBe(50_000);
    expect(akhir.kembalianWajib).toBe(15_000);
    expect(akhir.kembalianTerverifikasi).toBe(15_000);
    expect(akhir.nominalKoin).toBe(0);
  });

  it('hasil pindai Fase 1 langsung dipakai sebagai nominal bayar', () => {
    // Exsum Bab III Fase 2: pengguna tidak perlu memasukkan ulang.
    expect(sampaiKalkulator(75_000).uangDibayar).toBe(75_000);
  });

  it('LAYAR_KASIR dapat dilewati langsung ke pemindaian kembalian', () => {
    const s = jalankan(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 50_000) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 20_000 },
      { jenis: 'LEWATI_LAYAR_KASIR' },
    );
    expect(s.fase).toBe<Fase>('PINDAI_KEMBALIAN');
    expect(s.kembalianWajib).toBe(30_000);
  });

  it('menurunkan nominal koin dari selisih kembalian', () => {
    const s = reduksi(
      { ...sampaiPindaiKembalian(), kembalianWajib: 15_500 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 15_000) },
    ).state;
    expect(s.nominalKoin).toBe(500);
  });
});

describe('abstain — sistem boleh berkata tidak tahu', () => {
  it('tidak menyebut nominal apa pun saat abstain', () => {
    const { state, efek } = reduksi(
      jalankan({ jenis: 'MULAI', padaMs: 1000 }),
      { jenis: 'HASIL_PINDAI', muatan: pindai('abstain') },
    );
    expect(state.fase).toBe<Fase>('PINDAI_BAYAR');
    expect(state.alasanAbstain).not.toBeNull();
    expect(jenisEfek(efek)).toEqual(['UCAP', 'GETAR']);
  });

  it('diam saat hasil belum stabil — tidak bicara setengah matang', () => {
    const { efek } = reduksi(jalankan({ jenis: 'MULAI', padaMs: 1000 }), {
      jenis: 'HASIL_PINDAI',
      muatan: pindai('belum-stabil'),
    });
    expect(efek).toHaveLength(0);
  });

  it('abstain saat selisih kembalian terlalu besar untuk disebut koin', () => {
    // Kembalian wajib 16.000 tapi hanya 15.000 terdeteksi: ada selembar
    // Rp1.000 yang terlewat, bukan koin. Jangan menebak.
    const s = reduksi(
      { ...sampaiPindaiKembalian(), kembalianWajib: 16_000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 15_000) },
    ).state;
    expect(s.nominalKoin).toBeNull();
    expect(s.alasanAbstain).toBe('selisih-terlalu-besar');
  });

  it('tidak bisa menyelesaikan transaksi selagi abstain', () => {
    const s = reduksi(
      { ...sampaiPindaiKembalian(), kembalianWajib: 16_000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 15_000) },
    ).state;
    expect(reduksi(s, { jenis: 'KONFIRMASI' }).state.fase).toBe<Fase>(
      'PINDAI_KEMBALIAN',
    );
  });
});

describe('BATAL sah dari fase mana pun kecuali SIAGA', () => {
  const fase: readonly StateTransaksi[] = [
    jalankan({ jenis: 'MULAI', padaMs: 1000 }),
    sampaiKalkulator(),
    sampaiPindaiKembalian(),
  ];

  it.each(fase.map((s) => [s.fase, s] as const))(
    'dari %s kembali ke SIAGA',
    (_nama, state) => {
      const { state: sesudah, efek } = reduksi(state, { jenis: 'BATAL' });
      expect(sesudah).toEqual(STATE_AWAL);
      expect(jenisEfek(efek)).toContain('HENTIKAN_PINDAI');
    },
  );

  it('dari LAYAR_KASIR juga bisa dibatalkan', () => {
    const s = jalankan(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 50_000) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 35_000 },
      { jenis: 'KONFIRMASI' },
    );
    expect(s.fase).toBe<Fase>('LAYAR_KASIR');
    expect(reduksi(s, { jenis: 'BATAL' }).state).toEqual(STATE_AWAL);
  });

  it('di SIAGA tidak melakukan apa-apa, bukan error', () => {
    const { state, efek } = reduksi(STATE_AWAL, { jenis: 'BATAL' });
    expect(state).toEqual(STATE_AWAL);
    expect(efek).toHaveLength(0);
  });
});

describe('transisi tidak sah ditolak tanpa melempar error', () => {
  it('tidak bisa lanjut dari PINDAI_BAYAR tanpa hasil stabil', () => {
    const s = jalankan({ jenis: 'MULAI', padaMs: 1000 });
    expect(reduksi(s, { jenis: 'KONFIRMASI' }).state.fase).toBe<Fase>(
      'PINDAI_BAYAR',
    );
  });

  it('tidak bisa lanjut dengan hasil abstain, walau ada deteksi', () => {
    const s = jalankan(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('abstain') },
    );
    expect(reduksi(s, { jenis: 'KONFIRMASI' }).state.fase).toBe<Fase>(
      'PINDAI_BAYAR',
    );
  });

  it('MENOLAK maju saat uang dibayar kurang dari belanja', () => {
    const s = jalankan(
      { jenis: 'MULAI', padaMs: 1000 },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 20_000) },
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 50_000 },
    );
    const { state, efek } = reduksi(s, { jenis: 'KONFIRMASI' });
    // Harus tertahan di KALKULATOR — pedagang belum boleh melihat angka apa pun.
    expect(state.fase).toBe<Fase>('KALKULATOR');
    expect(state.kembalianWajib).toBeNull();
    expect(jenisEfek(efek)).toEqual(['UCAP', 'GETAR']);
  });

  it('tidak bisa mengunci pembayaran tanpa total belanja', () => {
    const s = sampaiKalkulator();
    expect(s.totalBelanja).toBeNull();
    expect(reduksi(s, { jenis: 'KONFIRMASI' }).state.fase).toBe<Fase>(
      'KALKULATOR',
    );
  });

  it('peristiwa kalkulator tidak berlaku saat masih memindai', () => {
    const s = jalankan({ jenis: 'MULAI', padaMs: 1000 });
    expect(reduksi(s, { jenis: 'SET_BELANJA', nilai: 10_000 }).state).toEqual(s);
    expect(reduksi(s, { jenis: 'SET_BAYAR', nilai: 10_000 }).state).toEqual(s);
  });

  it('SIAGA mengabaikan semua peristiwa selain MULAI', () => {
    const lain: readonly Peristiwa[] = [
      { jenis: 'KONFIRMASI' },
      { jenis: 'SET_BELANJA', nilai: 10_000 },
      { jenis: 'SET_BAYAR', nilai: 10_000 },
      { jenis: 'LEWATI_LAYAR_KASIR' },
      { jenis: 'ULANGI_PINDAI' },
      { jenis: 'HASIL_PINDAI', muatan: pindai('stabil', 50_000) },
    ];
    for (const p of lain) {
      const { state, efek } = reduksi(STATE_AWAL, p);
      expect(state).toEqual(STATE_AWAL);
      expect(efek).toHaveLength(0);
    }
  });
});

describe('kemurnian reducer', () => {
  it('tidak pernah mengubah state masukan', () => {
    const awal = sampaiKalkulator();
    const salinan = structuredClone(awal);
    reduksi(awal, { jenis: 'SET_BELANJA', nilai: 12_345 });
    reduksi(awal, { jenis: 'BATAL' });
    reduksi(awal, { jenis: 'KONFIRMASI' });
    expect(awal).toEqual(salinan);
  });

  it('deterministik — masukan sama selalu memberi keluaran sama', () => {
    const s = sampaiKalkulator();
    const a = reduksi(s, { jenis: 'SET_BELANJA', nilai: 20_000 });
    const b = reduksi(s, { jenis: 'SET_BELANJA', nilai: 20_000 });
    expect(a).toEqual(b);
  });

  it('waktu mulai datang dari peristiwa, bukan dari jam sistem', () => {
    expect(jalankan({ jenis: 'MULAI', padaMs: 1_700_000 }).mulaiPadaMs).toBe(
      1_700_000,
    );
  });
});
