/**
 * Pengurai bilangan Bahasa Indonesia — kebalikan dari `angka.ts`.
 *
 * Fungsi murni. Mengubah kalimat yang didengar menjadi nominal Rupiah, atau
 * mengembalikan `null` bila kalimat itu tidak bisa dibaca sebagai nominal.
 *
 * INI LAPISAN PALING PENTING DARI SELURUH FITUR SUARA, dan sengaja ditulis
 * pertama. Mesin pengenalan suara mana pun yang kita pakai nanti hanya
 * menghasilkan teks; benar-salahnya nominal yang dipakai untuk menghitung
 * kembalian ditentukan di sini. Karena ia fungsi murni, seluruh perilakunya
 * bisa diuji tanpa mikrofon, tanpa perangkat, dan tanpa model apa pun.
 *
 * Ia harus memaafkan banyak hal sekaligus tetap menolak dengan tegas:
 *
 *   "lima puluh ribu"          -> 50000
 *   "limapuluh ribu"           -> 50000   (mesin sering menyambung kata)
 *   "50 ribu"                  -> 50000   (mesin sering menulis angka)
 *   "Rp50.000"                 -> 50000
 *   "lima puluh ribu rupiah"   -> 50000
 *   "seratus dua puluh lima ribu" -> 125000
 *   "dua juta lima ratus ribu" -> 2500000
 *   "setengah"                 -> null    (bukan nominal)
 *   "lima puluh"               -> 50      lihat catatan tentang skala di bawah
 *
 * YANG TIDAK BOLEH DILAKUKAN: menebak. Kalimat yang tidak dimengerti wajib
 * menghasilkan `null`, supaya pemanggil bisa meminta pengguna mengulang.
 * Nominal yang salah diam-diam akan menjadi kembalian yang salah, dan itu
 * kerugian uang nyata bagi pengguna.
 */

/** Satuan dasar, termasuk ejaan yang sering keluar dari mesin pengenalan. */
const SATUAN: Readonly<Record<string, number>> = {
  nol: 0,
  kosong: 0,
  satu: 1,
  se: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
};

/** Pengali yang mengubah nilai di depannya. */
const PENGALI: Readonly<Record<string, number>> = {
  belas: 10, // ditangani khusus: "dua belas" = 12, bukan 20
  puluh: 10,
  ratus: 100,
  ribu: 1000,
  rb: 1000,
  juta: 1_000_000,
  jt: 1_000_000,
};

/** Kata yang boleh ada dan tidak mengubah nilai apa pun. */
const ABAIKAN: ReadonlySet<string> = new Set([
  'rupiah',
  'rp',
  'total',
  'belanja',
  'belanjanya',
  'harga',
  'harganya',
  'jadi',
  'adalah',
  'nya',
  'uang',
  'sebesar',
  'dan',
]);

/**
 * Bentuk "se-" yang menempel, misalnya "seratus" dan "seribu".
 *
 * Dipisah lebih dulu supaya sisa penguraian tidak perlu mengenal kasus khusus.
 * "sepuluh" dan "sebelas" TIDAK ikut dipisah karena keduanya satuan utuh.
 */
function pisahkanSe(kata: string): readonly string[] {
  if (kata === 'sepuluh' || kata === 'sebelas') return [kata];
  for (const pengali of ['ratus', 'ribu', 'juta']) {
    if (kata === `se${pengali}`) return ['satu', pengali];
  }
  return [kata];
}

/**
 * Memecah kata sambung seperti "limapuluh" menjadi "lima" dan "puluh".
 *
 * Mesin pengenalan suara sering menyambung bilangan, dan bentuk sambungnya
 * tidak konsisten antar perangkat. Memecahnya di sini jauh lebih murah
 * daripada menuntut pengguna berbicara dengan jeda.
 */
function pecahSambung(kata: string): readonly string[] {
  for (const pengali of Object.keys(PENGALI)) {
    if (kata.length <= pengali.length || !kata.endsWith(pengali)) continue;
    const depan = kata.slice(0, kata.length - pengali.length);
    if (depan in SATUAN) return [depan, pengali];
  }
  return [kata];
}

/** Membersihkan kalimat menjadi deretan kata yang siap diurai. */
function menjadiKata(teks: string): readonly string[] {
  return teks
    .toLowerCase()
    // Pemisah ribuan dibuang, bukan diubah jadi spasi: "50.000" satu bilangan.
    .replace(/(\d)[.,](?=\d{3}\b)/g, '$1')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    // "rp50000" menjadi "rp 50000". Mesin pengenalan sering menempelkan satuan
    // pada angkanya, dan tanpa pemisahan ini seluruh kalimat menjadi satu kata
    // asing yang tidak dikenali siapa pun.
    .replace(/(\p{L})(?=\p{N})/gu, '$1 ')
    .replace(/(\p{N})(?=\p{L})/gu, '$1 ')
    .split(/\s+/)
    .filter((k) => k.length > 0)
    .flatMap(pisahkanSe)
    .flatMap(pecahSambung)
    .filter((k) => !ABAIKAN.has(k));
}

export interface HasilUrai {
  readonly nominal: number;
  /** Kata yang benar-benar dipakai. Untuk jejak dan pengujian. */
  readonly dipakai: readonly string[];
}

/**
 * Mengurai kalimat menjadi nominal Rupiah.
 *
 * Mengembalikan `null` kalau tidak ada bilangan yang bisa dibaca, atau kalau
 * susunannya tidak masuk akal sebagai nominal.
 */
export function uraiNominal(teks: string): HasilUrai | null {
  const kata = menjadiKata(teks);
  if (kata.length === 0) return null;

  // Tiga tingkat, persis seperti cara bilangan Indonesia disusun:
  //
  //   satuan  angka 1..19 yang sedang diucapkan   ("lima")
  //   bagian  kelompok ratusan-puluhan            ("seratus dua puluh lima")
  //   total   yang sudah dikunci pengali besar    ("... ribu", "... juta")
  //
  // Versi pertama hanya memakai dua tingkat, dan "seratus dua puluh lima ribu"
  // menjadi 1.025.000 — seratus dikalikan lagi oleh puluh. Kekeliruan itu
  // tidak kelihatan pada bilangan sederhana, dan justru muncul pada nominal
  // belanja yang paling lazim.
  let total = 0;
  let bagian = 0;
  let satuan = 0;
  let terpakai = false;
  /** Pengali besar terakhir. Harus menurun: juta lalu ribu, tidak sebaliknya. */
  let pengaliTerakhir = Number.POSITIVE_INFINITY;
  const dipakai: string[] = [];

  for (let i = 0; i < kata.length; i += 1) {
    const k = kata[i] ?? '';

    // Angka yang ditulis sebagai digit, misalnya "50" pada "50 ribu".
    if (/^\d+$/.test(k)) {
      const n = Number(k);
      if (!Number.isSafeInteger(n)) return null;
      satuan += n;
      terpakai = true;
      dipakai.push(k);
      continue;
    }

    if (k in SATUAN) {
      satuan += SATUAN[k] ?? 0;
      terpakai = true;
      dipakai.push(k);
      continue;
    }

    if (k in PENGALI) {
      const p = PENGALI[k] ?? 1;

      if (k === 'belas') {
        // "dua belas" = 12. Satuan di depannya menjadi digit satuan, bukan
        // dikalikan — kaidah yang paling mudah salah kalau ditangani umum.
        if (satuan < 1 || satuan > 9) return null;
        satuan += 10;
        dipakai.push(k);
        continue;
      }

      if (p >= 1000) {
        // Pengali besar mengunci seluruh yang tersusun sejauh ini.
        if (p >= pengaliTerakhir) return null;
        pengaliTerakhir = p;
        const dasar = bagian + satuan === 0 ? 1 : bagian + satuan;
        total += dasar * p;
        bagian = 0;
        satuan = 0;
      } else {
        // Puluh dan ratus hanya mengalikan satuan tepat di depannya, lalu
        // hasilnya DITAMBAHKAN ke kelompok yang sedang disusun.
        const dasar = satuan === 0 ? 1 : satuan;
        bagian += dasar * p;
        satuan = 0;
      }
      terpakai = true;
      dipakai.push(k);
      continue;
    }

    // Kata yang tidak dikenali. Kalau sudah ada bilangan yang tersusun, kata
    // asing sesudahnya diabaikan — mesin pengenalan sering menambahkan kata
    // yang tidak diucapkan. Kalau BELUM ada, kalimatnya memang bukan nominal.
    if (!terpakai) return null;
  }

  const nominal = total + bagian + satuan;
  if (!terpakai || nominal <= 0) return null;
  if (!Number.isSafeInteger(nominal)) return null;

  return { nominal, dipakai };
}

/**
 * Batas nominal yang masuk akal untuk transaksi warung.
 *
 * Bukan batas teknis melainkan batas kewarasan. Salah dengar yang menghasilkan
 * puluhan miliar lebih mungkin berasal dari kalimat yang kacau daripada dari
 * belanjaan sungguhan, dan lebih baik ditolak daripada dipakai menghitung
 * kembalian.
 */
export const NOMINAL_MAKS = 10_000_000;

/**
 * Sama seperti `uraiNominal`, tetapi juga menolak nominal yang tidak wajar.
 *
 * Inilah yang dipakai antarmuka. Pemisahan ini disengaja: `uraiNominal` diuji
 * sebagai tata bahasa murni, sedangkan kewajaran nilainya adalah keputusan
 * produk yang bisa berubah tanpa menyentuh tata bahasanya.
 */
export function uraiNominalWajar(teks: string): number | null {
  const hasil = uraiNominal(teks);
  if (!hasil) return null;
  if (hasil.nominal > NOMINAL_MAKS) return null;
  return hasil.nominal;
}
