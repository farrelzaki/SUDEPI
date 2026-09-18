/**
 * Papan angka untuk memasukkan total belanja.
 *
 * Menggantikan deret tombol pecahan. Alasannya keramahan, bukan estetika:
 * tata letak 1-2-3 / 4-5-6 / 7-8-9 / 0 adalah tata letak papan panggil telepon
 * — hal yang sudah dihafal jari setiap pengguna Android, termasuk yang tidak
 * bisa melihat layar. Deret tombol pecahan menuntut mempelajari delapan tombol
 * baru yang hanya ada di aplikasi ini. Lihat ADR-0011.
 *
 * Angka masuk dari kanan seperti kalkulator dan mesin kasir: menekan 5, 0, 0,
 * 0, 0 menghasilkan 50.000. Tidak ada koma, tidak ada sen, tidak ada nominal
 * mustahil — nilainya selalu bilangan bulat.
 *
 * NILAINYA TIDAK DIBACAKAN TalkBack. Suara kami sudah menyebutkannya setiap
 * kali berubah; membiarkan TalkBack ikut membacanya membuat pengguna mendengar
 * angka yang sama dua kali dari dua suara berbeda, sering bertumpuk. Itu
 * kesalahan nomor 8 di docs/PROGRES.md, dan tidak diulang di sini.
 */

const DIGIT_MAKS = 7; // Rp9.999.999 — di atas itu bukan transaksi warung.

const NAMA_ANGKA = [
  'nol',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
] as const;

export interface PapanAngkaProps {
  readonly nilai: number;
  readonly onUbah: (nilai: number) => void;
  /** Muncul di label tombol, misalnya "total belanja". */
  readonly namaKolom: string;
  readonly pertanyaan: string;
}

export function PapanAngka({
  nilai,
  onUbah,
  namaKolom,
  pertanyaan,
}: PapanAngkaProps) {
  function tambahDigit(d: number): void {
    const teks = String(nilai === 0 ? '' : nilai) + String(d);
    if (teks.length > DIGIT_MAKS) return;
    onUbah(Number(teks));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Kartu nilai. Biru pekat dan angka putih: inilah satu-satunya tempat
          warna berani dipakai di layar ini, sehingga papan angka di bawahnya
          bisa tetap tenang dan angkanya tidak bersaing dengan apa pun. */}
      <div
        className="relative shrink-0 overflow-hidden rounded-[1.5rem] px-6 py-5"
        style={{
          backgroundColor: 'var(--color-primer)',
          boxShadow: 'var(--shadow-primer)',
        }}
      >
        <span className="eyebrow text-white/70">{pertanyaan}</span>

        <div className="mt-2.5 flex items-baseline gap-1.5" aria-hidden="true">
          <span className="text-2xl font-semibold text-white/60">Rp</span>
          <span className="nominal text-[3.25rem] text-white">
            {nilai.toLocaleString('id-ID')}
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-2.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Tuts key={d} label={NAMA_ANGKA[d] ?? String(d)} onTekan={() => tambahDigit(d)}>
            {d}
          </Tuts>
        ))}

        <Tuts
          label={`Hapus semua, kembalikan ${namaKolom} ke nol`}
          nada="redam"
          onTekan={() => onUbah(0)}
        >
          <span className="text-2xl tracking-wide">AC</span>
        </Tuts>

        <Tuts label="nol" onTekan={() => tambahDigit(0)}>
          0
        </Tuts>

        <Tuts
          label="Hapus satu angka terakhir"
          nada="redam"
          onTekan={() => onUbah(Math.floor(nilai / 10))}
        >
          <IkonHapus />
        </Tuts>
      </div>
    </div>
  );
}

function Tuts({
  label,
  onTekan,
  nada = 'utama',
  children,
}: {
  readonly label: string;
  readonly onTekan: () => void;
  readonly nada?: 'utama' | 'redam';
  readonly children: React.ReactNode;
}) {
  const utama = nada === 'utama';
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onTekan}
      className="flex min-h-[3.5rem] items-center justify-center rounded-[1.125rem] text-[1.875rem] font-bold transition-[transform,background-color] duration-75 active:scale-[0.96]"
      style={{
        backgroundColor: utama
          ? 'var(--color-kartu)'
          : 'var(--color-primer-tipis)',
        color: utama ? 'var(--color-tinta)' : 'var(--color-primer)',
        boxShadow: utama ? 'var(--shadow-kartu)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function IkonHapus() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden="true">
      <path
        d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m12 10 4 4m0-4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
