/**
 * Papan angka untuk memasukkan total belanja.
 *
 * Menggantikan deret tombol pecahan. Alasannya keramahan, bukan estetika:
 * tata letak 1-2-3 / 4-5-6 / 7-8-9 / 0 adalah tata letak papan panggil telepon
 * — hal yang sudah dihafal jari setiap pengguna Android, termasuk yang tidak
 * bisa melihat layar. Deret tombol pecahan menuntut mempelajari delapan
 * tombol baru yang hanya ada di aplikasi ini. Lihat ADR-0011.
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

  function hapusSatu(): void {
    onUbah(Math.floor(nilai / 10));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Kartu nilai. Mengikuti prototipe: pertanyaan di atas, angka besar
          di bawahnya, di atas bidang biru muda. */}
      <div
        className="shrink-0 rounded-3xl px-5 py-4"
        style={{ backgroundColor: '#8fb2fb' }}
      >
        <div className="text-base font-bold text-white">{pertanyaan}</div>
        <div
          className="mt-1 text-6xl font-extrabold tracking-tight text-[var(--color-tinta)]"
          aria-hidden="true"
        >
          Rp{nilai.toLocaleString('id-ID')}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Tuts key={d} label={NAMA_ANGKA[d] ?? String(d)} onTekan={() => tambahDigit(d)}>
            {d}
          </Tuts>
        ))}

        <Tuts
          label={`Hapus semua, kembalikan ${namaKolom} ke nol`}
          nada="kuat"
          onTekan={() => onUbah(0)}
        >
          AC
        </Tuts>

        <Tuts label="nol" onTekan={() => tambahDigit(0)}>
          0
        </Tuts>

        <Tuts label="Hapus satu angka terakhir" nada="kuat" onTekan={hapusSatu}>
          <IkonHapus />
        </Tuts>
      </div>
    </div>
  );
}

function Tuts({
  label,
  onTekan,
  nada = 'lembut',
  children,
}: {
  readonly label: string;
  readonly onTekan: () => void;
  readonly nada?: 'lembut' | 'kuat';
  readonly children: React.ReactNode;
}) {
  const gaya =
    nada === 'kuat'
      ? 'bg-[var(--color-primer)] text-white active:bg-[var(--color-primer-tekan)]'
      : 'bg-[#a8d4f5] text-[var(--color-tinta)] active:bg-[#8cc3ef]';

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onTekan}
      className={`flex min-h-[var(--spacing-sentuh)] items-center justify-center rounded-2xl text-4xl font-bold ${gaya}`}
    >
      {children}
    </button>
  );
}

function IkonHapus() {
  return (
    <svg viewBox="0 0 24 24" className="size-9" fill="none" aria-hidden="true">
      <path
        d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m12 10 4 4m0-4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
