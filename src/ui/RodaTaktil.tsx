/**
 * Pemasukan nominal secara taktil.
 *
 * Jalur input UTAMA, bukan alternatif. Lihat ADR-0005: perintah suara tidak
 * bisa berjalan luring, sedangkan ini kebal kebisingan pasar, kebal variasi
 * logat, dan selalu berperilaku sama.
 *
 * Rancangannya memakai penambahan per pecahan, bukan papan angka. Orang
 * memikirkan uang dalam satuan lembar — "dua lembar dua puluh ribu" — bukan
 * dalam digit. Menambah per pecahan juga berarti tidak ada nominal mustahil
 * yang bisa dimasukkan.
 *
 * Tidak ada gestur seret sama sekali, memenuhi WCAG 2.2 kriteria 2.5.7. Nama
 * "roda" di exsum merujuk pada cara memutar nilai naik-turun; di sini
 * diwujudkan sebagai deret tombol besar berposisi tetap, yang jauh lebih mudah
 * dijangkau pengguna TalkBack daripada gerakan melingkar.
 */

import { NOMINAL_URUT, type Nominal } from '@/contracts';
import { rupiahKeTeks } from '@/audio/angka';

export interface RodaTaktilProps {
  readonly nilai: number;
  readonly onUbah: (nilai: number) => void;
  /** Muncul di label, misalnya "total belanja" atau "uang dibayar". */
  readonly namaKolom: string;
}

export function RodaTaktil({ nilai, onUbah, namaKolom }: RodaTaktilProps) {
  return (
    <div className="flex w-full flex-col gap-2 p-3">
      {/*
        Nilai berjalan diumumkan lewat aria-live supaya pengguna TalkBack
        mendengar perubahannya tanpa harus memindahkan fokus ke sini.
        'polite' dengan sengaja: 'assertive' akan memotong pembacaan tombol
        yang baru saja ditekan.
      */}
      <div
        role="status"
        aria-live="polite"
        aria-label={`${namaKolom} ${rupiahKeTeks(nilai)}`}
        className="rounded-2xl bg-white/10 py-4 text-center"
      >
        <div className="text-base uppercase tracking-widest text-white/60">
          {namaKolom}
        </div>
        <div className="text-5xl font-bold tabular-nums text-white">
          {nilai.toLocaleString('id-ID')}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {NOMINAL_URUT.map((n: Nominal) => (
          <button
            key={n}
            type="button"
            aria-label={`Tambah ${rupiahKeTeks(n)}`}
            onClick={() => onUbah(nilai + n)}
            className="min-h-20 rounded-2xl bg-white/15 text-3xl font-bold tabular-nums text-white active:bg-white/30"
          >
            +{n.toLocaleString('id-ID')}
          </button>
        ))}

        <button
          type="button"
          aria-label="Hapus, kembalikan ke nol"
          onClick={() => onUbah(0)}
          className="min-h-20 rounded-2xl bg-[var(--color-abstain)] text-3xl font-bold text-black active:opacity-80"
        >
          HAPUS
        </button>
      </div>
    </div>
  );
}
