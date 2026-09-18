/**
 * Pembaca uang — alat baca berdiri sendiri, di luar alur transaksi.
 *
 * Reducer murni, sama seperti `mesin.ts`: masuk hasil pindai, keluar efek.
 * Tidak menyentuh kamera, suara, maupun basis data.
 *
 * KENAPA TERPISAH DARI MESIN TRANSAKSI. Membaca uang dan bertransaksi adalah
 * dua kebutuhan yang berbeda, dan menyatukannya memaksa pengguna yang hanya
 * ingin tahu "ini uang berapa" untuk masuk ke alur yang menuntut harga belanja,
 * layar pedagang, dan verifikasi kembalian. Sebagian besar pemakaian sehari-hari
 * justru hanya pertanyaan pertama itu.
 *
 * Yang TIDAK dilakukan berkas ini: mengulang logika pengumuman. Penyusunan
 * kalimat, penahan pengulangan, dan penahan abstain semuanya dipinjam dari
 * `mesin.ts` — logika yang sama, sudah punya tesnya sendiri, dan kalau suatu
 * hari diperbaiki, keduanya ikut membaik bersamaan.
 */

import type { Efek, HasilPindai } from '@/contracts';
import { EFEK_ABSTAIN, isinyaSama, ucapkanHasilPindai } from './mesin';

export interface StatePembaca {
  /**
   * Hasil STABIL yang terakhir diumumkan — bukan bingkai terakhir.
   *
   * Bedanya menentukan. Tangan yang memegang uang selalu bergeser, dan satu
   * bingkai yang goyah di tengah tidak boleh membuat seluruh kalimat diulang.
   * Kalau yang diingat adalah bingkai terakhir, satu kedipan "belum stabil"
   * sudah cukup untuk membuat uang yang sama diumumkan dua kali.
   */
  readonly terakhirDiumumkan: HasilPindai | null;
  /** Apakah peringatan abstain sudah disampaikan untuk kejadian ini. */
  readonly abstainDisampaikan: boolean;
}

export const PEMBACA_AWAL: StatePembaca = {
  terakhirDiumumkan: null,
  abstainDisampaikan: false,
};

export interface HasilPembaca {
  readonly state: StatePembaca;
  readonly efek: readonly Efek[];
}

/**
 * Menanggapi satu hasil pindai.
 *
 * Berbeda dari fase transaksi, pembaca ini TIDAK mengunci hasil stabilnya.
 * Di alur transaksi, nominal yang sudah diucapkan menjadi tawaran yang harus
 * bertahan sampai pengguna menanggapinya — kalau tidak, ketukannya ditolak
 * diam-diam. Di sini tidak ada yang perlu ditanggapi: pengguna cukup mengganti
 * lembar dan mendengar jawaban berikutnya, terus-menerus, sampai ia keluar.
 */
export function bacaUang(
  state: StatePembaca,
  hasil: HasilPindai,
): HasilPembaca {
  if (hasil.status === 'stabil') {
    // Isi yang sama tidak diumumkan ulang. Selama uang masih di depan kamera,
    // bingkai stabil terus berdatangan; mengucapkannya tiap kali membuat suara
    // bertumpuk dan tidak pernah berhenti.
    if (isinyaSama(state.terakhirDiumumkan, hasil)) return { state, efek: [] };

    return {
      state: { terakhirDiumumkan: hasil, abstainDisampaikan: false },
      efek: ucapkanHasilPindai(hasil),
    };
  }

  if (hasil.status === 'abstain') {
    // Sekali per kejadian, bukan sekali per bingkai. Kalimat peringatannya
    // lebih panjang daripada jeda antar bingkai, sehingga mengucapkannya tiap
    // kali membuat ucapan memotong dirinya sendiri di tengah kata.
    if (state.abstainDisampaikan) return { state, efek: [] };
    return {
      state: { ...state, abstainDisampaikan: true },
      efek: [...EFEK_ABSTAIN],
    };
  }

  if (hasil.status === 'tidak-ada-objek') {
    // Uangnya sudah disingkirkan. Kejadian abstain berakhir, dan ingatan
    // tentang apa yang terakhir diumumkan ikut dilupakan — supaya lembar yang
    // sama, kalau diangkat lagi, disebutkan lagi.
    return { state: PEMBACA_AWAL, efek: [] };
  }

  // 'belum-stabil' hanya kedipan di tengah percobaan yang sama. Tidak ada yang
  // diubah, tidak ada yang diucapkan.
  return { state, efek: [] };
}
