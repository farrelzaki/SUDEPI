/**
 * Pemisah kata: menemukan di mana ucapan mulai dan berhenti.
 *
 * Fungsi murni atas energi tiap bingkai.
 *
 * KENAPA INI YANG PALING MENENTUKAN. Pencocokan kata bekerja sangat baik bila
 * yang dicocokkan memang satu kata utuh, dan gagal total bila potongannya
 * memuat separuh kata berikutnya atau setengah detik keheningan. Seluruh
 * akurasi pengenalan bertumpu pada langkah ini, bukan pada pencocokannya.
 *
 * AMBANGNYA MENYESUAIKAN DIRI, bukan angka tetap. Ruangan yang sunyi dan pasar
 * yang ramai punya lantai derau yang berbeda puluhan desibel; ambang tetap yang
 * bekerja di satu tempat akan mendengar keheningan sebagai ucapan di tempat
 * lain. Karena itu lantai derau diukur dari rekamannya sendiri.
 */

/** Rentang bingkai yang berisi ucapan. Keduanya inklusif-awal, eksklusif-akhir. */
export interface Rentang {
  readonly mulai: number;
  readonly akhir: number;
}

export interface OpsiSegmen {
  /** Seberapa jauh di atas lantai derau sesuatu harus terdengar. */
  readonly margin?: number;
  /** Bingkai minimum agar sebuah bunyi dianggap kata. 10 ms per bingkai. */
  readonly minBingkai?: number;
  /** Jeda di dalam satu kata yang boleh dijembatani. */
  readonly jedaBoleh?: number;
}

/**
 * Persentil sederhana atas salinan terurut.
 *
 * Lantai derau diambil dari persentil 20, bukan dari nilai terkecil: satu
 * bingkai paling sunyi bisa saja kebetulan hampir nol dan menarik ambangnya
 * terlalu rendah.
 */
function persentil(nilai: Float32Array, bagian: number): number {
  if (nilai.length === 0) return 0;
  const urut = Array.from(nilai).sort((a, b) => a - b);
  const indeks = Math.min(
    urut.length - 1,
    Math.max(0, Math.floor(bagian * urut.length)),
  );
  return urut[indeks] ?? 0;
}

export function pisahkanKata(
  energi: Float32Array,
  opsi: OpsiSegmen = {},
): readonly Rentang[] {
  const margin = opsi.margin ?? 1.2;
  const minBingkai = opsi.minBingkai ?? 10;
  const jedaBoleh = opsi.jedaBoleh ?? 8;

  if (energi.length === 0) return [];

  const lantai = persentil(energi, 0.2);
  const puncak = persentil(energi, 0.95);

  // Rekaman yang seluruhnya sunyi: tidak ada yang bisa dipisahkan. Menganggap
  // derau sebagai kata jauh lebih merugikan daripada tidak menemukan apa pun,
  // karena ia akan menghasilkan nominal dari ketiadaan.
  if (puncak - lantai < margin) return [];

  const ambang = lantai + margin;

  const kasar: { mulai: number; akhir: number }[] = [];
  let sedangJalan: { mulai: number; akhir: number } | null = null;

  for (let i = 0; i < energi.length; i += 1) {
    const keras = (energi[i] ?? 0) > ambang;
    if (keras) {
      if (sedangJalan) sedangJalan.akhir = i + 1;
      else sedangJalan = { mulai: i, akhir: i + 1 };
    } else if (sedangJalan && i - sedangJalan.akhir >= jedaBoleh) {
      kasar.push(sedangJalan);
      sedangJalan = null;
    }
  }
  if (sedangJalan) kasar.push(sedangJalan);

  // Potongan yang terlalu pendek dibuang. Sepuluh bingkai adalah 100 ms —
  // lebih pendek dari itu bukan kata, melainkan dentum meja atau batuk.
  return kasar
    .filter((r) => r.akhir - r.mulai >= minBingkai)
    .map((r) => ({
      // Sedikit dilebihkan di kedua ujung. Konsonan awal seperti "l" dan "s"
      // energinya rendah dan sering jatuh di bawah ambang, padahal justru
      // konsonan itulah yang membedakan "lima" dari "dua".
      mulai: Math.max(0, r.mulai - 3),
      akhir: Math.min(energi.length, r.akhir + 3),
    }));
}
