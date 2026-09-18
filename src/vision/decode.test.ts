import { describe, expect, it } from 'vitest';
import { AMBANG_KEYAKINAN, JUMLAH_KELAS, UKURAN_MASUKAN } from '@/contracts';
import { AMBANG_MINAT, dekode, hitungLetterbox, JUMLAH_KANAL } from './decode';

/**
 * Menyusun tensor mentah palsu berbentuk [1, JUMLAH_KANAL, jumlahJangkar]
 * dengan tata letak [kanal][jangkar], sama seperti keluaran ONNX sungguhan.
 */
function buatTensor(
  jangkar: readonly {
    cx: number;
    cy: number;
    w: number;
    h: number;
    kelas: number;
    skor: number;
  }[],
  jumlahJangkar = Math.max(jangkar.length, 4),
): Float32Array {
  const data = new Float32Array(JUMLAH_KANAL * jumlahJangkar);
  const set = (kanal: number, a: number, nilai: number): void => {
    data[kanal * jumlahJangkar + a] = nilai;
  };
  jangkar.forEach((j, a) => {
    set(0, a, j.cx);
    set(1, a, j.cy);
    set(2, a, j.w);
    set(3, a, j.h);
    set(4 + j.kelas, a, j.skor);
  });
  return data;
}

describe('JUMLAH_KANAL', () => {
  it('adalah 4 koordinat + 8 kelas = 12', () => {
    expect(JUMLAH_KELAS).toBe(8);
    expect(JUMLAH_KANAL).toBe(12);
  });
});

describe('hitungLetterbox', () => {
  it('bingkai persegi tidak diberi bantalan', () => {
    const lb = hitungLetterbox(480, 480, 320);
    expect(lb.skala).toBeCloseTo(320 / 480, 9);
    expect(lb.padX).toBe(0);
    expect(lb.padY).toBe(0);
  });

  it('bingkai lanskap diberi bantalan atas-bawah', () => {
    const lb = hitungLetterbox(640, 480, 320);
    expect(lb.skala).toBeCloseTo(0.5, 9);
    expect(lb.padX).toBe(0);
    expect(lb.padY).toBeCloseTo(40, 6); // (320 - 240) / 2
  });

  it('bingkai potret diberi bantalan kiri-kanan', () => {
    const lb = hitungLetterbox(480, 640, 320);
    expect(lb.skala).toBeCloseTo(0.5, 9);
    expect(lb.padX).toBeCloseTo(40, 6);
    expect(lb.padY).toBe(0);
  });

  it('mempertahankan rasio — meregangkan akan menurunkan mAP', () => {
    const lb = hitungLetterbox(1280, 720, 320);
    expect(1280 * lb.skala).toBeLessThanOrEqual(320 + 1e-9);
    expect(720 * lb.skala).toBeLessThanOrEqual(320 + 1e-9);
    expect(Math.max(1280 * lb.skala, 720 * lb.skala)).toBeCloseTo(320, 6);
  });
});

describe('dekode', () => {
  const lbPersegi = hitungLetterbox(320, 320, UKURAN_MASUKAN);

  it('mengubah titik tengah menjadi sudut kiri-atas ternormalisasi', () => {
    // Kotak di tengah bingkai, ukuran 160x160 pada masukan 320.
    const data = buatTensor([{ cx: 160, cy: 160, w: 160, h: 160, kelas: 5, skor: 0.95 }]);
    const { lolos } = dekode(data, lbPersegi, AMBANG_KEYAKINAN);

    expect(lolos).toHaveLength(1);
    const k = lolos[0]?.kotak;
    expect(k?.x).toBeCloseTo(0.25, 6);
    expect(k?.y).toBeCloseTo(0.25, 6);
    expect(k?.w).toBeCloseTo(0.5, 6);
    expect(k?.h).toBeCloseTo(0.5, 6);
  });

  it('membalik bantalan letterbox pada bingkai lanskap', () => {
    // 640x480 -> skala 0,5, bantalan atas 40px.
    const lb = hitungLetterbox(640, 480, UKURAN_MASUKAN);
    // Kotak yang menutup seluruh bingkai asli: lebar 320, tinggi 240,
    // berpusat di (160, 160) pada ruang masukan model.
    const data = buatTensor([{ cx: 160, cy: 160, w: 320, h: 240, kelas: 0, skor: 0.9 }]);
    const k = dekode(data, lb, AMBANG_KEYAKINAN).lolos[0]?.kotak;

    expect(k?.x).toBeCloseTo(0, 6);
    expect(k?.y).toBeCloseTo(0, 6);
    expect(k?.w).toBeCloseTo(1, 6);
    expect(k?.h).toBeCloseTo(1, 6);
  });

  it('memetakan indeks kelas ke nominal yang benar', () => {
    const data = buatTensor([
      { cx: 50, cy: 50, w: 20, h: 20, kelas: 0, skor: 0.9 },
      { cx: 150, cy: 50, w: 20, h: 20, kelas: 6, skor: 0.9 },
      { cx: 250, cy: 50, w: 20, h: 20, kelas: 7, skor: 0.9 },
    ]);
    const { lolos } = dekode(data, lbPersegi, AMBANG_KEYAKINAN);

    expect(lolos.map((d) => d.nominal)).toEqual([1000, 100_000, null]);
    expect(lolos.map((d) => d.koin)).toEqual([false, false, true]);
  });

  it('memilih kelas dengan skor tertinggi pada satu jangkar', () => {
    const jumlahJangkar = 4;
    const data = new Float32Array(JUMLAH_KANAL * jumlahJangkar);
    const set = (c: number, a: number, v: number): void => {
      data[c * jumlahJangkar + a] = v;
    };
    set(0, 0, 100);
    set(1, 0, 100);
    set(2, 0, 40);
    set(3, 0, 40);
    set(4 + 3, 0, 0.88); // 10.000
    set(4 + 5, 0, 0.94); // 50.000 — menang
    set(4 + 1, 0, 0.3);

    const { lolos } = dekode(data, lbPersegi, AMBANG_KEYAKINAN);
    expect(lolos).toHaveLength(1);
    expect(lolos[0]?.nominal).toBe(50_000);
    expect(lolos[0]?.skor).toBeCloseTo(0.94, 6);
  });

  it('MEMBEDAKAN meja kosong dari uang yang tidak terbaca yakin', () => {
    // Ini pembedaan yang menentukan pengalaman pengguna. Tanpa itu, sistem
    // membisu padahal pengguna sudah mengarahkan kamera ke uang.
    const kosong = buatTensor([{ cx: 0, cy: 0, w: 0, h: 0, kelas: 0, skor: 0.02 }]);
    expect(dekode(kosong, lbPersegi, AMBANG_KEYAKINAN)).toEqual({
      lolos: [],
      ditolakGating: 0,
    });

    const ragu = buatTensor([{ cx: 160, cy: 160, w: 80, h: 80, kelas: 5, skor: 0.6 }]);
    const hasil = dekode(ragu, lbPersegi, AMBANG_KEYAKINAN);
    expect(hasil.lolos).toEqual([]);
    expect(hasil.ditolakGating).toBe(1);
  });

  it('skor tepat di AMBANG_MINAT belum dihitung sebagai objek ragu', () => {
    const tepat = buatTensor([
      { cx: 160, cy: 160, w: 80, h: 80, kelas: 5, skor: AMBANG_MINAT - 1e-6 },
    ]);
    expect(dekode(tepat, lbPersegi, AMBANG_KEYAKINAN).ditolakGating).toBe(0);
  });

  it('skor tepat di ambang keyakinan diloloskan', () => {
    // Skornya menempuh Float32Array lebih dulu, dan tidak semua pecahan
    // desimal bertahan utuh di sana: 0,70 menjadi 0,699999988, yang JATUH DI
    // BAWAH ambangnya sendiri. Karena itu batasnya dibandingkan dalam presisi
    // yang sama dengan tempat angka itu benar-benar hidup.
    //
    // Ini tidak melonggarkan apa pun — gating tetap `>=` terhadap ambang yang
    // sama. Yang diperbaiki hanya anggapan bahwa nilai desimal selamat dari
    // perjalanan ke float32. Selama ambangnya 0,85 anggapan itu kebetulan
    // benar, dan ADR-0010 menyingkapnya.
    const ambang32 = Math.fround(AMBANG_KEYAKINAN);
    const data = buatTensor([
      { cx: 160, cy: 160, w: 80, h: 80, kelas: 5, skor: ambang32 },
    ]);
    expect(dekode(data, lbPersegi, ambang32).lolos).toHaveLength(1);
  });

  it('tensor kosong tidak menghasilkan error', () => {
    expect(dekode(new Float32Array(0), lbPersegi, AMBANG_KEYAKINAN)).toEqual({
      lolos: [],
      ditolakGating: 0,
    });
  });

  it('membaca tata letak [kanal][jangkar], bukan [jangkar][kanal]', () => {
    // Kalau tata letaknya salah dibaca, kotak akan tampak acak dan tes ini
    // gagal. Ini jebakan klasik yang memakan waktu berjam-jam kalau lolos.
    const data = buatTensor(
      [
        { cx: 80, cy: 80, w: 40, h: 40, kelas: 1, skor: 0.9 },
        { cx: 240, cy: 240, w: 40, h: 40, kelas: 2, skor: 0.92 },
      ],
      8,
    );
    const { lolos } = dekode(data, lbPersegi, AMBANG_KEYAKINAN);
    expect(lolos).toHaveLength(2);
    expect(lolos[0]?.kotak.x).toBeCloseTo((80 - 20) / 320, 6);
    expect(lolos[1]?.kotak.x).toBeCloseTo((240 - 20) / 320, 6);
  });
});
