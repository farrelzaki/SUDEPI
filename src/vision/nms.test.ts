import { describe, expect, it } from 'vitest';
import { AMBANG_IOU, AMBANG_KEYAKINAN, type Deteksi, type Kotak } from '@/contracts';
import { gating, iou, nms } from './nms';

function d(
  kodeKelas: number,
  skor: number,
  kotak: Kotak,
): Deteksi {
  return { kodeKelas, nominal: null, koin: false, skor, kotak, iouMaks: 0 };
}

const kotak = (x: number, y: number, w: number, h: number): Kotak => ({ x, y, w, h });

describe('iou', () => {
  it('kotak identik bernilai 1', () => {
    expect(iou(kotak(0, 0, 1, 1), kotak(0, 0, 1, 1))).toBe(1);
  });

  it('kotak terpisah bernilai 0', () => {
    expect(iou(kotak(0, 0, 0.2, 0.2), kotak(0.5, 0.5, 0.2, 0.2))).toBe(0);
  });

  it('kotak bersentuhan tepi bernilai 0, bukan negatif', () => {
    expect(iou(kotak(0, 0, 0.5, 0.5), kotak(0.5, 0, 0.5, 0.5))).toBe(0);
  });

  it('tumpang tindih separuh', () => {
    // Dua kotak 1x1, digeser 0,5 arah x. Irisan 0,5; gabungan 1,5.
    expect(iou(kotak(0, 0, 1, 1), kotak(0.5, 0, 1, 1))).toBeCloseTo(1 / 3, 6);
  });

  it('simetris', () => {
    const a = kotak(0.1, 0.1, 0.4, 0.3);
    const b = kotak(0.2, 0.15, 0.4, 0.3);
    expect(iou(a, b)).toBeCloseTo(iou(b, a), 12);
  });

  it('kotak berluas nol tidak menghasilkan NaN', () => {
    expect(iou(kotak(0, 0, 0, 0), kotak(0, 0, 0, 0))).toBe(0);
  });
});

describe('nms class-agnostic', () => {
  it('menyatukan lembar yang sama terbaca dua kali', () => {
    // Satu lembar uang, dua kotak hampir berimpit, skor berbeda.
    const hasil = nms(
      [d(5, 0.91, kotak(0.1, 0.1, 0.5, 0.3)), d(5, 0.97, kotak(0.11, 0.1, 0.5, 0.3))],
      AMBANG_IOU,
    );
    expect(hasil).toHaveLength(1);
    expect(hasil[0]?.skor).toBe(0.97);
  });

  it('MENYATUKAN kotak bertindihan walau kelasnya berbeda', () => {
    // Inilah alasan class-agnostic. Satu benda fisik terbaca 50.000 dan juga
    // 20.000 dengan skor lebih rendah. NMS per kelas akan meloloskan keduanya
    // dan sistem menyebut dua nominal untuk satu lembar uang.
    const hasil = nms(
      [d(5, 0.95, kotak(0.1, 0.1, 0.5, 0.3)), d(4, 0.88, kotak(0.12, 0.11, 0.5, 0.3))],
      AMBANG_IOU,
    );
    expect(hasil).toHaveLength(1);
    expect(hasil[0]?.kodeKelas).toBe(5);
  });

  it('mempertahankan lembar terpisah yang memang berbeda', () => {
    const hasil = nms(
      [
        d(5, 0.95, kotak(0.05, 0.05, 0.3, 0.2)),
        d(4, 0.93, kotak(0.05, 0.45, 0.3, 0.2)),
        d(2, 0.9, kotak(0.05, 0.75, 0.3, 0.2)),
      ],
      AMBANG_IOU,
    );
    expect(hasil).toHaveLength(3);
  });

  it('lembar bertumpuk ringan di bawah ambang tetap dihitung dua', () => {
    // Tumpang tindih ~14%, di bawah ambang 0,40: dua lembar yang direnggangkan.
    const hasil = nms(
      [d(5, 0.95, kotak(0, 0, 0.4, 0.4)), d(5, 0.94, kotak(0.3, 0, 0.4, 0.4))],
      AMBANG_IOU,
    );
    expect(hasil).toHaveLength(2);
  });

  it('mengisi iouMaks sebagai jejak audit', () => {
    const hasil = nms(
      [d(5, 0.95, kotak(0, 0, 0.4, 0.4)), d(5, 0.94, kotak(0.3, 0, 0.4, 0.4))],
      AMBANG_IOU,
    );
    expect(hasil[0]?.iouMaks).toBeGreaterThan(0);
    expect(hasil[0]?.iouMaks).toBeLessThan(AMBANG_IOU);
  });

  it('keluaran terurut menurun berdasarkan skor', () => {
    const hasil = nms(
      [
        d(1, 0.88, kotak(0, 0, 0.2, 0.2)),
        d(2, 0.96, kotak(0, 0.5, 0.2, 0.2)),
        d(3, 0.91, kotak(0.5, 0, 0.2, 0.2)),
      ],
      AMBANG_IOU,
    );
    expect(hasil.map((x) => x.skor)).toEqual([0.96, 0.91, 0.88]);
  });

  it('larik kosong dan satu elemen ditangani tanpa error', () => {
    expect(nms([], AMBANG_IOU)).toEqual([]);
    expect(nms([d(5, 0.9, kotak(0, 0, 1, 1))], AMBANG_IOU)).toHaveLength(1);
  });

  it('tidak mengubah larik milik pemanggil', () => {
    const masukan = [
      d(1, 0.5, kotak(0, 0, 0.2, 0.2)),
      d(2, 0.9, kotak(0.5, 0.5, 0.2, 0.2)),
    ];
    const salinan = structuredClone(masukan);
    nms(masukan, AMBANG_IOU);
    expect(masukan).toEqual(salinan);
  });

  it('tumpukan rapat banyak lembar menyusut jadi satu', () => {
    const bertumpuk = Array.from({ length: 6 }, (_, i) =>
      d(5, 0.9 + i * 0.01, kotak(0.1 + i * 0.01, 0.1, 0.5, 0.3)),
    );
    expect(nms(bertumpuk, AMBANG_IOU)).toHaveLength(1);
  });
});

describe('gating', () => {
  it('membuang yang di bawah ambang, menahan yang tepat di ambang', () => {
    const hasil = gating(
      [
        d(1, 0.84, kotak(0, 0, 0.2, 0.2)),
        d(2, AMBANG_KEYAKINAN, kotak(0, 0, 0.2, 0.2)),
        d(3, 0.99, kotak(0, 0, 0.2, 0.2)),
      ],
      AMBANG_KEYAKINAN,
    );
    expect(hasil.map((x) => x.kodeKelas)).toEqual([2, 3]);
  });

  it('mengembalikan kosong kalau tidak ada yang lolos', () => {
    expect(gating([d(1, 0.5, kotak(0, 0, 1, 1))], AMBANG_KEYAKINAN)).toEqual([]);
  });
});
