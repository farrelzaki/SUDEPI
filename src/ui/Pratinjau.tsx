/**
 * Pratinjau kamera dan kartu hasil.
 *
 * Elemen video ini `aria-hidden` dengan sengaja. Ia tidak menyampaikan apa pun
 * kepada pengguna tunanetra, dan memasukkannya ke urutan fokus TalkBack hanya
 * menambah satu perhentian kosong yang harus dilewati.
 *
 * Seluruh lapisan di atas kamera juga `aria-hidden`, karena isinya sudah
 * disuarakan pengucap dan tercermin di label tombol utama. Membiarkan TalkBack
 * ikut membacanya membuat nominal terdengar dua kali dari dua suara berbeda —
 * kesalahan nomor 8 di docs/PROGRES.md.
 *
 * Jadi untuk siapa lapisan ini dirancang? Untuk tiga orang lain: pengguna
 * dengan sisa penglihatan, pendamping yang membantu mengarahkan, dan pedagang
 * yang ingin ikut memastikan. Merekalah alasan layar ini tetap dikerjakan
 * serius walaupun pengguna utamanya tidak melihatnya.
 */

import type { HasilPindai } from '@/contracts';

/**
 * Apakah overlay metrik ditampilkan.
 *
 * Dihitung saat build, bukan saat berjalan, sehingga overlay beserta datanya
 * hilang sepenuhnya dari bundel produksi. Nyala di dev server dan pada
 * `pnpm cap:kalibrasi`; MATI pada `pnpm cap:sync` biasa — yaitu APK yang
 * dibawa ke penjurian.
 */
const TAMPILKAN_METRIK =
  import.meta.env.DEV || import.meta.env.VITE_METRIK === '1';

export interface PratinjauProps {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly hasil: HasilPindai | null;
  readonly onSenter?: (nyala: boolean) => void;
}

export function Pratinjau({ videoRef, hasil, onSenter }: PratinjauProps) {
  const senterAktif = hasil?.senterAktif ?? false;
  const status = hasil?.status;
  const warna = warnaStatus(status);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] bg-black">
      <video
        ref={videoRef}
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        muted
      />

      {/* Gelap di tepi atas dan bawah supaya teks di atasnya tetap terbaca
          apa pun yang sedang dilihat kamera. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/75 to-transparent"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
        aria-hidden="true"
      />

      {/* Bilah kamera. Mengikuti prototipe, tetapi TANPA tombol balik kamera:
          kami hanya memakai kamera belakang, dan tombol yang tidak melakukan
          apa-apa lebih buruk daripada tombol yang tidak ada. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 py-3">
        {onSenter && (
          <button
            type="button"
            aria-label={senterAktif ? 'Matikan senter kamera' : 'Nyalakan senter kamera'}
            aria-pressed={senterAktif}
            onClick={() => onSenter(!senterAktif)}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors"
            style={{
              borderColor: senterAktif ? 'var(--color-ingat)' : 'rgb(255 255 255 / 0.25)',
              backgroundColor: senterAktif ? 'rgb(242 198 109 / 0.2)' : 'rgb(0 0 0 / 0.35)',
              color: senterAktif ? 'var(--color-ingat)' : '#fff',
            }}
          >
            <IkonSenter nyala={senterAktif} />
          </button>
        )}

        <div className="ml-auto" aria-hidden="true">
          <Lencana warna={warna} teks={teksStatus(status)} />
        </div>
      </div>

      {/* Bingkai bidik bersudut. Empat sudut saja, bukan kotak penuh: uang
          dipegang tangan dan jarang lurus, jadi sudut lebih mudah dijadikan
          acuan daripada bingkai yang menuntut uang masuk seluruhnya. */}
      <div
        className="pointer-events-none absolute inset-x-8 top-1/2 z-10 h-44 -translate-y-1/2"
        aria-hidden="true"
      >
        {(
          [
            'left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-2xl',
            'right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-2xl',
            'left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-2xl',
            'right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-2xl',
          ] as const
        ).map((posisi) => (
          <span
            key={posisi}
            className={`absolute size-10 ${posisi} transition-colors duration-300`}
            style={{ borderColor: warna }}
          />
        ))}
      </div>

      {/* Kartu hasil, menempel di bawah supaya tidak menutupi uang yang sedang
          dibidik di tengah bingkai. */}
      <div
        className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col gap-2"
        aria-hidden="true"
      >
        {status === 'stabil' && hasil?.adaKoin && (
          <KartuIngat>
            <b className="text-white">Ada koin di sana.</b> Nilainya tidak
            terbaca kamera — kenali nominalnya dengan meraba teksturnya.
          </KartuIngat>
        )}

        {status === 'abstain' && (
          <KartuIngat>
            <b className="text-white">Belum yakin.</b> Dekatkan uang, atau cari
            tempat yang lebih terang, lalu tahan sebentar.
          </KartuIngat>
        )}

        {status === 'stabil' && hasil ? (
          <div
            className="rounded-[1.25rem] px-5 py-4 backdrop-blur-md"
            style={{
              backgroundColor: 'rgb(11 20 36 / 0.82)',
              border: `1.5px solid ${warna}`,
            }}
          >
            <div className="eyebrow" style={{ color: 'var(--color-stabil)' }}>
              Terdeteksi
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-semibold text-white/55">Rp</span>
              <span className="nominal text-[2.75rem] text-white">
                {hasil.totalKertas.toLocaleString('id-ID')}
              </span>
            </div>
            {hasil.adaKoin && (
              <div
                className="mt-0.5 text-sm font-semibold"
                style={{ color: 'var(--color-ingat)' }}
              >
                belum termasuk koin
              </div>
            )}
          </div>
        ) : (
          status !== 'abstain' && (
            <div className="rounded-[1.25rem] bg-black/55 px-5 py-3.5 text-center backdrop-blur-md">
              <p className="text-[0.9375rem] font-medium leading-snug text-white/85">
                Arahkan kamera ke uang, jarak sekitar 20 sentimeter
              </p>
            </div>
          )
        )}
      </div>

      {TAMPILKAN_METRIK && hasil && (
        <div
          className="pointer-events-none absolute left-3 top-16 z-30 rounded-lg bg-black/65 px-2 py-1 font-mono text-[0.6875rem] text-white/80"
          aria-hidden="true"
        >
          {hasil.latensiMs.toFixed(0)}ms · {hasil.fps.toFixed(1)}fps · luma{' '}
          {hasil.luma.toFixed(2)}
          {hasil.senterAktif ? ' · senter' : ''}
        </div>
      )}
    </div>
  );
}

/** Warna bingkai bidik mengikuti keadaan, bukan sekadar hiasan. */
function warnaStatus(status: HasilPindai['status'] | undefined): string {
  switch (status) {
    case 'stabil':
      return 'var(--color-stabil)';
    case 'abstain':
      return 'var(--color-abstain)';
    default:
      return 'rgb(255 255 255 / 0.55)';
  }
}

function teksStatus(status: HasilPindai['status'] | undefined): string {
  switch (status) {
    case 'stabil':
      return 'Terbaca';
    case 'abstain':
      return 'Belum yakin';
    case 'belum-stabil':
      return 'Menahan…';
    default:
      return 'Mencari';
  }
}

function Lencana({ warna, teks }: { readonly warna: string; readonly teks: string }) {
  return (
    <span
      className="flex items-center gap-2 rounded-full px-3 py-2 text-[0.8125rem] font-bold backdrop-blur-md"
      style={{ backgroundColor: 'rgb(0 0 0 / 0.45)', color: warna }}
    >
      <span
        className="block size-2 rounded-full"
        style={{ backgroundColor: warna }}
      />
      {teks}
    </span>
  );
}

function KartuIngat({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 rounded-[1.25rem] px-4 py-3 backdrop-blur-md"
      style={{ backgroundColor: 'rgb(11 20 36 / 0.82)' }}
    >
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-base font-extrabold"
        style={{
          backgroundColor: 'var(--color-ingat)',
          color: 'var(--color-ingat-tinta)',
        }}
      >
        !
      </span>
      <p className="text-[0.9375rem] leading-snug text-white/80">{children}</p>
    </div>
  );
}

function IkonSenter({ nyala }: { readonly nyala: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
      <path
        d="M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={nyala ? 'currentColor' : 'none'}
      />
      {!nyala && (
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}
