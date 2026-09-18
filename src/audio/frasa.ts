/**
 * Teks Bahasa Indonesia untuk tiap frasa sistem.
 *
 * Dipakai dua arah: sebagai naskah saat merender potongan audio, dan sebagai
 * masukan cadangan `speechSynthesis` kalau sprite gagal dimuat.
 *
 * Kalimatnya sengaja pendek dan berbentuk perintah. Pengguna mendengarnya
 * sekali, sering di tengah kebisingan pasar, sambil memegang uang dan
 * menghadapi kasir yang menunggu. Kalimat panjang akan terpotong oleh keadaan.
 *
 * Perhatikan dua hal saat mengubahnya:
 *
 *   - Setiap frasa harus memberi tahu pengguna apa yang bisa ia LAKUKAN, bukan
 *     hanya apa yang sedang terjadi. "Memindai" tidak berguna; "arahkan kamera
 *     ke uang" berguna.
 *   - Menambah frasa baru berarti ada satu potongan audio baru yang harus
 *     dirender. Frasa yang belum dirender akan terdengar sebagai keheningan.
 */

import type { IdFrasa } from '@/contracts';

export const TEKS_FRASA: Readonly<Record<IdFrasa, string>> = {
  arahkan_kamera: 'Arahkan kamera ke uang',
  belum_yakin_ulangi: 'Belum yakin. Coba pindai lagi',
  renggangkan_lembaran: 'Renggangkan lembarannya',
  total_belanja: 'Total belanja',
  uang_dibayar: 'Uang dibayar',
  kembalian: 'Kembalian',
  ditambah_koin: 'ditambah koin',
  uang_kurang: 'Uang kurang dari total belanja',
  transaksi_dibatalkan: 'Transaksi dibatalkan',
  transaksi_selesai: 'Transaksi selesai',
  mode_siaga: 'Siap memindai',
  terdeteksi: 'Terdeteksi',
  total: 'Total',
  tidak_ada_uang: 'Tidak ada uang terdeteksi',
};
