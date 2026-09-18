/**
 * Decode keluaran mentah YOLOv8 dan pembalikan letterbox.
 *
 * Fungsi murni. Tanpa I/O, tanpa state.
 *
 * Model diekspor tanpa NMS (ADR-0002), jadi yang keluar adalah tensor mentah
 * berbentuk `[1, 12, 2100]` pada `imgsz=320` dengan 8 kelas:
 *
 *   12 kanal  = 4 koordinat kotak + 8 skor kelas
 *   2100      = 40x40 + 20x20 + 10x10 jangkar
 *
 * Tata letaknya `[batch, kanal, jangkar]`, sehingga nilai kanal `c` pada
 * jangkar `a` berada di `data[c * jumlahJangkar + a]` — BUKAN berurutan per
 * jangkar. Salah membaca tata letak ini menghasilkan kotak yang tampak acak,
 * dan itu jebakan klasik yang memakan waktu berjam-jam kalau tidak disadari.
 *
 * Koordinat kotak keluar dalam piksel ruang masukan model (0..320) dengan
 * titik acuan TENGAH kotak. Kontrak kita memakai sudut kiri-atas yang
 * ternormalisasi terhadap bingkai asli, jadi keduanya dikonversi di sini.
 */

import { JUMLAH_KELAS, denominasiDariKode, type Deteksi } from '@/contracts';

/** 4 koordinat kotak + skor tiap kelas. */
export const JUMLAH_KANAL = 4 + JUMLAH_KELAS;

/**
 * Ambang "ada sesuatu di sana, tapi saya tidak yakin".
 *
 * Bukan ambang keputusan — ambang keputusan adalah `AMBANG_KEYAKINAN` (0,70).
 * Nilai ini hanya dipakai untuk MENGHITUNG berapa banyak objek yang terlihat
 * namun gagal lolos, sehingga sistem bisa membedakan dua keadaan yang sangat
 * berbeda bagi pengguna:
 *
 *   - kamera menghadap meja kosong          -> diam saja
 *   - ada uang tapi tidak terbaca yakin     -> "belum yakin, coba pindai lagi"
 *
 * Tanpa pembedaan ini, sistem akan membisu saat pengguna sudah mengarahkan
 * kamera ke uang, dan pengguna tidak tahu harus berbuat apa.
 */
export const AMBANG_MINAT = 0.25;

export interface Letterbox {
  /** Faktor perkecil dari bingkai asli ke kotak model. */
  readonly skala: number;
  /** Bantalan kiri, dalam piksel ruang masukan model. */
  readonly padX: number;
  /** Bantalan atas, dalam piksel ruang masukan model. */
  readonly padY: number;
  readonly lebarAsli: number;
  readonly tinggiAsli: number;
}

/**
 * Menghitung parameter letterbox.
 *
 * Bingkai diperkecil dengan mempertahankan rasio, lalu diberi bantalan agar
 * pas di kotak `ukuran x ukuran`. Meregangkan bingkai tanpa menjaga rasio
 * jauh lebih gampang ditulis, tapi menurunkan mAP secara nyata karena bentuk
 * uang jadi berbeda dari yang dilihat model saat dilatih.
 */
export function hitungLetterbox(
  lebarAsli: number,
  tinggiAsli: number,
  ukuran: number,
): Letterbox {
  const skala = Math.min(ukuran / lebarAsli, ukuran / tinggiAsli);
  return {
    skala,
    padX: (ukuran - lebarAsli * skala) / 2,
    padY: (ukuran - tinggiAsli * skala) / 2,
    lebarAsli,
    tinggiAsli,
  };
}

export interface HasilDekode {
  /** Sudah lolos ambang keyakinan. Belum lewat NMS. */
  readonly lolos: readonly Deteksi[];
  /**
   * Banyaknya jangkar yang melewati AMBANG_MINAT tetapi gagal mencapai ambang
   * keyakinan. Lebih dari nol berarti "ada uang di sana tapi saya tidak yakin",
   * yang memicu Abstain — bukan diam.
   */
  readonly ditolakGating: number;
}

/**
 * Mengubah tensor mentah menjadi daftar deteksi pada koordinat bingkai asli.
 */
export function dekode(
  data: Float32Array | readonly number[],
  lb: Letterbox,
  ambangKeyakinan: number,
): HasilDekode {
  const jumlahJangkar = Math.floor(data.length / JUMLAH_KANAL);
  const lolos: Deteksi[] = [];
  let ditolakGating = 0;

  const ambil = (kanal: number, jangkar: number): number =>
    data[kanal * jumlahJangkar + jangkar] ?? 0;

  for (let a = 0; a < jumlahJangkar; a += 1) {
    // Cari kelas dengan skor tertinggi pada jangkar ini.
    let kelasTerbaik = -1;
    let skorTerbaik = 0;
    for (let k = 0; k < JUMLAH_KELAS; k += 1) {
      const skor = ambil(4 + k, a);
      if (skor > skorTerbaik) {
        skorTerbaik = skor;
        kelasTerbaik = k;
      }
    }

    if (kelasTerbaik < 0 || skorTerbaik < AMBANG_MINAT) continue;

    if (skorTerbaik < ambangKeyakinan) {
      ditolakGating += 1;
      continue;
    }

    const d = denominasiDariKode(kelasTerbaik);
    // Kelas di luar tabel berarti model dan kontrak tidak sinkron. Lewati
    // saja — lebih baik kehilangan satu deteksi daripada menyebut nominal
    // yang tidak jelas asalnya.
    if (!d) continue;

    const cx = ambil(0, a);
    const cy = ambil(1, a);
    const lebar = ambil(2, a);
    const tinggi = ambil(3, a);

    lolos.push({
      kodeKelas: kelasTerbaik,
      nominal: d.nominal,
      koin: d.koin,
      skor: skorTerbaik,
      kotak: keKoordinatAsli(cx, cy, lebar, tinggi, lb),
      iouMaks: 0,
    });
  }

  return { lolos, ditolakGating };
}

/**
 * Membalik letterbox: dari titik tengah pada ruang masukan model menjadi sudut
 * kiri-atas yang ternormalisasi terhadap bingkai asli.
 */
function keKoordinatAsli(
  cx: number,
  cy: number,
  lebar: number,
  tinggi: number,
  lb: Letterbox,
): Deteksi['kotak'] {
  // Titik tengah -> sudut kiri-atas, masih di ruang masukan model.
  const kiri = cx - lebar / 2;
  const atas = cy - tinggi / 2;

  // Buang bantalan, lalu kembalikan skalanya ke piksel bingkai asli.
  const kiriAsli = (kiri - lb.padX) / lb.skala;
  const atasAsli = (atas - lb.padY) / lb.skala;
  const lebarAsli = lebar / lb.skala;
  const tinggiAsli = tinggi / lb.skala;

  return {
    x: kiriAsli / lb.lebarAsli,
    y: atasAsli / lb.tinggiAsli,
    w: lebarAsli / lb.lebarAsli,
    h: tinggiAsli / lb.tinggiAsli,
  };
}
