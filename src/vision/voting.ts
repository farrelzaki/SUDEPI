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
 * memberi jawaban lain.
 *
 * Deteksi yang benar justru sebaliknya — ia stabil selama uangnya masih di
 * depan kamera. Jadi yang kita tuntut bukan keyakinan tinggi sesaat, melainkan
 * KESEPAKATAN antar bingkai. Inilah saringan yang sebenarnya mewujudkan janji
 * anti salah-sebut di proposal.
 *
 * KESEPAKATAN DIHITUNG PER OBJEK, BUKAN PER HIMPUNAN. Lihat ADR-0012. Versi
 * pertama menuntut seluruh isi bingkai sama persis di 3 dari 5 bingkai. Itu
 * bekerja untuk satu lembar dan gagal untuk beberapa lembar: lembar yang paling
 * jelas terbaca hampir setiap bingkai, sementara lembar kedua berkedip
 * melintasi ambang. Himpunan {A} muncul jauh lebih sering daripada himpunan
 * {A, B}, sehingga jawaban yang menang justru yang MENGHILANGKAN uang.
 *
 * Sekarang setiap pecahan dinilai sendiri: ia ikut diumumkan kalau terlihat di
 * cukup banyak bingkai. Ambang keyakinannya tidak diturunkan sedikit pun —
 * setiap lembar tetap harus melewati gerbang yang sama, hanya saja bukti
 * temporalnya dihitung per lembar, bukan per himpunan.
 */

import { VOTING_BUTUH, VOTING_DARI, type Deteksi } from '@/contracts';

export type StatusVoting = 'stabil' | 'belum-stabil' | 'tidak-ada-objek';

export interface HasilVoting {
  readonly status: StatusVoting;
  /** Terisi hanya saat 'stabil'. */
  readonly deteksi: readonly Deteksi[];
}

/**
 * Sidik jari sebuah bingkai: multiset kode kelas, diurutkan.
 *
 * Sengaja MENGABAIKAN posisi kotak. Uang yang dipegang tangan selalu bergeser
 * sedikit antar bingkai; menuntut kotaknya berimpit akan membuat sistem tidak
 * pernah mencapai stabil.
 *
 * Tidak lagi dipakai untuk memutuskan kestabilan, tetapi tetap ada karena ia
 * cara paling ringkas untuk membandingkan isi dua bingkai.
 */
export function sidikJari(deteksi: readonly Deteksi[]): string {
  return deteksi
    .map((d) => d.kodeKelas)
    .sort((a, b) => a - b)
    .join(',');
}

/**
 * Berapa banyak lembar pecahan `kodeKelas` yang benar-benar disepakati jendela.
 *
 * Mengembalikan angka terbesar `n` yang masih didukung sekurang-kurangnya
 * `butuh` bingkai. Menghitung seperti ini, bukan sekadar "ada atau tidak ada",
 * membuat dua lembar lima ribu tidak pernah menyusut menjadi satu hanya karena
 * salah satunya sempat tertutup jari.
 */
function jumlahDisepakati(
  jendela: readonly (readonly Deteksi[])[],
  kodeKelas: number,
  butuh: number,
): number {
  const cacah = jendela.map(
    (b) => b.filter((d) => d.kodeKelas === kodeKelas).length,
  );
  const terbanyak = Math.max(0, ...cacah);

  let hasil = 0;
  for (let n = 1; n <= terbanyak; n += 1) {
    if (cacah.filter((c) => c >= n).length >= butuh) hasil = n;
    else break;
  }
  return hasil;
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

  const semuaKelas = new Set<number>();
  for (const bingkai of terakhir) {
    for (const d of bingkai) semuaKelas.add(d.kodeKelas);
  }

  const disepakati = new Map<number, number>();
  for (const kelas of semuaKelas) {
    const n = jumlahDisepakati(terakhir, kelas, butuh);
    if (n > 0) disepakati.set(kelas, n);
  }

  if (disepakati.size === 0) {
    // Tidak ada satu pun pecahan yang cukup sering terlihat. Bedakan "jendela
    // sepakat tidak ada apa-apa" dari "jendela masih ragu": yang pertama berarti
    // kamera memang belum diarahkan ke uang dan sistem boleh diam, yang kedua
    // berarti ada sesuatu di sana dan pengguna berhak diberi tahu.
    const kosong = terakhir.filter((b) => b.length === 0).length;
    return kosong >= butuh
      ? { status: 'tidak-ada-objek', deteksi: [] }
      : { status: 'belum-stabil', deteksi: [] };
  }

  // Kotaknya diambil dari bingkai TERBARU yang benar-benar memuat sebanyak itu,
  // bukan dari bingkai terlama: kotaknya paling dekat dengan apa yang sedang
  // dilihat kamera saat ini.
  const deteksi: Deteksi[] = [];
  for (const [kelas, n] of disepakati) {
    for (let i = terakhir.length - 1; i >= 0; i -= 1) {
      const cocok = (terakhir[i] ?? [])
        .filter((d) => d.kodeKelas === kelas)
        .sort((a, b) => b.skor - a.skor);
      if (cocok.length >= n) {
        deteksi.push(...cocok.slice(0, n));
        break;
      }
    }
  }

  // Diurutkan dari nominal terbesar supaya kalimatnya terdengar wajar:
  // "dua puluh ribu, lima ribu", bukan urutan acak sesuai penemuan.
  deteksi.sort((a, b) => (b.nominal ?? 0) - (a.nominal ?? 0));

  return { status: 'stabil', deteksi };
}
