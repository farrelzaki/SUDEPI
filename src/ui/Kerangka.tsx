/**
 * Kerangka layar, tombol, dan motif.
 *
 * Susunannya mengikuti prototipe Fajar di `UI reference/`: bilah atas berisi
 * tombol kembali, penghitung langkah, judul, dan batang kemajuan; lalu isi;
 * lalu area aksi di bawah. Itu juga pola baku aplikasi Android berlangkah, dan
 * kemiripan itu disengaja — pengguna tunanetra kami memakai Android setiap
 * hari, jadi hal paling ramah yang bisa kami lakukan adalah berperilaku seperti
 * aplikasi Android lain, bukan menciptakan tata cara sendiri.
 *
 * KETUK DI MANA SAJA TETAP HIDUP. Prototipe Fajar mempertahankannya dan itu
 * keputusan yang tepat, jadi ia tetap ada sebagai `LapisanKetuk`: seluruh layar
 * adalah sasaran tindakan utama, sementara tombol yang terlihat melakukan hal
 * yang sama untuk orang yang bisa melihatnya. Lapisan itu `aria-hidden`, sebab
 * tanpa itu TalkBack menemukan DUA kendali yang mengerjakan satu pekerjaan dan
 * pengguna harus menebak mana yang benar.
 */

import type { ReactNode } from 'react';

/* -------------------------------------------------------------------- motif */

/**
 * Kode tunanetra pada uang kertas Rupiah.
 *
 * Setiap lembar Rupiah punya sepasang tanda timbul di tepinya — jumlah
 * pasangannya menunjukkan pecahan, dan itu dibaca dengan meraba. Motif inilah
 * yang dipakai sebagai tanda struktural di seluruh aplikasi.
 *
 * Bukan hiasan yang dipilih karena terlihat bagus. Ia adalah instrumen
 * aksesibilitas milik uang itu sendiri, sudah ada jauh sebelum aplikasi ini,
 * dan memakainya sebagai lambang berarti mengakui bahwa kami meneruskan
 * sesuatu, bukan menemukannya.
 */
export function KodeTunanetra({
  jumlah = 3,
  warna = 'currentColor',
  ukuran = 10,
}: {
  readonly jumlah?: number;
  readonly warna?: string;
  readonly ukuran?: number;
}) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: jumlah }, (_, i) => (
        <span
          key={i}
          className="block rounded-[2px]"
          style={{
            width: ukuran,
            height: ukuran / 2.5,
            backgroundColor: warna,
          }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------- tombol */

type Ragam = 'primer' | 'sekunder' | 'hantu';

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
  readonly gelap?: boolean;
  readonly children: ReactNode;
}

export function Tombol({
  label,
  onAktif,
  ragam = 'primer',
  nonaktif = false,
  gelap = false,
  children,
}: TombolProps) {
  const dasar =
    'flex min-h-[var(--spacing-sentuh)] w-full items-center justify-center gap-2.5 rounded-[1.25rem] px-5 text-xl font-bold transition-[transform,background-color] duration-100 active:scale-[0.985] disabled:opacity-40';

  const gaya: Record<Ragam, string> = {
    primer:
      'bg-[var(--color-primer)] text-white shadow-[var(--shadow-primer)] active:bg-[var(--color-primer-tekan)]',
    sekunder: gelap
      ? 'bg-white/10 text-[var(--color-kasir-teks)] active:bg-white/20'
      : 'bg-[var(--color-kartu)] text-[var(--color-tinta)] shadow-[var(--shadow-kartu)] active:bg-[var(--color-kertas)]',
    hantu: gelap
      ? 'text-[var(--color-kasir-redup)] active:bg-white/10'
      : 'text-[var(--color-tinta-redup)] active:bg-black/5',
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={nonaktif}
      onClick={onAktif}
      className={`${dasar} ${gaya[ragam]}`}
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

/* ----------------------------------------------------------------- kerangka */

export const TOTAL_LANGKAH = 4;

export interface KerangkaProps {
  /** 1..4, menghasilkan "01 / 04" dan batang kemajuan. Null menyembunyikannya. */
  readonly langkah: number | null;
  readonly judul: string;
  readonly subjudul?: string;
  readonly onKembali?: () => void;
  readonly children: ReactNode;
  /** Area aksi di bawah, biasanya satu atau dua tombol. */
  readonly aksi: ReactNode;
  /** Kalimat kecil di atas area aksi, seperti pada prototipe. */
  readonly petunjuk?: string;
  /** Layar pedagang dan layar selesai memakai ground gelap. */
  readonly gelap?: boolean;
  /** Isi menempel penuh tanpa bantalan — dipakai layar kamera. */
  readonly isiPenuh?: boolean;
}

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
      /* Dibatasi lebarnya dan dipusatkan. Aplikasi ini hidup di layar ponsel;
         batas ini hanya berlaku di layar lebar, dan membuat pratinjau di
         browser desktop mewakili apa yang sebenarnya dilihat pengguna. */
      className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden"
      style={{
        backgroundColor: gelap
          ? 'var(--color-kasir-latar)'
          : 'var(--color-kertas)',
      }}
    >
      <header className="relative z-10 shrink-0 px-6 pt-4 pb-3">
        <div className="flex h-11 items-center gap-3">
          {onKembali ? (
            <button
              type="button"
              aria-label="Kembali ke langkah sebelumnya"
              onClick={onKembali}
              className="-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors"
              style={{
                color: tinta,
                borderColor: gelap ? 'rgb(255 255 255 / 0.14)' : 'var(--color-garis)',
                backgroundColor: gelap ? 'rgb(255 255 255 / 0.05)' : 'var(--color-kartu)',
              }}
            >
              <PanahKiri />
            </button>
          ) : (
            <KodeTunanetra jumlah={3} warna="var(--color-primer)" ukuran={13} />
          )}

          {langkah !== null && (
            <div
              className="ml-auto rounded-full px-3 py-1.5 font-mono text-sm font-semibold tracking-[0.16em]"
              style={{
                color: gelap ? 'var(--color-kasir-teks)' : 'var(--color-primer)',
                backgroundColor: gelap
                  ? 'rgb(255 255 255 / 0.08)'
                  : 'var(--color-primer-tipis)',
              }}
              aria-label={`Langkah ${langkah} dari ${TOTAL_LANGKAH}`}
            >
              <span aria-hidden="true">
                {String(langkah).padStart(2, '0')}
                <span style={{ opacity: 0.45 }}>
                  {' / '}
                  {String(TOTAL_LANGKAH).padStart(2, '0')}
                </span>
              </span>
            </div>
          )}
        </div>

        <h1
          className="mt-3 text-[1.75rem] font-extrabold leading-tight tracking-[-0.02em] text-balance"
          style={{ color: tinta }}
        >
          {judul}
        </h1>
        {subjudul && (
          <p
            className="mt-1.5 max-w-[34ch] text-[0.9375rem] leading-relaxed"
            style={{ color: redup }}
          >
            {subjudul}
          </p>
        )}

        {langkah !== null && (
          <div
            className="mt-4 flex gap-1.5"
            role="presentation"
            aria-hidden="true"
          >
            {Array.from({ length: TOTAL_LANGKAH }, (_, i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor:
                    i < langkah
                      ? 'var(--color-primer)'
                      : gelap
                        ? 'rgb(255 255 255 / 0.12)'
                        : 'var(--color-garis)',
                }}
              />
            ))}
          </div>
        )}
      </header>

      <main
        className={`relative z-10 min-h-0 flex-1 ${isiPenuh ? 'px-3 pb-1' : 'px-6 py-3'}`}
      >
        {children}
      </main>

      <footer className="relative z-10 shrink-0 px-6 pt-3 pb-6">
        {petunjuk && (
          <p
            className="mb-3 text-center text-[0.8125rem] leading-snug"
            style={{ color: gelap ? 'var(--color-kasir-redup)' : 'var(--color-tinta-samar)' }}
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
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
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
