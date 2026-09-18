/**
 * Voting temporal.
 *
 * Fungsi murni atas sebuah jendela bingkai. Pemanggil yang memelihara
 * jendelanya; di sini tidak ada state sama sekali, supaya bisa diuji langsung.
 *
 * Kenapa lapisan ini ada. Confidence gating saja TIDAK cukup untuk menjamin
 * janji "zero false-positive". Skor 0,9 pada satu bingkai bisa muncul dari
 * kilatan cahaya, guncangan tangan, atau bayangan yang kebetulan menyerupai
 * pola uang. Kesalahan seperti itu tidak bertahan: bingkai berikutnya biasanya
 * memberi jawaban lain. Deteksi yang benar justru sebaliknya — ia stabil selama
 * uangnya masih di depan kamera.
 *
 * KESEPAKATAN DIHITUNG PER TEMPAT, BUKAN PER KELAS. Lihat ADR-0012.
 *
 * Perjalanannya tiga langkah, dan dua yang pertama keliru:
 *
 *   1. Per HIMPUNAN — seluruh isi bingkai harus sama persis di 3 dari 5
 *      bingkai. Bekerja untuk satu lembar; gagal untuk beberapa lembar, karena
 *      lembar kedua berkedip melintasi ambang sehingga himpunan {A} menang atas
 *      {A, B}. Jawaban yang menang justru MENGHILANGKAN uang pengguna.
 *
 *   2. Per KELAS — tiap pecahan dinilai sendiri. Multi-lembar membaik, tetapi
 *      muncul kegagalan yang lebih buruk: satu lembar yang identitasnya
 *      berkedip antara dua pecahan membuat KEDUA pecahan itu masing-masing
 *      mengumpulkan 3 dari 5 bingkai. Satu lembar di tangan dilaporkan sebagai
 *      dua lembar, dan totalnya menjadi LEBIH BESAR daripada uang yang
 *      sebenarnya ada.
 *
 *   3. Per TEMPAT — yang dipakai sekarang. Deteksi dikelompokkan berdasarkan
 *      letaknya di bingkai, bukan berdasarkan namanya. Satu tempat berarti satu
 *      lembar uang, apa pun tebakan kelasnya. Sebuah tempat baru diumumkan
 *      kalau ia terlihat di cukup banyak bingkai DAN kelasnya sepakat di cukup
 *      banyak bingkai.
 *
 * Langkah ketiga inilah yang membuat dua kegagalan di atas mustahil sekaligus:
 * lembar yang berkedip tetap terhitung satu tempat, dan tempat yang namanya
 * masih berubah-ubah tidak pernah disebut — sistem memilih diam.
 *
 * DUA TINGKAT KEYAKINAN. Setelah langkah ketiga terpasang, satu lembar kembali
 * mantap tetapi beberapa lembar masih goyah: total gabungan sempat terbaca,
 * lalu dalam beberapa detik menyusut lagi menjadi satu lembar. Sebabnya lembar
 * kedua hanya melewati ambang keputusan di sekitar seperlima bingkai, sehingga
 * tempatnya jatuh-bangun melintasi syarat 3 dari 5.
 *
 * Perbaikannya memisahkan dua pertanyaan yang selama ini dijawab satu ambang:
 *
 *   MELAHIRKAN jawaban baru  -> butuh bukti KUAT (di atas AMBANG_KEYAKINAN)
 *   MENERUSKAN jawaban lama  -> cukup bukti LEMAH (di atas AMBANG_LEMAH)
 *
 * Alasannya masuk akal dan bukan kelonggaran sembarangan: kotak berkeyakinan
 * sedang di TEMPAT YANG SUDAH TERBUKTI berisi uang bukanlah klaim baru, ia
 * kesinambungan dari klaim yang sudah dibuktikan bukti kuat. Yang berbahaya
 * adalah memulai klaim dari bukti lemah, bukan mempertahankannya.
 *
 * Kelas tetap ditentukan HANYA oleh pengamatan kuat. Kotak lemah boleh berkata
 * "masih ada sesuatu di sini", tidak pernah "namanya begini".
 */

import { VOTING_BUTUH, VOTING_DARI, type Deteksi } from '@/contracts';
import { iou } from './nms';

export type StatusVoting = 'stabil' | 'belum-stabil' | 'tidak-ada-objek';

export interface HasilVoting {
  readonly status: StatusVoting;
  /** Terisi hanya saat 'stabil'. */
  readonly deteksi: readonly Deteksi[];
}

/**
 * Seberapa berimpit dua kotak agar dianggap lembar uang yang sama.
 *
 * Lebih longgar daripada ambang NMS (0,40), dan itu disengaja: NMS memutuskan
 * "dua kotak ini objek yang sama DALAM SATU bingkai", sedangkan di sini kita
 * memutuskan "kotak ini lembar yang sama dengan yang tadi, SATU BINGKAI LALU".
 * Di antara dua bingkai ada jeda sekitar 0,7 detik, dan tangan yang memegang
 * uang selalu bergeser dalam jeda itu. Menuntut keberimpitan yang ketat akan
 * membuat satu lembar terus-menerus dianggap lembar baru.
 */
const AMBANG_TEMPAT = 0.3;

/**
 * Berapa banyak pengamatan KUAT yang dibutuhkan sebuah tempat untuk lahir.
 *
 * Lebih kecil daripada `VOTING_BUTUH`, dan itulah yang membuat beberapa lembar
 * akhirnya bekerja: lembar kedua hanya melewati ambang keputusan di sekitar
 * seperlima bingkai, sehingga menuntut tiga kali akan membuatnya tidak pernah
 * lahir. Sisa syaratnya tetap dijaga bukti lemah — sebuah tempat masih harus
 * TERLIHAT di `VOTING_BUTUH` bingkai, hanya saja kehadirannya boleh dibuktikan
 * kotak berkeyakinan sedang.
 *
 * Batas bawahnya dua, bukan satu. Satu pengamatan kuat adalah persis definisi
 * kilatan sesaat yang seluruh lapisan ini ada untuk menyaring.
 */
const MINIMAL_KUAT = 2;

/**
 * Sidik jari sebuah bingkai: multiset kode kelas, diurutkan.
 *
 * Tidak lagi dipakai untuk memutuskan kestabilan, tetapi tetap ada karena ia
 * cara paling ringkas untuk membandingkan isi dua bingkai, dan dipakai di tes.
 */
export function sidikJari(deteksi: readonly Deteksi[]): string {
  return deteksi
    .map((d) => d.kodeKelas)
    .sort((a, b) => a - b)
    .join(',');
}

/** Satu lembar uang yang diikuti melintasi beberapa bingkai. */
interface Tempat {
  /** Kotak dari kemunculan terbaru; dipakai mencocokkan bingkai berikutnya. */
  acuan: Deteksi;
  /** Deteksi yang pernah menempati tempat ini, berurutan menurut bingkai. */
  anggota: Deteksi[];
  /** Indeks bingkai tempat ini terlihat. Menghindari hitungan ganda. */
  bingkai: Set<number>;
}

/**
 * Mengelompokkan deteksi dari seluruh jendela menjadi tempat-tempat.
 *
 * Pencocokan dilakukan serakah dari yang paling berimpit, dan satu tempat hanya
 * boleh menerima satu deteksi per bingkai — kalau tidak, dua lembar yang
 * bersebelahan bisa runtuh menjadi satu tempat dan salah satunya lenyap dari
 * hitungan.
 */
function kelompokkan(jendela: readonly (readonly Deteksi[])[]): Tempat[] {
  const tempat: Tempat[] = [];

  jendela.forEach((bingkai, i) => {
    const terpakai = new Set<Tempat>();

    // Deteksi berkeyakinan tinggi memilih tempatnya lebih dulu. Yang ragu-ragu
    // tidak boleh merebut tempat milik yang jelas.
    const urut = [...bingkai].sort((a, b) => b.skor - a.skor);

    for (const d of urut) {
      let terbaik: Tempat | null = null;
      let terbaikIou = AMBANG_TEMPAT;

      for (const t of tempat) {
        if (terpakai.has(t)) continue;
        const nilai = iou(t.acuan.kotak, d.kotak);
        if (nilai >= terbaikIou) {
          terbaik = t;
          terbaikIou = nilai;
        }
      }

      if (terbaik) {
        terbaik.anggota.push(d);
        terbaik.bingkai.add(i);
        terbaik.acuan = d;
        terpakai.add(terbaik);
      } else {
        const baru: Tempat = { acuan: d, anggota: [d], bingkai: new Set([i]) };
        tempat.push(baru);
        terpakai.add(baru);
      }
    }
  });

  return tempat;
}

/**
 * Memutuskan apakah isi jendela sudah cukup sepakat untuk diucapkan.
 *
 * Hanya `VOTING_DARI` bingkai terakhir yang dihitung, sehingga hasil lama tidak
 * menahan sistem saat pengguna mengganti uang di depan kamera.
 */
export function votingTemporal(
  jendela: readonly (readonly Deteksi[])[],
  butuh: number = VOTING_BUTUH,
  dari: number = VOTING_DARI,
  /** Kotak tingkat kedua per bingkai, sejajar dengan `jendela`. */
  jendelaLemah: readonly (readonly Deteksi[])[] = [],
): HasilVoting {
  const terakhir = jendela.slice(-dari);
  if (terakhir.length === 0) {
    return { status: 'tidak-ada-objek', deteksi: [] };
  }

  const lemahTerakhir = jendelaLemah.slice(-dari);
  const gabungan = terakhir.map((kuat, i) => [
    ...kuat,
    ...(lemahTerakhir[i] ?? []),
  ]);

  const tempat = kelompokkan(gabungan);
  const kuatDi = new Set(terakhir.flat());

  const mapan = tempat.filter((t) => {
    // HADIR: terlihat di cukup banyak bingkai, bukti kuat maupun lemah.
    if (t.bingkai.size < butuh) return false;
    // LAHIR: sebuah tempat tidak pernah boleh muncul dari bukti lemah saja.
    const kuat = t.anggota.filter((d) => kuatDi.has(d));
    return kuat.length >= MINIMAL_KUAT;
  });

  if (mapan.length === 0) {
    // Bedakan "jendela sepakat tidak ada apa-apa" dari "jendela masih ragu".
    // Yang pertama berarti kamera memang belum diarahkan ke uang dan sistem
    // boleh diam; yang kedua berarti ada sesuatu di sana dan pengguna berhak
    // diberi tahu lewat abstain.
    const kosong = terakhir.filter((b) => b.length === 0).length;
    return kosong >= butuh
      ? { status: 'tidak-ada-objek', deteksi: [] }
      : { status: 'belum-stabil', deteksi: [] };
  }

  const deteksi: Deteksi[] = [];

  for (const t of mapan) {
    // Kelas ditentukan HANYA oleh pengamatan kuat. Kotak lemah boleh berkata
    // "masih ada sesuatu di sini", tidak pernah "namanya begini".
    const suara = new Map<number, number>();
    for (const d of t.anggota) {
      if (!kuatDi.has(d)) continue;
      suara.set(d.kodeKelas, (suara.get(d.kodeKelas) ?? 0) + 1);
    }

    let kelasMenang = -1;
    let suaraMenang = 0;
    let suaraKedua = 0;
    for (const [kelas, n] of suara) {
      if (n > suaraMenang) {
        suaraKedua = suaraMenang;
        suaraMenang = n;
        kelasMenang = kelas;
      } else if (n > suaraKedua) {
        suaraKedua = n;
      }
    }

    // INI PENJAGA TERPENTING DI SELURUH BERKAS.
    //
    // Tempat yang jelas ada tetapi identitasnya masih berubah-ubah TIDAK
    // ditebak. Menebaknya berarti menyebut nominal yang salah dengan penuh
    // keyakinan — satu-satunya mode kegagalan yang lolos dari kebijakan
    // abstain, dan satu-satunya yang membuat pengguna kehilangan uang tanpa
    // pernah tahu.
    //
    // Seluruh hasil dibatalkan, bukan hanya tempat ini. Mengumumkan sisanya
    // berarti menyebut total yang lebih kecil daripada uang yang sebenarnya
    // ada di tangan, dan itu sama menyesatkannya.
    // Dua syarat, dan keduanya harus lulus. Jumlahnya cukup, DAN tidak ada
    // pecahan lain yang sama kuatnya. Seri berarti sistem belum memutuskan —
    // dan sistem yang belum memutuskan tidak boleh berbicara.
    if (suaraMenang < MINIMAL_KUAT || suaraMenang <= suaraKedua) {
      return { status: 'belum-stabil', deteksi: [] };
    }

    // Wakilnya: kemunculan TERBARU dengan kelas yang menang, karena kotaknya
    // paling dekat dengan apa yang sedang dilihat kamera saat ini.
    const wakil = [...t.anggota]
      .reverse()
      .find((d) => kuatDi.has(d) && d.kodeKelas === kelasMenang);
    if (wakil) deteksi.push(wakil);
  }

  if (deteksi.length === 0) {
    return { status: 'belum-stabil', deteksi: [] };
  }

  // Diurutkan dari nominal terbesar supaya kalimatnya terdengar wajar:
  // "dua puluh ribu, lima ribu", bukan urutan acak sesuai penemuan.
  deteksi.sort((a, b) => (b.nominal ?? 0) - (a.nominal ?? 0));

  return { status: 'stabil', deteksi };
}
