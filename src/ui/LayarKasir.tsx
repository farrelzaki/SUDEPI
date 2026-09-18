/**
 * Merchant Display — Fase 3.
 *
 * SATU-SATUNYA layar di aplikasi ini yang dirancang untuk mata. Bukan mata
 * pengguna, melainkan mata pedagang: dilihat sekilas dari jarak sekitar satu
 * meter, seringkali di bawah cahaya lapak yang buruk, oleh orang yang belum
 * pernah melihat aplikasi ini dan tidak akan diberi penjelasan.
 *
 * Karena itu tiga angka saja, masing-masing berlabel jelas, tanpa ikon, tanpa
 * hiasan, tanpa penjelasan. Apa pun yang ditambahkan di sini akan memperlambat
 * pembacaan sekilas, dan itulah satu-satunya hal yang perlu layar ini lakukan.
 *
 * Inilah bagian "Provider" dari tema Receiver and Provider: pedagang bisa
 * memverifikasi sendiri, sehingga kepercayaan tidak bergantung pada salah satu
 * pihak saja.
 */

export interface LayarKasirProps {
  readonly totalBelanja: number;
  readonly uangDibayar: number;
  readonly kembalian: number;
}

function Baris({
  label,
  nilai,
  sorot = false,
}: {
  readonly label: string;
  readonly nilai: number;
  readonly sorot?: boolean;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="text-2xl font-semibold uppercase tracking-[0.2em] text-white/70">
        {label}
      </div>
      <div
        className="font-bold leading-none tabular-nums"
        style={{
          fontSize: 'var(--text-kasir)',
          // Kontras 7:1, melampaui syarat AA yang 4,5:1. Alasannya praktis,
          // bukan formal: layar ini akan dibaca di bawah sinar matahari pasar.
          color: sorot ? 'var(--color-kasir-sorot)' : 'var(--color-kasir-teks)',
        }}
      >
        {nilai.toLocaleString('id-ID')}
      </div>
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
      className="flex h-full w-full flex-col items-center justify-around px-4 py-6"
      style={{ backgroundColor: 'var(--color-kasir-latar)' }}
    >
      <Baris label="Belanja" nilai={totalBelanja} />
      <Baris label="Dibayar" nilai={uangDibayar} />
      <Baris label="Kembalian" nilai={kembalian} sorot />
    </div>
  );
}
