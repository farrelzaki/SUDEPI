/**
 * Tes pembaca uang, dari sudut pandang TELINGA pengguna.
 *
 * Berkas ini memeriksa **apa yang sebenarnya didengar** saat seseorang
 * mengarahkan kamera ke uang — karena itulah produknya. Pengguna SUDEPI tidak
 * pernah melihat state; ia hanya mendengar kalimat dan merasakan getaran.
 *
 * Sebagian besar isinya dipindahkan dari tes alur transaksi, ketika membaca
 * uang dipisahkan menjadi alat yang berdiri sendiri (ADR-0014). Perilaku yang
 * diuji tidak berubah — hanya tempatnya, mengikuti kode yang diujinya.
 */

import { describe, expect, it } from 'vitest';
import type { Efek, HasilPindai, PolaGetar } from '@/contracts';
import { keTeks } from '@/audio/pengucap';
import { bacaUang, PEMBACA_AWAL, type StatePembaca } from './pembaca';

/** Menjalankan beberapa bingkai berurutan sambil mengumpulkan efeknya. */
function jalankan(...bingkai: readonly HasilPindai[]): {
  readonly state: StatePembaca;
  readonly ucapan: readonly string[];
  readonly getaran: readonly PolaGetar[];
} {
  let state = PEMBACA_AWAL;
  const efek: Efek[] = [];

  for (const b of bingkai) {
    const hasil = bacaUang(state, b);
    state = hasil.state;
    efek.push(...hasil.efek);
  }

  return {
    state,
    ucapan: efek.flatMap((e) => (e.jenis === 'UCAP' ? [keTeks(e.ucapan)] : [])),
    getaran: efek.flatMap((e) => (e.jenis === 'GETAR' ? [e.pola] : [])),
  };
}

function pindai(
  status: HasilPindai['status'],
  nominal: readonly number[] = [],
  adaKoin = false,
  iouMaks = 0,
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
          iouMaks,
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

describe('menyebut uang yang terbaca', () => {
  it('menyebut tiap lembar lalu totalnya pada tumpukan', () => {
    const { ucapan } = jalankan(pindai('stabil', [100_000, 20_000, 5000]));
    expect(ucapan.at(-1)).toBe(
      'Terdeteksi seratus ribu rupiah dua puluh ribu rupiah lima ribu rupiah ' +
        'Total seratus dua puluh lima ribu rupiah',
    );
  });

  it('menyebut keberadaan koin TANPA menyebut nilainya', () => {
    // Nilai koin hanya bisa diturunkan dari selisih kembalian, dan alat baca
    // ini tidak tahu apa-apa soal kembalian. Menyebut angka di sini berarti
    // menebak.
    const { ucapan } = jalankan(pindai('stabil', [20_000], true));
    expect(ucapan.at(-1)).toContain('ditambah koin');
    expect(ucapan.at(-1)).not.toMatch(/ratus rupiah$/);
  });

  it('bergetar saat berhasil menyebut, supaya pasar yang bising tidak menelannya', () => {
    const { getaran } = jalankan(pindai('stabil', [50_000]));
    expect(getaran).toContain('sedang');
  });
});

describe('yang didengar saat sistem tidak yakin', () => {
  it('abstain terdengar sebagai ajakan mengulang, bukan kesalahan', () => {
    const { ucapan, getaran } = jalankan(pindai('abstain'));
    expect(ucapan.at(-1)).toBe('Belum yakin. Coba pindai lagi');
    expect(getaran.at(-1)).toBe('gagal');
  });

  it('TIDAK menyebut nominal apa pun saat abstain', () => {
    // Inilah janji inti produk. Kalau tes ini gagal, sistem berbohong kepada
    // orang yang tidak bisa memeriksa ulang jawabannya.
    const { ucapan } = jalankan(pindai('abstain'), pindai('belum-stabil'));
    for (const u of ucapan) expect(u).not.toMatch(/ribu rupiah/);
  });

  it('diam total saat hasil belum stabil', () => {
    // Bicara setengah matang lebih buruk daripada diam: pengguna akan
    // menurunkan tangannya mengira sudah selesai.
    const { ucapan } = jalankan(
      pindai('belum-stabil'),
      pindai('tidak-ada-objek'),
    );
    expect(ucapan).toEqual([]);
  });

  it('memperingatkan SEKALI, bukan tiap bingkai, selama abstain berlanjut', () => {
    // Bingkai datang sekitar sekali per 0,85 detik sementara kalimatnya lebih
    // panjang dari itu, jadi mengucapkannya tiap kali membuat ucapan memotong
    // dirinya sendiri di tengah kata.
    const { ucapan } = jalankan(
      pindai('abstain'),
      pindai('abstain'),
      pindai('abstain'),
    );
    expect(ucapan).toHaveLength(1);
  });

  it('memperingatkan lagi setelah uang disingkirkan dari depan kamera', () => {
    const { ucapan } = jalankan(
      pindai('abstain'),
      pindai('tidak-ada-objek'),
      pindai('abstain'),
    );
    expect(ucapan).toHaveLength(2);
  });
});

describe('tidak mengumumkan ulang isi yang sama', () => {
  it('delapan bingkai stabil identik hanya diucapkan SEKALI', () => {
    // Pernah menjadi bug sungguhan di perangkat: setiap bingkai stabil memicu
    // pengumuman baru, delapan kali per detik, saling menumpuk, terdengar
    // seperti gema yang tidak berhenti.
    const sama = Array.from({ length: 8 }, () => pindai('stabil', [50_000]));
    expect(jalankan(...sama).ucapan).toHaveLength(1);
  });

  it('tetap mengumumkan saat pengguna menambah lembaran', () => {
    const { ucapan } = jalankan(
      pindai('stabil', [50_000]),
      pindai('stabil', [50_000, 20_000]),
    );
    expect(ucapan).toHaveLength(2);
  });

  it('mengumumkan lagi kalau koin muncul, walau totalnya sama', () => {
    const { ucapan } = jalankan(
      pindai('stabil', [20_000]),
      pindai('stabil', [20_000], true),
    );
    expect(ucapan).toHaveLength(2);
  });

  it('bingkai goyah di tengah tidak memicu pengumuman ulang', () => {
    // Tangan yang memegang uang selalu bergeser; satu bingkai yang meleset
    // tidak boleh membuat seluruh kalimat diulang.
    const { ucapan } = jalankan(
      pindai('stabil', [50_000]),
      pindai('belum-stabil'),
      pindai('stabil', [50_000]),
    );
    expect(ucapan).toHaveLength(1);
  });
});

describe('peringatan lembaran bertumpuk (Lampiran 8 risiko nomor 2)', () => {
  it('meminta merenggangkan saat lembaran terlalu berdempetan', () => {
    const { ucapan } = jalankan(pindai('stabil', [50_000, 50_000], false, 0.35));
    expect(ucapan.at(-1)).toContain('Renggangkan lembarannya');
  });

  it('TIDAK meminta apa-apa saat lembaran sudah terpisah', () => {
    const { ucapan } = jalankan(pindai('stabil', [50_000, 20_000], false, 0.05));
    expect(ucapan.at(-1)).not.toContain('Renggangkan');
  });

  it('nominal disebut LEBIH DULU, peringatan menyusul di akhir', () => {
    // Kalau peringatan di depan, pengguna mendengar instruksi sebelum tahu
    // angkanya, dan harus menunggu seluruh kalimat selesai untuk tahu apakah
    // perlu bertindak.
    const { ucapan } = jalankan(pindai('stabil', [50_000, 50_000], false, 0.5));
    const kalimat = ucapan.at(-1) ?? '';
    expect(kalimat.indexOf('seratus ribu rupiah')).toBeLessThan(
      kalimat.indexOf('Renggangkan'),
    );
  });

  it('tetap memperingatkan walau kotaknya sudah disaring NMS', () => {
    // iouMaks di atas AMBANG_IOU berarti satu kotak memang sudah dibuang.
    // Justru di sinilah ambiguitasnya paling besar: satu lembar terbaca dua
    // kali, atau dua lembar bertumpuk? Sistem tidak boleh menebak.
    const { ucapan } = jalankan(pindai('stabil', [50_000], false, 0.72));
    expect(ucapan.at(-1)).toContain('Renggangkan lembarannya');
  });
});

describe('alat baca tidak mengunci jawabannya', () => {
  it('uang baru langsung menggantikan yang lama, tanpa perlu dikonfirmasi', () => {
    // Berbeda dari alur transaksi, di mana nominal yang sudah diucapkan menjadi
    // tawaran yang harus bertahan sampai pengguna menanggapinya. Di sini tidak
    // ada yang perlu ditanggapi — pengguna cukup mengganti lembar dan mendengar
    // jawaban berikutnya, terus-menerus, sampai ia keluar sendiri.
    const { ucapan } = jalankan(
      pindai('stabil', [50_000]),
      pindai('tidak-ada-objek'),
      pindai('stabil', [20_000]),
    );
    expect(ucapan).toHaveLength(2);
    expect(ucapan.at(-1)).toContain('dua puluh ribu rupiah');
  });
});
