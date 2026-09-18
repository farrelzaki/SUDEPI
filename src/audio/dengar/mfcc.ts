/**
 * Ciri suara: MFCC (Mel-Frequency Cepstral Coefficients).
 *
 * Fungsi murni. Mengubah gelombang mentah menjadi deretan vektor ciri yang
 * bisa dibandingkan antar ucapan.
 *
 * KENAPA TIDAK MEMBANDINGKAN GELOMBANGNYA LANGSUNG. Dua orang mengucapkan
 * "lima" menghasilkan gelombang yang sama sekali berbeda bentuknya, bahkan satu
 * orang yang mengucapkannya dua kali. Yang sama di antara keduanya bukan
 * gelombangnya melainkan BENTUK SPEKTRUMNYA — di mana energi berkumpul
 * sepanjang pita frekuensi, dan bagaimana kumpulan itu bergerak sepanjang waktu.
 *
 * MFCC adalah cara baku menangkap bentuk itu, dan setiap langkahnya punya
 * alasan yang bisa dijelaskan:
 *
 *   1. Pra-penekanan  — menaikkan nada tinggi yang secara alami lebih lemah,
 *                       supaya konsonan tidak tenggelam oleh vokal.
 *   2. Pembingkaian   — ucapan hanya tetap selama ~25 ms, jadi dianalisis
 *                       dalam potongan sependek itu.
 *   3. Jendela Hamming— melandaikan tepi potongan; tepi yang terpotong tajam
 *                       memunculkan frekuensi palsu yang tidak pernah diucapkan.
 *   4. Spektrum daya  — berapa banyak energi di tiap frekuensi.
 *   5. Tapis mel      — mengelompokkan frekuensi seperti telinga manusia
 *                       mengelompokkannya: rapat di nada rendah, renggang di
 *                       nada tinggi.
 *   6. Logaritma      — telinga menangkap kenyaringan secara logaritmik.
 *   7. DCT            — memisahkan bentuk spektrum dari nada dasar suara
 *                       orangnya, sehingga suara berat dan suara ringan yang
 *                       mengucapkan kata sama menjadi lebih mirip.
 *
 * Langkah terakhirnya, pengurangan rerata cepstral, membuang warna mikrofon
 * dan ruangan. Tanpa itu, contoh suara yang direkam di dapur tidak bisa
 * dibandingkan dengan yang direkam di pasar.
 */

export const LAJU = 16_000;
/** 25 ms. Cukup pendek agar ucapan dianggap tetap, cukup panjang untuk resolusi. */
export const PANJANG_BINGKAI = 400;
/** 10 ms. Bingkai saling tindih supaya perubahan cepat tidak terlewat. */
export const LONCAT_BINGKAI = 160;
/** Pangkat dua terdekat di atas panjang bingkai. FFT menuntutnya. */
const UKURAN_FFT = 512;
const JUMLAH_TAPIS = 26;
/** Koefisien yang disimpan. Di atas 13, isinya lebih banyak derau daripada ciri. */
export const JUMLAH_KOEFISIEN = 13;
const FREKUENSI_RENDAH = 80;
const FREKUENSI_TINGGI = 7600;

/** Satu bingkai ciri. Panjangnya selalu `JUMLAH_KOEFISIEN`. */
export type Bingkai = Float32Array;

/* ------------------------------------------------------------------- mel */

const keMel = (hz: number): number => 2595 * Math.log10(1 + hz / 700);
const dariMel = (mel: number): number => 700 * (10 ** (mel / 2595) - 1);

/**
 * Bank tapis segitiga pada skala mel.
 *
 * Dihitung sekali lalu dipakai ulang. Membangunnya tiap bingkai berarti
 * membangun dua puluh enam segitiga dua ratus kali untuk satu ucapan.
 */
function buatBankTapis(): Float32Array[] {
  const melRendah = keMel(FREKUENSI_RENDAH);
  const melTinggi = keMel(FREKUENSI_TINGGI);
  const titik: number[] = [];

  for (let i = 0; i < JUMLAH_TAPIS + 2; i += 1) {
    const mel = melRendah + ((melTinggi - melRendah) * i) / (JUMLAH_TAPIS + 1);
    titik.push(Math.floor(((UKURAN_FFT + 1) * dariMel(mel)) / LAJU));
  }

  const bank: Float32Array[] = [];
  for (let i = 1; i <= JUMLAH_TAPIS; i += 1) {
    const tapis = new Float32Array(UKURAN_FFT / 2 + 1);
    const kiri = titik[i - 1] ?? 0;
    const puncak = titik[i] ?? 0;
    const kanan = titik[i + 1] ?? 0;

    for (let k = kiri; k < puncak; k += 1) {
      if (puncak > kiri) tapis[k] = (k - kiri) / (puncak - kiri);
    }
    for (let k = puncak; k < kanan; k += 1) {
      if (kanan > puncak) tapis[k] = (kanan - k) / (kanan - puncak);
    }
    bank.push(tapis);
  }
  return bank;
}

const BANK_TAPIS = buatBankTapis();

/* ------------------------------------------------------------------- FFT */

/**
 * FFT radix-2 di tempat, pada larik nyata dan khayal terpisah.
 *
 * Ditulis sendiri, bukan mengambil pustaka: seluruh isinya dua puluh baris,
 * dan satu dependensi lebih sedikit berarti satu hal lebih sedikit yang bisa
 * menyeret jaringan masuk ke dalam bundel kami.
 */
function fft(nyata: Float32Array, khayal: Float32Array): void {
  const n = nyata.length;

  // Penyusunan ulang bit-terbalik.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [nyata[i], nyata[j]] = [nyata[j] ?? 0, nyata[i] ?? 0];
      [khayal[i], khayal[j]] = [khayal[j] ?? 0, khayal[i] ?? 0];
    }
  }

  for (let panjang = 2; panjang <= n; panjang <<= 1) {
    const sudut = (-2 * Math.PI) / panjang;
    const wNyata = Math.cos(sudut);
    const wKhayal = Math.sin(sudut);

    for (let i = 0; i < n; i += panjang) {
      let putarNyata = 1;
      let putarKhayal = 0;

      for (let j = 0; j < panjang / 2; j += 1) {
        const a = i + j;
        const b = i + j + panjang / 2;

        const bNyata = (nyata[b] ?? 0) * putarNyata - (khayal[b] ?? 0) * putarKhayal;
        const bKhayal = (nyata[b] ?? 0) * putarKhayal + (khayal[b] ?? 0) * putarNyata;

        nyata[b] = (nyata[a] ?? 0) - bNyata;
        khayal[b] = (khayal[a] ?? 0) - bKhayal;
        nyata[a] = (nyata[a] ?? 0) + bNyata;
        khayal[a] = (khayal[a] ?? 0) + bKhayal;

        const putarBaru = putarNyata * wNyata - putarKhayal * wKhayal;
        putarKhayal = putarNyata * wKhayal + putarKhayal * wNyata;
        putarNyata = putarBaru;
      }
    }
  }
}

/* ------------------------------------------------------------------ MFCC */

const JENDELA = (() => {
  const w = new Float32Array(PANJANG_BINGKAI);
  for (let i = 0; i < PANJANG_BINGKAI; i += 1) {
    w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (PANJANG_BINGKAI - 1));
  }
  return w;
})();

/** Energi log tiap bingkai. Dipakai memisahkan ucapan dari keheningan. */
export interface HasilMfcc {
  readonly bingkai: readonly Bingkai[];
  readonly energi: Float32Array;
}

export function hitungMfcc(contoh: Float32Array): HasilMfcc {
  if (contoh.length < PANJANG_BINGKAI) {
    return { bingkai: [], energi: new Float32Array(0) };
  }

  // Pra-penekanan. Nada tinggi pada ucapan manusia secara alami sekitar 6 dB
  // per oktaf lebih lemah; tanpa ini konsonan tenggelam oleh vokal.
  const tekan = new Float32Array(contoh.length);
  tekan[0] = contoh[0] ?? 0;
  for (let i = 1; i < contoh.length; i += 1) {
    tekan[i] = (contoh[i] ?? 0) - 0.97 * (contoh[i - 1] ?? 0);
  }

  const jumlahBingkai =
    1 + Math.floor((tekan.length - PANJANG_BINGKAI) / LONCAT_BINGKAI);
  const bingkai: Bingkai[] = [];
  const energi = new Float32Array(jumlahBingkai);

  const nyata = new Float32Array(UKURAN_FFT);
  const khayal = new Float32Array(UKURAN_FFT);
  const daya = new Float32Array(UKURAN_FFT / 2 + 1);
  const logMel = new Float32Array(JUMLAH_TAPIS);

  for (let b = 0; b < jumlahBingkai; b += 1) {
    const mulai = b * LONCAT_BINGKAI;

    nyata.fill(0);
    khayal.fill(0);
    let jumlahKuadrat = 0;
    for (let i = 0; i < PANJANG_BINGKAI; i += 1) {
      const x = tekan[mulai + i] ?? 0;
      jumlahKuadrat += x * x;
      nyata[i] = x * (JENDELA[i] ?? 0);
    }
    energi[b] = Math.log(jumlahKuadrat / PANJANG_BINGKAI + 1e-10);

    fft(nyata, khayal);
    for (let k = 0; k < daya.length; k += 1) {
      const re = nyata[k] ?? 0;
      const im = khayal[k] ?? 0;
      daya[k] = (re * re + im * im) / UKURAN_FFT;
    }

    for (let m = 0; m < JUMLAH_TAPIS; m += 1) {
      const tapis = BANK_TAPIS[m];
      let jumlah = 0;
      if (tapis) for (let k = 0; k < daya.length; k += 1) {
        jumlah += (daya[k] ?? 0) * (tapis[k] ?? 0);
      }
      logMel[m] = Math.log(jumlah + 1e-10);
    }

    // DCT-II. Koefisien ke-0 hanya kenyaringan keseluruhan dan sengaja
    // DIBUANG — ia berubah setiap kali pengguna berbicara lebih dekat atau
    // lebih jauh dari mikrofon, sementara katanya tetap sama.
    const koef = new Float32Array(JUMLAH_KOEFISIEN);
    for (let i = 0; i < JUMLAH_KOEFISIEN; i += 1) {
      let jumlah = 0;
      for (let m = 0; m < JUMLAH_TAPIS; m += 1) {
        jumlah +=
          (logMel[m] ?? 0) *
          Math.cos((Math.PI * (i + 1) * (m + 0.5)) / JUMLAH_TAPIS);
      }
      koef[i] = jumlah;
    }
    bingkai.push(koef);
  }

  return { bingkai, energi };
}

/**
 * Pengurangan rerata cepstral — DIPANGGIL PER POTONGAN KATA, bukan per rekaman.
 *
 * Perbedaan itu menentukan, dan versi pertama salah menaruhnya. Rerata yang
 * dihitung atas SELURUH rekaman ikut memuat keheningan sebelum dan sesudah
 * ucapan, dan panjang keheningan itu berbeda setiap kali. Akibatnya ciri satu
 * kata bergeser mengikuti berapa lama pengguna terdiam — sehingga contoh latih
 * yang direkam sebagai satu kata pendek tidak bisa dibandingkan dengan kata
 * yang sama di tengah kalimat panjang.
 *
 * Dihitung per potongan, rerata itu hanya memuat kata yang bersangkutan, dan
 * kedua sisi menjadi sebanding.
 *
 * Membuang apa pun yang TETAP sepanjang rekaman: warna mikrofon, gaung
 * ruangan, dengung latar. Yang tersisa hanya yang berubah — yaitu ucapannya.
 *
 * Tanpa langkah ini, contoh suara yang direkam di satu tempat nyaris tidak
 * bisa dibandingkan dengan yang direkam di tempat lain, walaupun orangnya sama
 * dan katanya sama.
 */
export function kurangiRerata(bingkai: readonly Bingkai[]): Bingkai[] {
  if (bingkai.length === 0) return [];

  const rerata = new Float32Array(JUMLAH_KOEFISIEN);
  for (const b of bingkai) {
    for (let i = 0; i < JUMLAH_KOEFISIEN; i += 1) {
      rerata[i] = (rerata[i] ?? 0) + (b[i] ?? 0);
    }
  }
  for (let i = 0; i < JUMLAH_KOEFISIEN; i += 1) {
    rerata[i] = (rerata[i] ?? 0) / bingkai.length;
  }

  return bingkai.map((b) => {
    const keluar = new Float32Array(JUMLAH_KOEFISIEN);
    for (let i = 0; i < JUMLAH_KOEFISIEN; i += 1) {
      keluar[i] = (b[i] ?? 0) - (rerata[i] ?? 0);
    }
    return keluar;
  });
}
