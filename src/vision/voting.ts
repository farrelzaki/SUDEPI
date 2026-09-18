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
): HasilVoting {
  const terakhir = jendela.slice(-dari);
  if (terakhir.length === 0) {
    return { status: 'tidak-ada-objek', deteksi: [] };
  }

  const tempat = kelompokkan(terakhir);
  const mapan = tempat.filter((t) => t.bingkai.size >= butuh);

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
    // Kelas mana yang disepakati untuk tempat ini?
    const suara = new Map<number, number>();
    for (const d of t.anggota) {
      suara.set(d.kodeKelas, (suara.get(d.kodeKelas) ?? 0) + 1);
    }

    let kelasMenang = -1;
    let suaraMenang = 0;
    for (const [kelas, n] of suara) {
      if (n > suaraMenang) {
        suaraMenang = n;
        kelasMenang = kelas;
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
    if (suaraMenang < butuh) {
      return { status: 'belum-stabil', deteksi: [] };
    }

    // Wakilnya: kemunculan TERBARU dengan kelas yang menang, karena kotaknya
    // paling dekat dengan apa yang sedang dilihat kamera saat ini.
    const wakil = [...t.anggota]
      .reverse()
      .find((d) => d.kodeKelas === kelasMenang);
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
