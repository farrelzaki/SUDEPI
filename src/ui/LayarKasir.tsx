/**
 * Merchant Display — Fase 3.
 *
 * SATU-SATUNYA layar di aplikasi ini yang dirancang untuk mata. Bukan mata
 * pengguna, melainkan mata pedagang: dilihat sekilas dari jarak sekitar satu
 * meter, sering di bawah cahaya lapak yang buruk, oleh orang yang belum pernah
 * melihat aplikasi ini dan tidak akan diberi penjelasan.
 *
 * Karena itu setiap keputusan di sini tunduk pada satu pertanyaan: apakah ini
 * mempercepat atau memperlambat satu kali lirikan?
 *
 * Belanja dan Dibayar berdampingan dalam ukuran kecil — keduanya ada supaya
 * angka ketiga bisa DIPERIKSA, bukan untuk dibaca lebih dulu. Kembalian berdiri
 * sendiri, jauh lebih besar, dan satu-satunya yang berwarna. Pedagang hampir
 * selalu hanya perlu angka itu.
 *
 * Inilah bagian "Provider" dari tema Receiver and Provider: pedagang bisa
 * memverifikasi sendiri, sehingga kepercayaan tidak bergantung pada satu pihak.
 */

import { KodeTunanetra } from './Kerangka';

export interface LayarKasirProps {
  readonly totalBelanja: number;
  readonly uangDibayar: number;
  readonly kembalian: number;
}

function rp(n: number): string {
  return n.toLocaleString('id-ID');
}

function Pendukung({
  label,
  nilai,
}: {
  readonly label: string;
  readonly nilai: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="eyebrow" style={{ color: 'var(--color-kasir-redup)' }}>
        {label}
      </span>
      <span
        className="nominal text-[1.75rem]"
        style={{ color: 'var(--color-kasir-teks)' }}
      >
        Rp{rp(nilai)}
      </span>
    </div>
  );
}

export function LayarKasir({
  totalBelanja,
  uangDibayar,
  kembalian,
}: LayarKasirProps) {
  return (
    <div
      className="flex h-full w-full flex-col justify-center gap-7 rounded-[1.75rem] px-7 py-7"
      style={{ backgroundColor: 'var(--color-kasir-panel)' }}
    >
      <div className="grid grid-cols-2 gap-4">
        <Pendukung label="Belanja" nilai={totalBelanja} />
        <Pendukung label="Dibayar" nilai={uangDibayar} />
      </div>

      <div
        className="h-px w-full"
        style={{ backgroundColor: 'rgb(255 255 255 / 0.12)' }}
        role="presentation"
      />

      <div className="flex flex-col items-center gap-2 py-2">
        <span className="eyebrow" style={{ color: 'var(--color-kasir-redup)' }}>
          Kembalian
        </span>
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-bold"
            style={{ color: 'rgb(255 214 10 / 0.55)' }}
          >
            Rp
          </span>
          <span
            className="nominal"
            style={{
              fontSize: 'var(--text-kasir)',
              color: 'var(--color-kasir-sorot)',
            }}
          >
            {rp(kembalian)}
          </span>
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-2.5"
        style={{ color: 'var(--color-kasir-redup)' }}
      >
        <KodeTunanetra jumlah={3} warna="currentColor" ukuran={9} />
        <span className="eyebrow">Dihitung SUDEPI</span>
      </div>
    </div>
  );
}
