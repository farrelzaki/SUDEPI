/**
 * Kerangka layar dan tombol.
 *
 * Mengikuti struktur prototipe Fajar di `UI reference/`: bilah atas berisi
 * tombol kembali, penghitung langkah, judul, dan batang kemajuan; lalu isi;
 * lalu area aksi di bawah. Itu juga pola baku aplikasi Android berlangkah,
 * dan kemiripan itu disengaja — pengguna tunanetra kami sudah memakai Android
 * setiap hari, jadi hal paling ramah yang bisa kami lakukan adalah berperilaku
 * seperti aplikasi Android lain, bukan menciptakan tata cara sendiri.
 *
 * KETUK DI MANA SAJA TETAP HIDUP. Prototipe Fajar mempertahankannya dan itu
 * keputusan yang tepat, jadi ia tetap ada di sini sebagai `LapisanKetuk`:
 * seluruh layar adalah sasaran tindakan utama, sementara tombol yang terlihat
 * melakukan hal yang sama untuk orang yang bisa melihatnya.
 *
 * Lapisan itu `aria-hidden`. Tanpa itu TalkBack akan menemukan DUA kendali
 * yang mengerjakan satu hal, dan pengguna harus menebak mana yang benar.
 * Sekarang pembagiannya bersih: TalkBack menelusuri tombol yang berlabel,
 * sentuhan biasa mengenai seluruh layar.
 */

import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ tombol */

type Ragam = 'primer' | 'sekunder' | 'bahaya' | 'sukses';

const GAYA: Record<Ragam, string> = {
  primer: 'bg-[var(--color-primer)] text-white active:bg-[var(--color-primer-tekan)]',
  sekunder:
    'bg-[var(--color-kartu)] text-[var(--color-tinta-redup)] border-2 border-[var(--color-garis)] active:bg-[var(--color-ground)]',
  bahaya:
    'bg-transparent text-[var(--color-bahaya)] border-2 border-[var(--color-bahaya)] active:bg-[var(--color-bahaya)]/15',
  sukses: 'bg-[var(--color-primer)] text-white active:bg-[var(--color-primer-tekan)]',
};

export interface TombolProps {
  /**
   * Dibacakan TalkBack. Harus menjawab dua hal sekaligus: apa keadaannya
   * sekarang, dan apa yang terjadi kalau diaktifkan.
   *
   * JANGAN menulis kata "ketuk" di sini — TalkBack sudah menambahkan
   * "ketuk dua kali untuk mengaktifkan" sendiri. Lihat docs/AKSESIBILITAS.md.
   */
  readonly label: string;
  readonly onAktif: () => void;
  readonly ragam?: Ragam;
  readonly nonaktif?: boolean;
  readonly children: ReactNode;
}

export function Tombol({
  label,
  onAktif,
  ragam = 'primer',
  nonaktif = false,
  children,
}: TombolProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={nonaktif}
      onClick={onAktif}
      className={`flex min-h-[var(--spacing-sentuh)] w-full items-center justify-center gap-3 rounded-2xl px-5 text-2xl font-bold disabled:opacity-50 ${GAYA[ragam]}`}
    >
      {children}
    </button>
  );
}

/**
 * Seluruh layar sebagai sasaran tindakan utama.
 *
 * Berdiri SEJAJAR dengan isi layar, tidak membungkusnya. Versi pertama
 * membungkus, dan itu menghasilkan `<button>` di dalam `<button>` — HTML
 * melarangnya, dan klik pada tombol di dalamnya menggelembung ke induknya.
 * Akibatnya menekan tombol angka justru mengunci nominal pada nol lalu
 * melompat ke layar pedagang, memperlihatkan kembalian yang salah.
 */
export function LapisanKetuk({ onAktif }: { readonly onAktif: () => void }) {
  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      onClick={onAktif}
      className="absolute inset-0 z-0 h-full w-full cursor-default"
    />
  );
}

/* ---------------------------------------------------------------- kerangka */

export interface KerangkaProps {
  /** 1..4, menghasilkan "01 / 04" dan batang kemajuan. Null menyembunyikannya. */
  readonly langkah: number | null;
  readonly judul: string;
  readonly subjudul?: string;
  readonly onKembali?: () => void;
  /** Isi layar. */
  readonly children: ReactNode;
  /** Area aksi di bawah, biasanya satu atau dua tombol. */
  readonly aksi: ReactNode;
  /** Kalimat kecil di atas area aksi, seperti pada prototipe. */
  readonly petunjuk?: string;
  /** Layar pedagang memakai ground gelap. */
  readonly gelap?: boolean;
  /** Isi menempel penuh tanpa bantalan — dipakai layar kamera. */
  readonly isiPenuh?: boolean;
}

export const TOTAL_LANGKAH = 4;

export function Kerangka({
  langkah,
  judul,
  subjudul,
  onKembali,
  children,
  aksi,
  petunjuk,
  gelap = false,
  isiPenuh = false,
}: KerangkaProps) {
  const tinta = gelap ? 'var(--color-kasir-teks)' : 'var(--color-tinta)';
  const redup = gelap ? 'var(--color-kasir-redup)' : 'var(--color-tinta-redup)';

  return (
    <div
      className="flex h-dvh w-full flex-col overflow-hidden"
      style={{
        backgroundColor: gelap ? 'var(--color-kasir-latar)' : 'var(--color-ground)',
      }}
    >
      <header className="shrink-0 px-5 pt-3 pb-2" style={{ color: tinta }}>
        <div className="flex items-center gap-3">
          {onKembali ? (
            <button
              type="button"
              aria-label="Kembali ke langkah sebelumnya"
              onClick={onKembali}
              className="-ml-2 flex size-12 shrink-0 items-center justify-center rounded-full active:bg-black/10"
              style={{ color: tinta }}
            >
              <PanahKiri />
            </button>
          ) : (
            <div className="size-12 shrink-0" />
          )}

          {langkah !== null && (
            <div
              className="font-mono text-lg tracking-widest"
              style={{ color: redup }}
              /* Dibacakan sebagai kalimat, bukan sebagai "nol dua garis miring
                 nol empat" — TalkBack membaca teks apa adanya. */
              aria-label={`Langkah ${langkah} dari ${TOTAL_LANGKAH}`}
            >
              <span aria-hidden="true">
                {String(langkah).padStart(2, '0')} / {String(TOTAL_LANGKAH).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        <h1 className="mt-1 text-3xl font-extrabold tracking-tight" style={{ color: tinta }}>
          {judul}
        </h1>
        {subjudul && (
          <p className="mt-1 text-base leading-snug" style={{ color: redup }}>
            {subjudul}
          </p>
        )}

        {langkah !== null && (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: gelap ? '#2b3a4a' : 'var(--color-garis)' }}
            role="presentation"
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${(langkah / TOTAL_LANGKAH) * 100}%`,
                backgroundColor: 'var(--color-primer)',
              }}
            />
          </div>
        )}
      </header>

      <main
        className={`relative z-10 min-h-0 flex-1 ${isiPenuh ? '' : 'px-5 py-3'}`}
      >
        {children}
      </main>

      <footer className="relative z-10 shrink-0 px-5 pt-2 pb-5">
        {petunjuk && (
          <p
            className="mb-2 text-center text-sm leading-snug"
            style={{ color: redup }}
            /* Sudah disuarakan pengucap dan tercermin di label tombol.
               Membiarkan TalkBack ikut membacanya berarti pengguna mendengar
               kalimat yang sama tiga kali. */
            aria-hidden="true"
          >
            {petunjuk}
          </p>
        )}
        <div className="flex flex-col gap-2">{aksi}</div>
      </footer>
    </div>
  );
}

function PanahKiri() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden="true">
      <path
        d="M15 5 8 12l7 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
