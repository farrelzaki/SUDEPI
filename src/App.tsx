/**
 * Layar tanda sementara — bukti scaffold hidup.
 *
 * FAJAR: berkas ini milikmu mulai Fase 1. Ganti isinya dengan kerangka layar
 * sungguhan sesuai `docs/AKSESIBILITAS.md` (pola dua tombol: tindakan utama
 * 75% tinggi, "Batalkan" 25% di bawah dengan posisi tetap di semua fase).
 *
 * Contoh memakai pemindai bohongan dari Farrel, supaya kamu bisa membangun UI
 * tanpa menunggu model dan kamera siap:
 *
 *   import { buatMockPemindai } from '@/vision/mockPemindai';
 *
 *   const pemindai = useMemo(() => buatMockPemindai(), []);
 *   useEffect(() => {
 *     const lepas = pemindai.langgan(setHasil);
 *     void pemindai.mulai(1);
 *     return () => { lepas(); pemindai.berhenti(); };
 *   }, [pemindai]);
 *
 * Naskahnya sengaja memuat kasus buruk (tidak ada objek, belum stabil,
 * abstain), bukan hanya jalur bahagia.
 */

import { JUMLAH_KELAS, UKURAN_MASUKAN } from '@/contracts';

export default function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black p-8 text-center text-white">
      <h1 className="text-5xl font-bold tracking-tight">SUDEPI</h1>
      <p className="text-xl text-neutral-300">Suara Deteksi Rupiah</p>
      <p className="mt-6 text-sm text-neutral-500">
        Scaffold hidup — {JUMLAH_KELAS} kelas, masukan {UKURAN_MASUKAN}px
      </p>
    </main>
  );
}
