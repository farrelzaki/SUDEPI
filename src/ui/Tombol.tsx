/**
 * Dua tombol yang membentuk setiap layar.
 *
 * Pola tetapnya: tindakan utama mengisi 75% tinggi layar, "Batalkan" mengisi
 * 25% di bawah, dan posisinya TIDAK PERNAH berubah antar fase.
 *
 * Alasannya bukan estetika. Pengguna tunanetra menavigasi lewat ingatan otot
 * dan posisi tetap, bukan dengan memindai layar. Tata letak yang berubah-ubah
 * memaksa penjelajahan ulang setiap kali, dan itu persis beban yang ingin kita
 * hapus.
 *
 * Keduanya `<button>` semantik. Lihat ADR-0008: dengan TalkBack aktif, ketuk
 * ganda pengguna sampai ke sini sebagai satu `click` — persis seperti yang
 * dijanjikan exsum, tanpa kode gestur sama sekali.
 */

import type { ReactNode } from 'react';

export interface TombolUtamaProps {
  /**
   * Dibacakan TalkBack. Harus menjawab dua hal sekaligus: apa keadaannya
   * sekarang, dan apa yang terjadi kalau diaktifkan.
   */
  readonly label: string;
  readonly onAktif: () => void;
  readonly nonaktif?: boolean;
  readonly children: ReactNode;
}

export function TombolUtama({
  label,
  onAktif,
  nonaktif = false,
  children,
}: TombolUtamaProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={nonaktif}
      onClick={onAktif}
      className="relative flex h-[75dvh] w-full flex-col items-center justify-center overflow-hidden bg-black text-white disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export interface TombolBatalProps {
  readonly onBatal: () => void;
  readonly label?: string;
}

/**
 * Jalan keluar yang selalu ada.
 *
 * Exsum menetapkan Escape-Hatch berupa ketuk ganda yang ditahan 2 detik, tetapi
 * gestur tahan tidak diteruskan TalkBack dengan andal — sehingga pembatalan
 * darurat justru tidak terjangkau oleh pengguna yang paling membutuhkannya.
 * Tombol permanen ini adalah jalur setaranya. Lihat ADR-0006.
 *
 * Ia hadir di setiap fase kecuali Mode Siaga, di posisi yang sama persis,
 * supaya bisa ditemukan tanpa dicari.
 */
export function TombolBatal({ onBatal, label }: TombolBatalProps) {
  return (
    <button
      type="button"
      aria-label={label ?? 'Batalkan transaksi dan kembali ke mode siaga'}
      onClick={onBatal}
      className="flex h-[25dvh] w-full items-center justify-center border-t-4 border-white/30 bg-[var(--color-batal)] text-4xl font-bold tracking-wide text-white"
    >
      BATALKAN
    </button>
  );
}
