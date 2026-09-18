/**
 * Tes pengurai bilangan Bahasa Indonesia.
 *
 * Berkas ini menggantikan mikrofon. Mesin pengenalan suara hanya menghasilkan
 * teks; benar-salahnya nominal yang dipakai menghitung kembalian ditentukan
 * pengurai, jadi di sinilah fitur suara sebenarnya diuji.
 *
 * Setengah isinya adalah kalimat yang HARUS DITOLAK. Itu disengaja: pengurai
 * yang terlalu ramah akan menebak, dan tebakan yang salah menjadi kembalian
 * yang salah — kerugian uang nyata bagi pengguna yang tidak bisa memeriksanya.
 */

import { describe, expect, it } from 'vitest';
import { NOMINAL_MAKS, uraiNominal, uraiNominalWajar } from './urai';

/** Ringkas: hanya nominalnya, atau null. */
const urai = (t: string): number | null => uraiNominal(t)?.nominal ?? null;

describe('uraiNominal — bentuk yang wajar diucapkan', () => {
  it.each([
    ['lima puluh ribu', 50_000],
    ['dua puluh ribu', 20_000],
    ['sepuluh ribu', 10_000],
    ['lima ribu', 5_000],
    ['seribu', 1_000],
    ['seratus ribu', 100_000],
    ['dua ratus ribu', 200_000],
    ['tiga puluh lima ribu', 35_000],
    ['seratus dua puluh lima ribu', 125_000],
    ['empat puluh empat ribu', 44_000],
    ['dua juta', 2_000_000],
    ['satu juta lima ratus ribu', 1_500_000],
    ['dua belas ribu', 12_000],
    ['sembilan belas ribu', 19_000],
    ['sebelas ribu', 11_000],
  ])('"%s" menjadi %i', (teks, nominal) => {
    expect(urai(teks)).toBe(nominal);
  });
});

describe('uraiNominal — kekacauan khas mesin pengenalan suara', () => {
  it('memaafkan kata yang disambung', () => {
    // Mesin sering menyambung bilangan, dan bentuk sambungnya berbeda-beda
    // antar perangkat. Menuntut pengguna berbicara dengan jeda jauh lebih
    // mahal daripada memecahnya di sini.
    expect(urai('limapuluh ribu')).toBe(50_000);
    expect(urai('duapuluh lima ribu')).toBe(25_000);
  });

  it('menerima angka yang ditulis sebagai digit', () => {
    expect(urai('50 ribu')).toBe(50_000);
    expect(urai('125 ribu')).toBe(125_000);
    expect(urai('2 juta')).toBe(2_000_000);
  });

  it('menerima nominal yang sudah utuh sebagai digit', () => {
    expect(urai('50000')).toBe(50_000);
    expect(urai('Rp50.000')).toBe(50_000);
    expect(urai('Rp 125.000')).toBe(125_000);
  });

  it('mengabaikan kata pengiring yang tidak mengubah nilai', () => {
    expect(urai('lima puluh ribu rupiah')).toBe(50_000);
    expect(urai('total belanjanya lima puluh ribu')).toBe(50_000);
    expect(urai('jadi dua puluh ribu rupiah')).toBe(20_000);
  });

  it('mengabaikan kata asing yang muncul SETELAH bilangan', () => {
    // Mesin kerap menambahkan kata yang tidak diucapkan di ujung kalimat.
    expect(urai('lima puluh ribu ya')).toBe(50_000);
  });

  it('tidak peduli huruf besar-kecil', () => {
    expect(urai('Lima Puluh Ribu')).toBe(50_000);
  });
});

describe('uraiNominal — yang WAJIB ditolak', () => {
  it.each([
    ['', 'kalimat kosong'],
    ['   ', 'hanya spasi'],
    ['halo apa kabar', 'bukan bilangan sama sekali'],
    ['setengah', 'bilangan pecahan, bukan nominal'],
    ['rupiah', 'satuan tanpa angka'],
    ['nol', 'nol bukan nominal belanja'],
    ['nol rupiah', 'nol bukan nominal belanja'],
  ])('menolak "%s" — %s', (teks) => {
    expect(urai(teks)).toBeNull();
  });

  it('menolak "belas" yang tidak masuk akal', () => {
    // "dua puluh belas" bukan bilangan Bahasa Indonesia. Pengurai yang
    // memaksakan arti padanya akan menghasilkan angka yang tidak pernah
    // diucapkan siapa pun.
    expect(urai('dua puluh belas')).toBeNull();
    expect(urai('belas ribu')).toBeNull();
  });

  it('menolak kalimat yang diawali kata asing', () => {
    // Berbeda dari kata asing di akhir: kalau bilangannya belum tersusun
    // sama sekali, kalimat itu memang bukan nominal.
    expect(urai('kembalian saya')).toBeNull();
  });
});

describe('uraiNominal — tanpa kata ribu', () => {
  it('membaca apa adanya, tidak menebak skala', () => {
    // "lima puluh" berarti lima puluh. Menerjemahkannya menjadi lima puluh
    // ribu adalah tebakan, dan tebakan tentang nominal uang tidak pernah
    // boleh dilakukan diam-diam — pemanggil akan membacakannya kembali untuk
    // dikonfirmasi, dan di situlah pengguna bisa menolaknya.
    expect(urai('lima puluh')).toBe(50);
    expect(urai('dua ratus')).toBe(200);
  });
});

describe('uraiNominalWajar — batas kewarasan', () => {
  it('menerima nominal transaksi warung', () => {
    expect(uraiNominalWajar('seratus ribu')).toBe(100_000);
    expect(uraiNominalWajar('dua juta')).toBe(2_000_000);
  });

  it('menolak nominal yang mustahil untuk warung', () => {
    // Salah dengar yang menghasilkan puluhan miliar lebih mungkin berasal dari
    // kalimat kacau daripada dari belanjaan sungguhan.
    expect(uraiNominalWajar('sembilan ratus juta')).toBeNull();
    expect(uraiNominalWajar('seribu juta')).toBeNull();
  });

  it('batasnya sendiri masih diterima', () => {
    expect(NOMINAL_MAKS).toBe(10_000_000);
    expect(uraiNominalWajar('sepuluh juta')).toBe(10_000_000);
  });
});

describe('uraiNominal — jejak kata yang dipakai', () => {
  it('melaporkan kata mana yang benar-benar dihitung', () => {
    // Dipakai saat menelusuri salah dengar: kalau nominalnya meleset, jejak
    // ini memberi tahu apakah masalahnya di pengenalan suara atau di pengurai.
    expect(uraiNominal('total lima puluh ribu rupiah')?.dipakai).toEqual([
      'lima',
      'puluh',
      'ribu',
    ]);
  });
});
