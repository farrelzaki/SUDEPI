/**
 * Tes pengenal kosakata tertutup.
 *
 * Seluruhnya dijalankan TANPA mikrofon. Gelombang suaranya dibangkitkan:
 * setiap "kata" tiruan adalah campuran nada dengan bentuk spektrum yang khas,
 * dipisahkan keheningan — persis struktur yang dihadapi rantai ini pada ucapan
 * sungguhan.
 *
 * Yang diuji bukan apakah ia mengenali suara manusia — itu hanya bisa dibuktikan
 * dengan manusia. Yang diuji adalah bahwa rantainya benar: ciri yang dihitung
 * membedakan bunyi yang berbeda, pemisah kata menemukan batas yang benar,
 * pencocokan memilih yang paling mirip, dan yang paling penting — ia MENOLAK
 * saat tidak yakin.
 */

import { describe, expect, it } from 'vitest';
import {
  DIMENSI_CIRI,
  hitungMfcc,
  JUMLAH_KOEFISIEN,
  LAJU,
  LONCAT_BINGKAI,
  PANJANG_BINGKAI,
  tambahDelta,
} from './mfcc';
import { pisahkanKata } from './segmen';
import { jarakDtw } from './dtw';
import {
  ciriSatuKata,
  cocokkanKata,
  dengarNominal,
  type Contoh,
} from './pengenal';

/* ------------------------------------------------------- pembangkit suara */

/** Nada majemuk dengan bentuk spektrum tertentu, ditambah sedikit derau. */
function bunyi(
  frekuensi: readonly number[],
  detik: number,
  amplitudo = 0.3,
): Float32Array {
  const n = Math.round(LAJU * detik);
  const keluar = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    let x = 0;
    for (const f of frekuensi) x += Math.sin((2 * Math.PI * f * i) / LAJU);
    // Selubung landai di kedua ujung, seperti kata yang diucapkan manusia.
    const selubung = Math.sin((Math.PI * i) / n);
    keluar[i] = (x / frekuensi.length) * amplitudo * selubung;
  }
  return keluar;
}

function sunyi(detik: number): Float32Array {
  const n = Math.round(LAJU * detik);
  const keluar = new Float32Array(n);
  // Derau latar yang sangat pelan. Keheningan sempurna tidak pernah ada di
  // dunia nyata, dan pemisah kata harus tetap bekerja tanpa keheningan itu.
  for (let i = 0; i < n; i += 1) keluar[i] = (Math.random() - 0.5) * 0.002;
  return keluar;
}

function sambung(...bagian: readonly Float32Array[]): Float32Array {
  let panjang = 0;
  for (const b of bagian) panjang += b.length;
  const keluar = new Float32Array(panjang);
  let posisi = 0;
  for (const b of bagian) {
    keluar.set(b, posisi);
    posisi += b.length;
  }
  return keluar;
}

/** Bunyi khas per kata tiruan. Bentuk spektrumnya sengaja berjauhan. */
const NADA: Record<string, readonly number[]> = {
  lima: [320, 640, 1280],
  puluh: [500, 1500, 2500],
  ribu: [800, 1100, 3400],
  dua: [220, 900, 2000],
};

/** Rekaman pendek berisi satu kata, dikelilingi keheningan. */
function ucapan(frekuensi: readonly number[], detik = 0.3): Float32Array {
  return sambung(sunyi(0.2), bunyi(frekuensi, detik), sunyi(0.2));
}

/** Ciri satu kata, lewat jalur yang sama persis dengan pelatihan sungguhan. */
function ciri(frekuensi: readonly number[], detik = 0.3) {
  return ciriSatuKata(ucapan(frekuensi, detik)) ?? [];
}

function contohDari(kata: string, detik = 0.3): Contoh {
  // Lewat jalur yang sama persis dengan pelatihan suara sungguhan: rekaman
  // pendek berisi satu kata, dipisahkan, lalu dinormalkan per potongan.
  return { kata, bingkai: ciri(NADA[kata] ?? [440], detik) };
}

/* -------------------------------------------------------------------- mfcc */

describe('hitungMfcc', () => {
  it('menghasilkan bingkai sebanyak yang seharusnya', () => {
    const contoh = bunyi([440], 1);
    const { bingkai } = hitungMfcc(contoh);
    const seharusnya =
      1 + Math.floor((contoh.length - PANJANG_BINGKAI) / LONCAT_BINGKAI);
    expect(bingkai).toHaveLength(seharusnya);
  });

  it('suara yang lebih pendek dari satu bingkai tidak menghasilkan apa-apa', () => {
    expect(hitungMfcc(new Float32Array(100)).bingkai).toHaveLength(0);
  });

  it('energi keheningan jauh di bawah energi bunyi', () => {
    const { energi } = hitungMfcc(sambung(sunyi(0.3), bunyi([440], 0.3)));
    const awal = energi[2] ?? 0;
    const tengah = energi[Math.floor(energi.length * 0.75)] ?? 0;
    expect(tengah).toBeGreaterThan(awal + 3);
  });

  it('bunyi berbeda menghasilkan ciri yang berbeda', () => {
    // Kalau ini gagal, seluruh pendekatan runtuh: ciri yang tidak membedakan
    // apa pun membuat setiap kata terlihat sama.
    const a = ciri(NADA.lima ?? []);
    const b = ciri(NADA.ribu ?? []);
    expect(jarakDtw(a, b)).toBeGreaterThan(5);
  });
});

/* ------------------------------------------------------------------ delta */

describe('tambahDelta', () => {
  function deret(nilai: readonly number[][]): Float32Array[] {
    return nilai.map((baris) => {
      const b = new Float32Array(JUMLAH_KOEFISIEN);
      baris.forEach((x, i) => {
        b[i] = x;
      });
      return b;
    });
  }

  it('menghasilkan ciri berdimensi 39', () => {
    const hasil = tambahDelta(deret([[1], [1], [1], [1], [1]]));
    expect(hasil[0]).toHaveLength(DIMENSI_CIRI);
  });

  it('bingkai yang TETAP tidak menghasilkan gerakan', () => {
    // Kalau ini gagal, delta memasukkan gerakan palsu ke ucapan yang diam —
    // dan jarak antar kata akan didominasi derau, bukan ciri.
    const hasil = tambahDelta(deret([[5], [5], [5], [5], [5]]));
    expect(hasil[2]?.[JUMLAH_KOEFISIEN]).toBeCloseTo(0, 6);
  });

  it('bingkai yang MENAIK menghasilkan gerakan positif', () => {
    const hasil = tambahDelta(deret([[1], [2], [3], [4], [5]]));
    expect(hasil[2]?.[JUMLAH_KOEFISIEN] ?? 0).toBeGreaterThan(0);
  });

  it('bingkai yang MENURUN menghasilkan gerakan negatif', () => {
    const hasil = tambahDelta(deret([[5], [4], [3], [2], [1]]));
    expect(hasil[2]?.[JUMLAH_KOEFISIEN] ?? 0).toBeLessThan(0);
  });

  it('tiga belas koefisien pertama tidak diubah', () => {
    const asal = deret([[1, 2], [3, 4], [5, 6]]);
    const hasil = tambahDelta(asal);
    expect(hasil[1]?.[0]).toBeCloseTo(3, 6);
    expect(hasil[1]?.[1]).toBeCloseTo(4, 6);
  });

  it('deret kosong tidak menghasilkan apa-apa', () => {
    expect(tambahDelta([])).toHaveLength(0);
  });
});

/* ----------------------------------------------------------------- segmen */

describe('pisahkanKata', () => {
  it('menemukan tiga kata yang dipisahkan jeda', () => {
    const suara = sambung(
      sunyi(0.3),
      bunyi(NADA.lima ?? [], 0.3),
      sunyi(0.25),
      bunyi(NADA.puluh ?? [], 0.3),
      sunyi(0.25),
      bunyi(NADA.ribu ?? [], 0.3),
      sunyi(0.3),
    );
    const { energi } = hitungMfcc(suara);
    expect(pisahkanKata(energi)).toHaveLength(3);
  });

  it('rekaman yang seluruhnya sunyi tidak menghasilkan kata', () => {
    // Menganggap derau sebagai kata jauh lebih merugikan daripada tidak
    // menemukan apa pun: ia melahirkan nominal dari ketiadaan.
    const { energi } = hitungMfcc(sunyi(2));
    expect(pisahkanKata(energi)).toHaveLength(0);
  });

  it('dentum sesaat tidak dianggap kata', () => {
    const { energi } = hitungMfcc(
      sambung(sunyi(0.4), bunyi([300], 0.03), sunyi(0.4)),
    );
    expect(pisahkanKata(energi)).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------- dtw */

describe('jarakDtw', () => {
  it('deret yang sama persis berjarak nol', () => {
    const a = hitungMfcc(bunyi([440], 0.3)).bingkai;
    expect(jarakDtw(a, a)).toBeCloseTo(0, 5);
  });

  it('bunyi sama dengan panjang berbeda tetap dekat', () => {
    // Inilah alasan DTW dipakai: orang tidak pernah mengucapkan kata yang sama
    // dengan panjang yang sama.
    const pendek = hitungMfcc(bunyi(NADA.lima ?? [], 0.25)).bingkai;
    const panjang = hitungMfcc(bunyi(NADA.lima ?? [], 0.45)).bingkai;
    const beda = hitungMfcc(bunyi(NADA.ribu ?? [], 0.25)).bingkai;

    expect(jarakDtw(pendek, panjang)).toBeLessThan(jarakDtw(pendek, beda));
  });

  it('deret kosong dianggap sangat jauh, bukan sangat mirip', () => {
    const a = hitungMfcc(bunyi([440], 0.3)).bingkai;
    expect(jarakDtw(a, [])).toBe(Infinity);
    expect(jarakDtw([], [])).toBe(Infinity);
  });
});

/* -------------------------------------------------------------- pencocokan */

describe('cocokkanKata', () => {
  const pustaka = [
    contohDari('lima'),
    contohDari('puluh'),
    contohDari('ribu'),
    contohDari('dua'),
  ];

  it('memilih kata yang benar', () => {
    // Diucapkan sedikit lebih panjang daripada contohnya, seperti manusia.
    const potongan = ciri(NADA.puluh ?? [], 0.36);
    expect(cocokkanKata(potongan, pustaka)?.kata).toBe('puluh');
  });

  it('menolak bunyi yang tidak mirip apa pun', () => {
    // Gerbang pertama. Tanpa ini, batuk akan dipaksa menjadi kata terdekat,
    // dan kata itu akan menjadi bagian dari nominal uang.
    const asing = ciri([60, 95], 0.3);
    expect(cocokkanKata(asing, pustaka, { jarakMaks: 8 })).toBeNull();
  });

  it('menolak saat dua kata sama-sama mendekati', () => {
    // Gerbang kedua, dan yang paling menentukan dalam praktik. "Tujuh" dan
    // "puluh" berbunyi mirip; memilih salah satunya secara asal berarti
    // selisih sepuluh kali lipat pada nominal uang.
    //
    // Keadaan itu ditiru dengan dua contoh yang bunyinya sama persis tetapi
    // diberi nama berbeda — bentuk paling murni dari "sistem tidak punya dasar
    // untuk memilih".
    const sama = ciri(NADA.lima ?? [], 0.3);
    const membingungkan = [
      { kata: 'tujuh', bingkai: sama },
      { kata: 'puluh', bingkai: sama },
    ];
    expect(cocokkanKata(sama, membingungkan)).toBeNull();
  });

  it('tanpa contoh apa pun, tidak pernah menebak', () => {
    const potongan = ciri(NADA.lima ?? [], 0.3);
    expect(cocokkanKata(potongan, [])).toBeNull();
  });
});

describe('contoh latih yang cacat', () => {
  it('rekaman sunyi tidak boleh menjadi contoh', () => {
    // Contoh latih yang berisi keheningan meracuni seluruh pengenalan
    // sesudahnya tanpa pernah terlihat: ia menarik setiap ucapan lain ke arah
    // yang salah, dan tidak ada gejalanya selain akurasi yang buruk.
    expect(ciriSatuKata(sunyi(1.5))).toBeNull();
  });

  it('dentum sesaat tidak boleh menjadi contoh', () => {
    expect(ciriSatuKata(sambung(sunyi(0.4), bunyi([300], 0.04), sunyi(0.4)))).toBeNull();
  });

  it('ucapan yang wajar diterima', () => {
    expect(ciriSatuKata(ucapan(NADA.lima ?? []))).not.toBeNull();
  });
});

describe('beberapa contoh per kata', () => {
  it('memakai contoh TERDEKAT, bukan yang pertama', () => {
    // Dua contoh untuk kata yang sama, satu jauh dan satu dekat. Kata itu
    // harus dinilai dari yang terdekat — kalau tidak, menambah contoh justru
    // memperburuk pengenalan, dan seluruh gagasan melatih dua kali runtuh.
    const pustaka: Contoh[] = [
      { kata: 'lima', bingkai: ciri(NADA.dua ?? [], 0.3) },
      { kata: 'lima', bingkai: ciri(NADA.lima ?? [], 0.3) },
      { kata: 'ribu', bingkai: ciri(NADA.ribu ?? [], 0.3) },
    ];
    const potongan = ciri(NADA.lima ?? [], 0.34);
    expect(cocokkanKata(potongan, pustaka)?.kata).toBe('lima');
  });
});

/* ------------------------------------------------------------- rantai utuh */

describe('dengarNominal', () => {
  const pustaka = [
    contohDari('lima'),
    contohDari('puluh'),
    contohDari('ribu'),
    contohDari('dua'),
  ];

  it('membaca "lima puluh ribu" menjadi 50000', () => {
    const suara = sambung(
      sunyi(0.25),
      bunyi(NADA.lima ?? [], 0.3),
      sunyi(0.2),
      bunyi(NADA.puluh ?? [], 0.3),
      sunyi(0.2),
      bunyi(NADA.ribu ?? [], 0.3),
      sunyi(0.25),
    );
    const hasil = dengarNominal(suara, pustaka);
    expect(hasil.kata).toEqual(['lima', 'puluh', 'ribu']);
    expect(hasil.nominal).toBe(50_000);
  });

  it('membaca "dua ribu" menjadi 2000', () => {
    const suara = sambung(
      sunyi(0.25),
      bunyi(NADA.dua ?? [], 0.3),
      sunyi(0.2),
      bunyi(NADA.ribu ?? [], 0.3),
      sunyi(0.25),
    );
    expect(dengarNominal(suara, pustaka).nominal).toBe(2_000);
  });

  it('keheningan tidak menghasilkan nominal apa pun', () => {
    const hasil = dengarNominal(sunyi(2), pustaka);
    expect(hasil.nominal).toBeNull();
    expect(hasil.kata).toHaveLength(0);
  });

  it('tanpa contoh suara, tidak pernah menghasilkan nominal', () => {
    // Keadaan sebelum pengguna melatih suaranya. Fitur harus diam, bukan
    // menebak dari pustaka kosong.
    const suara = sambung(sunyi(0.2), bunyi(NADA.lima ?? [], 0.3), sunyi(0.2));
    expect(dengarNominal(suara, []).nominal).toBeNull();
  });

  it('melewati kata asing di tengah, bukan membatalkan seluruh ucapan', () => {
    // Orang sering menambahkan kata di luar kosakata: "totalnya lima puluh
    // ribu". Menolak seluruh kalimat karena satu kata asing membuat fitur ini
    // terasa rewel tanpa menambah keamanan apa pun.
    const suara = sambung(
      sunyi(0.2),
      bunyi([60, 95], 0.3), // bunyi asing
      sunyi(0.2),
      bunyi(NADA.lima ?? [], 0.3),
      sunyi(0.2),
      bunyi(NADA.ribu ?? [], 0.3),
      sunyi(0.2),
    );
    const hasil = dengarNominal(suara, pustaka, { jarakMaks: 12 });
    expect(hasil.nominal).toBe(5_000);
    expect(hasil.jumlahPotongan).toBe(3);
  });
});
