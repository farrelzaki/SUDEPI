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
 */

import { VOTING_BUTUH, VOTING_DARI, type Deteksi } from '@/contracts';

export type StatusVoting = 'stabil' | 'belum-stabil' | 'tidak-ada-objek';

export interface HasilVoting {
  readonly status: StatusVoting;
  /** Terisi hanya saat 'stabil'. Diambil dari bingkai terbaru yang sepakat. */
  readonly deteksi: readonly Deteksi[];
}

/**
 * Sidik jari sebuah bingkai: multiset kode kelas, diurutkan.
 *
 * Sengaja MENGABAIKAN posisi kotak. Uang yang dipegang tangan selalu bergeser
 * sedikit antar bingkai; menuntut kotaknya berimpit akan membuat sistem tidak
 * pernah mencapai stabil. Yang harus konsisten adalah jawabannya — "dua lembar
 * lima puluh ribu dan satu koin" — bukan letak persisnya di layar.
 */
export function sidikJari(deteksi: readonly Deteksi[]): string {
  return deteksi
    .map((d) => d.kodeKelas)
    .sort((a, b) => a - b)
    .join(',');
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

  const jumlah = new Map<string, number>();
  for (const bingkai of terakhir) {
    const kunci = sidikJari(bingkai);
    jumlah.set(kunci, (jumlah.get(kunci) ?? 0) + 1);
  }

  let kunciMenang = '';
  let suaraMenang = 0;
  for (const [kunci, suara] of jumlah) {
    if (suara > suaraMenang) {
      suaraMenang = suara;
      kunciMenang = kunci;
    }
  }

  if (suaraMenang < butuh) {
    return { status: 'belum-stabil', deteksi: [] };
  }

  // Jendela sepakat bahwa tidak ada apa-apa di depan kamera.
  if (kunciMenang === '') {
    return { status: 'tidak-ada-objek', deteksi: [] };
  }

  // Ambil dari bingkai TERBARU yang cocok, bukan yang terlama: kotaknya paling
  // dekat dengan apa yang sedang dilihat kamera saat ini.
  for (let i = terakhir.length - 1; i >= 0; i -= 1) {
    const bingkai = terakhir[i];
    if (bingkai && sidikJari(bingkai) === kunciMenang) {
      return { status: 'stabil', deteksi: bingkai };
    }
  }

  return { status: 'belum-stabil', deteksi: [] };
}
