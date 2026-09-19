/**
 * Saklar mode sistem — Rencana A atau Rencana B.
 *
 * SATU-SATUNYA GERBANG menuju jaringan. Tidak ada kode lain di seluruh aplikasi
 * yang boleh memanggil `fetch` ke luar tanpa melewati `bolehDaring()` lebih
 * dulu. Aturan itu ditulis di sini, bukan disebar ke pemanggil, supaya tidak
 * ada jalur yang diam-diam lolos saat seseorang menambah fitur baru.
 *
 * KENAPA DUA MODE, dan kenapa bukan salah satu saja.
 *
 * Rencana A — luring penuh — adalah janji inti SUDEPI dan tetap menjadi jalur
 * baku. Ia bisa dibuktikan di depan juri dengan mode pesawat menyala, dan bukti
 * itu tidak berubah sedikit pun oleh keberadaan berkas ini.
 *
 * Rencana B ada karena dua fitur belum benar-benar bekerja luring menjelang
 * penjurian: pembacaan beberapa lembar sekaligus, dan perintah suara. Menutupi
 * keduanya dengan demo yang dipilih hati-hati akan lebih buruk daripada
 * menyediakan jalur cadangan yang dinyatakan terbuka.
 *
 * Yang TIDAK boleh terjadi: mode daring menyala sendiri. Ia selalu dinyalakan
 * manusia, sadar, lewat tombol — karena yang dikirim ke internet adalah gambar
 * uang dan suara penggunanya.
 */

export type ModeSistem = 'luring' | 'daring';

const KUNCI = 'sudepi.mode.v1';

/**
 * Mode yang tersimpan. Baku 'luring', dan nilai asing apa pun juga 'luring'.
 *
 * Arah kegagalannya disengaja: berkas penyimpanan yang rusak, versi lama, atau
 * nilai yang tidak dikenali semuanya jatuh ke sisi yang lebih aman. Aplikasi
 * yang tidak yakin sedang berada di mode apa tidak boleh menebak ke arah
 * internet.
 */
export function bacaMode(): ModeSistem {
  if (KUNCI_GEMINI) return 'daring';
  try {
    return localStorage.getItem(KUNCI) === 'daring' ? 'daring' : 'luring';
  } catch {
    return 'luring';
  }
}

export function tulisMode(mode: ModeSistem): void {
  try {
    localStorage.setItem(KUNCI, mode);
  } catch {
    // Penyimpanan diblokir. Mode kembali ke luring saat aplikasi dibuka lagi,
    // dan itu arah kegagalan yang benar.
  }
}

/** Kunci API Gemini, disuntikkan saat build dari `.env.local`. */
export const KUNCI_GEMINI = import.meta.env.VITE_KUNCI_GEMINI ?? '';

/**
 * Apakah panggilan jaringan diizinkan saat ini.
 *
 * Dua syarat, dan keduanya harus benar. Mode saja tidak cukup: tanpa kunci,
 * permintaan hanya akan ditolak server setelah membuang waktu pengguna dan
 * membocorkan bahwa aplikasi mencoba menghubungi internet padahal tidak bisa
 * memberi hasil apa pun.
 */
export function bolehDaring(mode: ModeSistem, perluKunci = true): boolean {
  if (mode !== 'daring') return false;
  return perluKunci ? KUNCI_GEMINI.length > 0 : true;
}
