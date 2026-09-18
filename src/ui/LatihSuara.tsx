/**
 * Pelatihan suara — mengajari SUDEPI mengenali cara pengguna menyebut angka.
 *
 * KENAPA HARUS DILATIH. Pengenalan ucapan bebas menuntut model berukuran
 * puluhan megabita yang harus diunduh, dan di perangkat uji kami paket bahasa
 * Indonesianya memang tidak tersedia. Pengenalan kosakata tertutup tidak
 * menuntut apa pun dari perangkat — tetapi ia harus tahu seperti apa bunyi
 * angka DI MULUT ORANG INI.
 *
 * Jadi pertukarannya jelas: satu menit sekali seumur pemakaian, ditukar dengan
 * fitur yang bekerja di ponsel mana pun, tanpa unduhan, tanpa jaringan, dan
 * tanpa bergantung pada apa yang kebetulan terpasang.
 *
 * ALURNYA BERJALAN SENDIRI. Satu ketukan di awal, lalu tujuh belas kata
 * berurutan tanpa perlu menekan apa pun lagi di antaranya. Aba-abanya
 * disampaikan lewat daerah `aria-live` yang dibacakan TalkBack — klip suara
 * kami sendiri tidak bisa dipakai, sebab ia hanya mengenal nominal utuh dan
 * tidak punya cara menyebut kata lepas seperti "puluh" tanpa angka di
 * depannya, yang justru akan ikut ditirukan pengguna.
 */

import { useEffect, useRef, useState } from 'react';
import { KOSAKATA } from '@/audio/dengar/kosakata';
import { ciriSatuKata, type Contoh } from '@/audio/dengar/pengenal';
import type { Detak } from '@/audio/detak';
import type { PengenalSuara } from '@/platform/pengenalSuara';
import { Kerangka, Tombol } from './Kerangka';

/** Lama merekam satu kata. Satu kata Bahasa Indonesia jarang lebih dari itu. */
const REKAM_MS = 1600;

/**
 * Jeda antara aba-aba muncul dan perekaman dimulai.
 *
 * Harus cukup untuk TalkBack menyelesaikan kalimatnya. Terlalu pendek berarti
 * suara TalkBack sendiri ikut terekam dan menjadi contoh latih — kesalahan
 * yang merusak seluruh pengenalan sesudahnya tanpa terlihat.
 */
const JEDA_ABA_ABA_MS = 1400;

export interface LatihSuaraProps {
  readonly pengenal: PengenalSuara;
  readonly detak: Detak;
  readonly onSelesai: (contoh: readonly Contoh[]) => void;
  readonly onBatal: () => void;
}

type Tahap = 'siap' | 'menyebut' | 'merekam' | 'selesai';

export function LatihSuara({
  pengenal,
  detak,
  onSelesai,
  onBatal,
}: LatihSuaraProps) {
  const [indeks, setIndeks] = useState(0);
  const [tahap, setTahap] = useState<Tahap>('siap');
  const [gagalBeruntun, setGagalBeruntun] = useState(0);
  const terkumpul = useRef<Contoh[]>([]);
  const berjalan = useRef(false);

  const sekarang = KOSAKATA[indeks];

  useEffect(() => {
    return () => {
      berjalan.current = false;
    };
  }, []);

  async function rekamSatu(ke: number): Promise<void> {
    const kata = KOSAKATA[ke];
    if (!kata) {
      setTahap('selesai');
      onSelesai(terkumpul.current);
      return;
    }

    // Aba-aba disampaikan lewat daerah `aria-live` di bawah, yang dibacakan
    // TalkBack. Klip suara kami sendiri tidak bisa dipakai di sini: ia hanya
    // mengenal nominal utuh, sehingga tidak ada cara menyebut kata lepas
    // seperti "puluh" atau "belas" tanpa angka di depannya — dan pengguna
    // akan menirukan angka itu juga.
    setTahap('menyebut');
    await new Promise((lanjut) => setTimeout(lanjut, JEDA_ABA_ABA_MS));
    if (!berjalan.current) return;

    setTahap('merekam');
    detak.tik('dengar');

    try {
      const rekaman = await pengenal.rekam(REKAM_MS);
      const ciri = ciriSatuKata(rekaman.contoh);

      if (!ciri) {
        // Tidak ada ucapan yang terdengar. Contoh latih berisi keheningan akan
        // meracuni seluruh pengenalan sesudahnya, jadi kata ini diulang.
        detak.tik('tolak');
        setGagalBeruntun((n) => n + 1);
        if (berjalan.current) void rekamSatu(ke);
        return;
      }

      terkumpul.current.push({ kata: kata.kata, bingkai: ciri });
      setGagalBeruntun(0);
      setIndeks(ke + 1);
      if (berjalan.current) void rekamSatu(ke + 1);
    } catch {
      detak.tik('tolak');
      setTahap('siap');
      berjalan.current = false;
    }
  }

  function mulai(): void {
    if (berjalan.current) return;
    berjalan.current = true;
    terkumpul.current = [];
    setIndeks(0);
    void rekamSatu(0);
  }

  const selesai = tahap === 'selesai';

  return (
    <Kerangka
      langkah={null}
      judul="Latih suara"
      subjudul={
        selesai
          ? 'Selesai. SUDEPI sekarang mengenali cara kamu menyebut angka.'
          : 'SUDEPI akan menyebutkan satu angka, lalu kamu tirukan. Sekitar satu menit, sekali saja.'
      }
      onKembali={onBatal}
      petunjuk={
        tahap === 'merekam'
          ? 'Sebutkan sekarang'
          : tahap === 'menyebut'
            ? 'Dengarkan…'
            : undefined
      }
      aksi={
        selesai ? (
          <Tombol label="Selesai melatih suara, kembali ke awal" onAktif={onBatal}>
            Selesai
          </Tombol>
        ) : berjalan.current ? (
          <Tombol
            label="Hentikan pelatihan suara"
            ragam="hantu"
            onAktif={() => {
              berjalan.current = false;
              onBatal();
            }}
          >
            Hentikan
          </Tombol>
        ) : (
          <Tombol label="Mulai melatih suara" onAktif={mulai}>
            Mulai latihan
          </Tombol>
        )
      }
    >
      {/* Aba-aba. Dibacakan TalkBack setiap kali katanya berganti. */}
      <div role="status" aria-live="assertive" className="sr-only">
        {selesai
          ? 'Pelatihan suara selesai'
          : tahap === 'siap'
            ? ''
            : `Ucapkan: ${sekarang?.kata ?? ''}`}
      </div>

      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <div
          className="flex size-40 items-center justify-center rounded-full transition-colors"
          style={{
            backgroundColor:
              tahap === 'merekam'
                ? 'var(--color-primer)'
                : 'var(--color-primer-tipis)',
            color: tahap === 'merekam' ? '#fff' : 'var(--color-primer)',
          }}
          aria-hidden="true"
        >
          <span className="nominal text-5xl">
            {selesai ? '✓' : (sekarang?.kata ?? '')}
          </span>
        </div>

        {!selesai && (
          <p className="text-xl font-bold" aria-hidden="true">
            Ucapkan: <span className="text-[var(--color-primer)]">{sekarang?.kata}</span>
          </p>
        )}

        {!selesai && (
          <div aria-hidden="true">
            <div className="eyebrow text-[var(--color-tinta-samar)]">
              Kata ke
            </div>
            <div className="nominal mt-1 text-3xl">
              {Math.min(indeks + 1, KOSAKATA.length)} / {KOSAKATA.length}
            </div>
          </div>
        )}

        {gagalBeruntun >= 2 && !selesai && (
          <p className="max-w-[32ch] text-[0.9375rem] leading-snug text-[var(--color-ingat-tinta)]">
            Belum terdengar. Coba dekatkan mulut ke ponsel dan ucapkan sedikit
            lebih keras.
          </p>
        )}
      </div>
    </Kerangka>
  );
}
