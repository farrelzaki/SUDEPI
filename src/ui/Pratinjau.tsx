/**
 * Pratinjau kamera dan panduan Sonar Aiming.
 *
 * Elemen video ini `aria-hidden` dengan sengaja. Ia tidak menyampaikan apa pun
 * kepada pengguna tunanetra, dan memasukkannya ke urutan fokus TalkBack hanya
 * menambah satu perhentian kosong yang harus dilewati.
 *
 * Panduan visualnya ada untuk dua pihak lain: orang dengan sisa penglihatan,
 * dan pendamping atau pedagang yang membantu mengarahkan. Umpan balik
 * sebenarnya bagi pengguna utama adalah suara dan getaran.
 */

import { useEffect, useRef } from 'react';
import type { HasilPindai } from '@/contracts';

export interface PratinjauProps {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly hasil: HasilPindai | null;
}

/** Warna bingkai bidik mengikuti keadaan, bukan sekadar hiasan. */
function warnaStatus(status: HasilPindai['status'] | undefined): string {
  switch (status) {
    case 'stabil':
      return 'var(--color-stabil)';
    case 'abstain':
      return 'var(--color-abstain)';
    default:
      return 'rgba(255,255,255,0.45)';
  }
}

export function Pratinjau({ videoRef, hasil }: PratinjauProps) {
  const wadahRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.setAttribute('playsinline', '');
      v.muted = true;
    }
  }, [videoRef]);

  return (
    <div ref={wadahRef} aria-hidden className="absolute inset-0 overflow-hidden">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
      />

      {/* Bingkai bidik. Membantu memusatkan uang tanpa menutupi apa pun. */}
      <div
        className="pointer-events-none absolute inset-x-6 top-1/2 h-40 -translate-y-1/2 rounded-3xl border-4 transition-colors duration-200"
        style={{ borderColor: warnaStatus(hasil?.status) }}
      />

      {/* Metrik untuk kalibrasi. Berguna saat menyetel ambang dengan uang
          sungguhan, dan wajib dibuang sebelum demo. */}
      {hasil && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/60 px-2 py-1 font-mono text-xs text-white/80">
          {hasil.latensiMs.toFixed(0)}ms · {hasil.fps.toFixed(1)}fps ·{' '}
          luma {hasil.luma.toFixed(2)}
          {hasil.senterAktif ? ' · senter' : ''}
        </div>
      )}
    </div>
  );
}
