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
 * Jadi untuk siapa lapisan ini? Untuk tiga orang lain: pengguna dengan sisa
 * penglihatan, pendamping yang membantu mengarahkan, dan pedagang yang ingin
 * ikut memastikan. Merekalah alasan layar ini tetap dirancang dengan serius
 * walaupun pengguna utamanya tidak melihatnya.
 */

import { useEffect, useRef } from 'react';
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
  /** Judul di bilah kamera, misalnya "Pindai uang di sini". */
  readonly judulBilah: string;
  readonly onSenter?: (nyala: boolean) => void;
}

export function Pratinjau({
  videoRef,
  hasil,
  judulBilah,
  onSenter,
}: PratinjauProps) {
  const wadahRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.setAttribute('playsinline', 'true');
  }, [videoRef]);

  const senterAktif = hasil?.senterAktif ?? false;

  return (
    <div ref={wadahRef} className="relative h-full w-full overflow-hidden bg-black">
      {/* Bilah kamera. Mengikuti prototipe, tetapi TANPA tombol balik kamera:
          kami hanya memakai kamera belakang, dan tombol yang tidak melakukan
          apa-apa lebih buruk daripada tombol yang tidak ada. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-black/55 px-3 py-2">
        {onSenter ? (
          <button
            type="button"
            aria-label={
              senterAktif ? 'Matikan senter kamera' : 'Nyalakan senter kamera'
            }
            aria-pressed={senterAktif}
            onClick={() => onSenter(!senterAktif)}
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-white active:bg-white/20"
          >
            <IkonSenter nyala={senterAktif} />
          </button>
        ) : (
          <div className="size-12 shrink-0" />
        )}
        <div
          className="flex-1 text-center text-base font-semibold text-white"
          aria-hidden="true"
        >
          {judulBilah}
        </div>
        <div className="size-12 shrink-0" />
      </div>

      <video
        ref={videoRef}
        aria-hidden="true"
        tabIndex={-1}
        className="h-full w-full object-cover"
        playsInline
        muted
      />

      {/* Garis bidik. Sengaja satu garis putus-putus melintang, bukan kotak:
          uang dipegang di tangan dan jarang lurus, jadi garis lebih mudah
          dijadikan acuan daripada bingkai yang menuntut uang masuk seluruhnya. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 border-t-2 border-dashed transition-colors duration-200"
        style={{ borderColor: warnaStatus(hasil?.status) }}
        aria-hidden="true"
      />

      {/* Kartu hasil. Menempel di bawah supaya tidak menutupi uang yang sedang
          dibidik di tengah bingkai. */}
      <div
        className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col gap-2"
        aria-hidden="true"
      >
        {hasil?.status === 'stabil' && hasil.adaKoin && (
          <KartuIngat>
            <b>Ada koin di sana.</b> Nilainya tidak terbaca kamera — kenali
            nominalnya dengan meraba teksturnya.
          </KartuIngat>
        )}

        {hasil?.status === 'abstain' && (
          <KartuIngat>
            <b>Belum yakin.</b> Dekatkan uang, atau cari tempat yang lebih
            terang, lalu tahan sebentar.
          </KartuIngat>
        )}

        {hasil?.status === 'stabil' ? (
          <KartuHasil total={hasil.totalKertas} adaKoin={hasil.adaKoin} />
        ) : (
          hasil?.status !== 'abstain' && (
            <KartuGelap>
              <div className="text-center text-base font-semibold text-white/90">
                Arahkan kamera ke uang, jarak sekitar 20 sentimeter
              </div>
            </KartuGelap>
          )
        )}
      </div>

      {TAMPILKAN_METRIK && hasil && (
        <div
          className="pointer-events-none absolute left-3 top-16 z-30 rounded-lg bg-black/60 px-2 py-1 font-mono text-xs text-white/80"
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

/** Warna garis bidik mengikuti keadaan, bukan sekadar hiasan. */
function warnaStatus(status: HasilPindai['status'] | undefined): string {
  switch (status) {
    case 'stabil':
      return 'var(--color-stabil)';
    case 'abstain':
      return 'var(--color-abstain)';
    default:
      return 'rgba(255,255,255,0.7)';
  }
}

function KartuGelap({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-black/65 px-4 py-3 backdrop-blur-sm">
      {children}
    </div>
  );
}

function KartuIngat({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-black/70 px-4 py-3 backdrop-blur-sm">
      <div
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold"
        style={{
          borderColor: 'var(--color-ingat)',
          color: 'var(--color-ingat)',
        }}
      >
        !
      </div>
      <p className="text-base leading-snug text-white/90">{children}</p>
    </div>
  );
}

function KartuHasil({
  total,
  adaKoin,
}: {
  readonly total: number;
  readonly adaKoin: boolean;
}) {
  return (
    <KartuGelap>
      <div className="text-center text-base font-semibold text-white/75">
        Total uang terdeteksi
      </div>
      <div className="text-center text-5xl font-extrabold tracking-tight text-white">
        Rp{total.toLocaleString('id-ID')}
      </div>
      {adaKoin && (
        <div
          className="mt-1 text-center text-sm font-semibold"
          style={{ color: 'var(--color-ingat)' }}
        >
          belum termasuk koin
        </div>
      )}
    </KartuGelap>
  );
}

function IkonSenter({ nyala }: { readonly nyala: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
      <path
        d="M13 2 4.5 13H11l-1 9 8.5-11H12l1-9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill={nyala ? 'currentColor' : 'none'}
      />
      {!nyala && (
        <path
          d="M3 3l18 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
