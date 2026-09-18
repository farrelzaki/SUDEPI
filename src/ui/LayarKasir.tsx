/**
 * Merchant Display — Fase 3.
 *
 * SATU-SATUNYA layar di aplikasi ini yang dirancang untuk mata. Bukan mata
 * pengguna, melainkan mata pedagang: dilihat sekilas dari jarak sekitar satu
 * meter, sering di bawah cahaya lapak yang buruk, oleh orang yang belum pernah
 * melihat aplikasi ini dan tidak akan diberi penjelasan.
 *
 * Karena itu tiga angka saja, masing-masing berlabel, tanpa ikon dekoratif dan
 * tanpa penjelasan. Apa pun yang ditambahkan di sini memperlambat pembacaan
 * sekilas, dan itulah satu-satunya hal yang perlu layar ini lakukan.
 *
 * Yang membedakannya dari tiga angka biasa: KEMBALIAN disorot kuning dan
 * dibuat paling besar. Pedagang hampir selalu hanya perlu satu angka itu, dan
 * dua angka lain ada untuk membuatnya bisa diperiksa, bukan untuk dibaca lebih
 * dulu.
 *
 * Inilah bagian "Provider" dari tema Receiver and Provider: pedagang bisa
 * memverifikasi sendiri, sehingga kepercayaan tidak bergantung pada satu pihak.
 */

export interface LayarKasirProps {
  readonly totalBelanja: number;
  readonly uangDibayar: number;
  readonly kembalian: number;
}

function Baris({
  label,
  nilai,
  utama = false,
}: {
  readonly label: string;
  readonly nilai: number;
  readonly utama?: boolean;
}) {
  return (
    <div className="flex w-full flex-col items-center">
      <div
        className="text-lg font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'var(--color-kasir-redup)' }}
      >
        {label}
      </div>
      <div
        className="font-extrabold leading-none tracking-tight"
        style={{
          fontSize: utama ? 'var(--text-kasir)' : 'calc(var(--text-kasir) * 0.62)',
          color: utama ? 'var(--color-kasir-sorot)' : 'var(--color-kasir-teks)',
        }}
      >
        Rp{nilai.toLocaleString('id-ID')}
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
      className="flex h-full w-full flex-col items-center justify-center gap-5 rounded-3xl px-4 py-6"
      style={{ backgroundColor: 'var(--color-kasir-panel)' }}
    >
      <Baris label="Belanja" nilai={totalBelanja} />
      <Baris label="Dibayar" nilai={uangDibayar} />

      <div
        className="h-1 w-4/5 rounded-full"
        style={{ backgroundColor: 'var(--color-kasir-teks)' }}
        role="presentation"
      />

      <Baris label="Kembalian" nilai={kembalian} utama />
    </div>
  );
}
