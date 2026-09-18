/**
 * Fase 2 — kalkulator.
 *
 * Satu-satunya fase yang TIDAK memakai `TombolUtama` sebagai pembungkus, dan
 * alasannya penting.
 *
 * Versi pertama membungkus roda taktil di dalam tombol utama yang mengisi 75%
 * layar. Hasilnya `<button>` bersarang di dalam `<button>` — HTML melarangnya,
 * dan klik pada tombol pecahan menggelembung ke induknya. Akibatnya: pengguna
 * menekan "+50.000" untuk memasukkan total belanja, tetapi yang terjadi adalah
 * nominal terkunci pada NOL dan aplikasi langsung melompat ke layar kasir,
 * menampilkan kembalian sebesar seluruh uang yang dibayarkan.
 *
 * Artinya angka yang salah ditunjukkan kepada pedagang — persis kegagalan yang
 * seluruh produk ini ada untuk mencegahnya. Ditemukan saat menelusuri
 * antarmuka sungguhan; tidak ada tes unit yang bisa menangkapnya.
 *
 * Karena itu di sini tombol lanjut berdiri sendiri, sejajar dengan tombol
 * pecahan, tanpa ada yang bersarang.
 */

import { rupiahKeTeks } from '@/audio/angka';
import { RodaTaktil } from './RodaTaktil';

export interface PanelKalkulatorProps {
  readonly nilai: number;
  readonly onUbah: (nilai: number) => void;
  readonly onLanjut: () => void;
}

export function PanelKalkulator({
  nilai,
  onUbah,
  onLanjut,
}: PanelKalkulatorProps) {
  return (
    <div className="flex h-[75dvh] w-full flex-col bg-black">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <RodaTaktil nilai={nilai} onUbah={onUbah} namaKolom="Total belanja" />
      </div>

      <button
        type="button"
        aria-label={`Kunci total belanja ${rupiahKeTeks(nilai)} dan lanjut`}
        onClick={onLanjut}
        className="mx-3 mb-3 min-h-24 shrink-0 rounded-2xl bg-[var(--color-stabil)] text-4xl font-bold text-black active:opacity-80"
      >
        LANJUT
      </button>
    </div>
  );
}
