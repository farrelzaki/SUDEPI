/**
 * Non-Maximum Suppression, class-agnostic.
 *
 * Fungsi murni. Tanpa I/O, tanpa state.
 *
 * Kenapa class-agnostic, bukan per kelas seperti NMS bawaan: dua kotak yang
 * bertindihan berat adalah SATU lembar uang yang tertangkap dua kali, atau dua
 * lembar bertumpuk yang belum direnggangkan. Keduanya harus disaring jadi satu.
 * NMS per kelas tidak akan menyaringnya kalau kelasnya kebetulan berbeda —
 * misalnya satu kotak terbaca 50.000 dan kotak yang sama terbaca 20.000 dengan
 * skor lebih rendah. Justru kasus itulah yang paling perlu dibersihkan.
 *
 * Inilah alasan kami mengekspor model tanpa NMS. Lihat ADR-0002.
 */

import type { Deteksi, Kotak } from '@/contracts';

/**
 * Intersection over Union dua kotak.
 *
 * Kotak memakai koordinat ternormalisasi 0..1 dengan titik acuan sudut
 * kiri-atas, bukan titik tengah.
 */
export function iou(a: Kotak, b: Kotak): number {
  const kiri = Math.max(a.x, b.x);
  const atas = Math.max(a.y, b.y);
  const kanan = Math.min(a.x + a.w, b.x + b.w);
  const bawah = Math.min(a.y + a.h, b.y + b.h);

  const lebar = Math.max(0, kanan - kiri);
  const tinggi = Math.max(0, bawah - atas);
  const irisan = lebar * tinggi;
  if (irisan <= 0) return 0;

  const gabungan = a.w * a.h + b.w * b.h - irisan;
  return gabungan <= 0 ? 0 : irisan / gabungan;
}

/**
 * Menyaring kotak bertindihan, mempertahankan yang skornya tertinggi.
 *
 * Setiap deteksi yang lolos dibekali `iouMaks`, yaitu IoU tertinggi terhadap
 * kotak mana pun yang ikut dipertimbangkan sebelum penyaringan. Nilai itu tidak
 * dipakai untuk mengambil keputusan — ia disimpan sebagai jejak audit, supaya
 * saat sistem abstain kita bisa menelusuri apakah penyebabnya tumpukan yang
 * rapat atau keyakinan yang rendah.
 *
 * Urutan keluaran mengikuti skor menurun, bukan urutan masukan.
 */
export function nms(
  deteksi: readonly Deteksi[],
  ambangIoU: number,
): readonly Deteksi[] {
  if (deteksi.length <= 1) {
    return deteksi.map((d) => ({ ...d, iouMaks: 0 }));
  }

  // Salin dulu: fungsi ini tidak boleh mengubah larik milik pemanggil.
  const urut = [...deteksi].sort((a, b) => b.skor - a.skor);
  const ditekan = new Array<boolean>(urut.length).fill(false);
  const disimpan: Deteksi[] = [];

  for (let i = 0; i < urut.length; i += 1) {
    if (ditekan[i]) continue;

    const kandidat = urut[i];
    if (!kandidat) continue;

    let iouTertinggi = 0;

    for (let j = 0; j < urut.length; j += 1) {
      if (i === j) continue;
      const lain = urut[j];
      if (!lain) continue;

      const nilai = iou(kandidat.kotak, lain.kotak);
      if (nilai > iouTertinggi) iouTertinggi = nilai;

      // Hanya tekan yang skornya lebih rendah, yaitu yang berada di belakang
      // dalam urutan. Yang di depan sudah diputuskan lebih dulu.
      if (j > i && nilai > ambangIoU) ditekan[j] = true;
    }

    disimpan.push({ ...kandidat, iouMaks: iouTertinggi });
  }

  return disimpan;
}

/**
 * Membuang deteksi yang keyakinannya di bawah ambang.
 *
 * Dipisah dari NMS supaya urutannya jelas dan bisa diuji sendiri-sendiri:
 * gating dulu, baru NMS. Menyaring lebih dulu membuat NMS bekerja pada kotak
 * yang jauh lebih sedikit.
 */
export function gating(
  deteksi: readonly Deteksi[],
  ambangKeyakinan: number,
): readonly Deteksi[] {
  return deteksi.filter((d) => d.skor >= ambangKeyakinan);
}
