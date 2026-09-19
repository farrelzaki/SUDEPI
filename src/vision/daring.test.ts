/**
 * Tes pengurai jawaban jalur daring.
 *
 * Seluruhnya tanpa jaringan. Yang diuji bukan apakah model daring pandai membaca
 * uang — itu hanya bisa dibuktikan dengan uang sungguhan di depan kamera.
 * Yang diuji adalah bahwa kami **tidak pernah mempercayai jawabannya secara
 * buta**.
 *
 * Model bahasa cenderung menjawab apa pun yang ditanyakan, dan itu sifat yang
 * berbahaya untuk pekerjaan ini. Setengah isi berkas ini karena itu adalah
 * jawaban yang HARUS DITOLAK.
 */

import { describe, expect, it } from 'vitest';
import { uraiJawaban } from './daring';

const jawab = (o: unknown): string => JSON.stringify(o);

describe('jawaban yang sah', () => {
  it('satu lembar menjadi hasil stabil', () => {
    const h = uraiJawaban(jawab({ lembar: [50_000], koin: false, yakin: true }));
    expect(h.status).toBe('stabil');
    expect(h.totalKertas).toBe(50_000);
    expect(h.deteksi).toHaveLength(1);
  });

  it('beberapa lembar dijumlahkan, termasuk yang kembar', () => {
    // Inilah yang belum bisa dilakukan jalur luring dengan mantap, dan alasan
    // utama Rencana B ada.
    const h = uraiJawaban(
      jawab({ lembar: [20_000, 20_000, 5000], koin: false, yakin: true }),
    );
    expect(h.totalKertas).toBe(45_000);
    expect(h.deteksi).toHaveLength(3);
  });

  it('koin dilaporkan ada tanpa menyebut nilainya', () => {
    // Nilai koin hanya boleh diturunkan dari selisih kembalian, sama seperti
    // di jalur luring. Menebaknya dari gambar berarti menebak.
    const h = uraiJawaban(jawab({ lembar: [5000], koin: true, yakin: true }));
    expect(h.adaKoin).toBe(true);
    expect(h.totalKertas).toBe(5000);
  });

  it('koin saja, tanpa uang kertas, tetap dilaporkan', () => {
    const h = uraiJawaban(jawab({ lembar: [], koin: true, yakin: true }));
    expect(h.status).toBe('stabil');
    expect(h.adaKoin).toBe(true);
    expect(h.totalKertas).toBe(0);
  });
});

describe('jawaban yang WAJIB ditolak', () => {
  it('ragu menjadi abstain, bukan tebakan', () => {
    const h = uraiJawaban(jawab({ lembar: [50_000], koin: false, yakin: false }));
    expect(h.status).toBe('abstain');
    expect(h.totalKertas).toBe(0);
    expect(h.deteksi).toHaveLength(0);
  });

  it('pecahan di luar tabel membatalkan SELURUH jawaban', () => {
    // Membuang yang asing lalu memakai sisanya akan menghasilkan total yang
    // LEBIH KECIL daripada uang yang sebenarnya ada di tangan — pengguna
    // menyerahkan uangnya tanpa tahu ada yang tidak terhitung.
    const h = uraiJawaban(
      jawab({ lembar: [50_000, 75_000], koin: false, yakin: true }),
    );
    expect(h.status).toBe('abstain');
  });

  it('pecahan mata uang asing ditolak', () => {
    const h = uraiJawaban(jawab({ lembar: [100], koin: false, yakin: true }));
    expect(h.status).toBe('abstain');
  });

  it('JSON rusak tidak membuat aplikasi gagal', () => {
    expect(uraiJawaban('{bukan json').status).toBe('abstain');
    expect(uraiJawaban('').status).toBe('abstain');
  });

  it('bentuk jawaban yang tidak sesuai ditolak', () => {
    expect(uraiJawaban(jawab({ yakin: true })).status).toBe('abstain');
    expect(uraiJawaban(jawab({ lembar: 'lima puluh ribu', yakin: true })).status).toBe(
      'abstain',
    );
    expect(uraiJawaban(jawab([50_000])).status).toBe('abstain');
    expect(uraiJawaban(jawab(null)).status).toBe('abstain');
  });

  it('nominal berupa teks ditolak, tidak diubah diam-diam', () => {
    const h = uraiJawaban(jawab({ lembar: ['50000'], koin: false, yakin: true }));
    expect(h.status).toBe('abstain');
  });

  it('gambar tanpa uang sama sekali menjadi abstain', () => {
    const h = uraiJawaban(jawab({ lembar: [], koin: false, yakin: true }));
    expect(h.status).toBe('abstain');
  });
});

describe('bentuk hasilnya sama dengan jalur luring', () => {
  it('bisa langsung dipakai lapisan hilir tanpa penyesuaian', () => {
    // Seluruh gunanya ada di sini: penyusun kalimat, penurunan nominal koin,
    // dan verifikasi kembalian tidak perlu tahu dari mana angkanya datang.
    const h = uraiJawaban(
      jawab({ lembar: [10_000, 5000], koin: false, yakin: true }),
    );
    expect(h.deteksi.every((d) => d.nominal !== null)).toBe(true);
    expect(h.deteksi.every((d) => d.kodeKelas >= 0)).toBe(true);
    expect(h.deteksi.every((d) => d.iouMaks === 0)).toBe(true);
    expect(h.totalKertas).toBe(
      h.deteksi.reduce((j, d) => j + (d.nominal ?? 0), 0),
    );
  });
});
