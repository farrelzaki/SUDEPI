/**
 * Tes penjaga pemetaan kelas.
 *
 * Ini bukan tes formalitas. Tabel denominasi adalah tempat kesalahan paling
 * berbahaya di seluruh sistem bisa bersembunyi: kalau indeks kelas bergeser
 * satu saja, SUDEPI akan menyebut nominal yang salah DENGAN PENUH KEYAKINAN,
 * dan orang yang tidak bisa memeriksa ulang akan mempercayainya.
 *
 * Tes ini tidak bisa membuktikan tabelnya cocok dengan model — itu hanya bisa
 * dibuktikan dengan uang sungguhan di depan kamera. Yang dijaga di sini adalah
 * bentuk tabelnya tetap konsisten saat ada yang menyuntingnya.
 */

import { describe, expect, it } from 'vitest';
import {
  denominasiDariKode,
  JUMLAH_KELAS,
  kodeDariNominal,
  KODE_KELAS_KOIN,
  NOMINAL_URUT,
  TABEL_DENOMINASI,
} from './uang';
import { AMBANG_IOU, AMBANG_KEYAKINAN, VOTING_BUTUH, VOTING_DARI } from './vision';

describe('tabel denominasi', () => {
  it('berisi tepat 8 kelas', () => {
    expect(TABEL_DENOMINASI).toHaveLength(JUMLAH_KELAS);
  });

  it('kodeKelas selalu sama dengan indeks larik', () => {
    TABEL_DENOMINASI.forEach((d, i) => {
      expect(d.kodeKelas).toBe(i);
    });
  });

  it('terdiri atas 7 uang kertas dan 1 koin', () => {
    const kertas = TABEL_DENOMINASI.filter((d) => !d.koin);
    const koin = TABEL_DENOMINASI.filter((d) => d.koin);
    expect(kertas).toHaveLength(7);
    expect(koin).toHaveLength(1);
  });

  it('setiap nominal muncul TEPAT SEKALI — emisi tidak dipisahkan', () => {
    // Lihat ADR-0007. Tahun emisi tidak pernah diucapkan ke pengguna, jadi
    // memisahkannya hanya membelah data latih tanpa menambah kemampuan.
    for (const nominal of NOMINAL_URUT) {
      expect(TABEL_DENOMINASI.filter((d) => d.nominal === nominal)).toHaveLength(1);
    }
  });

  it('kelas koin tidak punya nominal', () => {
    const koin = denominasiDariKode(KODE_KELAS_KOIN);
    expect(koin?.koin).toBe(true);
    expect(koin?.nominal).toBeNull();
  });

  it('uang kertas selalu punya nominal', () => {
    for (const d of TABEL_DENOMINASI.filter((x) => !x.koin)) {
      expect(d.nominal).not.toBeNull();
    }
  });

  it('kodeDariNominal adalah kebalikan dari tabel', () => {
    for (const nominal of NOMINAL_URUT) {
      const kode = kodeDariNominal(nominal);
      expect(kode).not.toBeNull();
      expect(denominasiDariKode(kode ?? -1)?.nominal).toBe(nominal);
    }
  });

  it('kode di luar jangkauan mengembalikan null, bukan melempar error', () => {
    // Model rusak atau tabel tidak sinkron tidak boleh membuat aplikasi mati
    // di tangan pengguna. Ia harus abstain, bukan crash.
    expect(denominasiDariKode(-1)).toBeNull();
    expect(denominasiDariKode(JUMLAH_KELAS)).toBeNull();
    expect(denominasiDariKode(999)).toBeNull();
  });
});

describe('tetapan rantai keyakinan', () => {
  it('sesuai angka yang dijanjikan executive summary', () => {
    expect(AMBANG_KEYAKINAN).toBe(0.85);
    expect(AMBANG_IOU).toBe(0.4);
  });

  it('voting temporal butuh mayoritas dari jendela bingkai', () => {
    expect(VOTING_BUTUH).toBeGreaterThan(VOTING_DARI / 2);
    expect(VOTING_BUTUH).toBeLessThanOrEqual(VOTING_DARI);
  });
});
