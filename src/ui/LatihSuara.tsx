/**
 * Pelatihan suara — mengajari SUDEPI mengenali cara pengguna menyebut angka.
 *
 * KENAPA HARUS DILATIH. Pengenalan ucapan bebas menuntut model berukuran
 * puluhan megabita yang harus diunduh, dan di perangkat uji kami paket bahasa
 * Indonesianya memang tidak tersedia. Pengenalan kosakata tertutup tidak
 * menuntut apa pun dari perangkat — tetapi ia harus tahu seperti apa bunyi
 * angka DI MULUT ORANG INI.
 *
 * Pertukarannya jelas dan layak: satu setengah menit sekali seumur pemakaian,
 * ditukar dengan fitur yang bekerja di ponsel mana pun, tanpa unduhan, tanpa
 * jaringan, dan tanpa bergantung pada apa yang kebetulan terpasang.
 *
 * DUA PUTARAN, BUKAN SATU. Literatur pengenalan kata terpisah konsisten
 * menunjukkan lebih banyak contoh per kata memberi perbaikan nyata. Putaran
 * kedua juga menangkap variasi alami — orang tidak pernah mengucapkan kata yang
 * sama persis dua kali, dan justru variasi itulah yang harus dikenali nanti.
 *
 * ALURNYA BERJALAN SENDIRI. Satu ketukan di awal, lalu seluruh daftar berjalan
 * tanpa perlu menekan apa pun lagi. Aba-abanya lewat daerah `aria-live` yang
 * dibacakan TalkBack — klip suara kami sendiri tidak bisa dipakai, sebab ia
 * hanya mengenal nominal utuh dan tidak punya cara menyebut kata lepas seperti
 * "puluh" tanpa angka di depannya, yang justru akan ikut ditirukan pengguna.
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

/** Berapa kali seluruh kosakata dilalui. */
const PUTARAN = 2;

/** Daftar aba-aba: seluruh kosakata, diulang. */
const URUTAN = Array.from({ length: PUTARAN }, () => KOSAKATA).flat();

/** Batas percobaan ulang satu kata sebelum dilewati. */
const ULANG_MAKS = 3;

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
  const [berjalan, setBerjalan] = useState(false);
  const [gagalBeruntun, setGagalBeruntun] = useState(0);

  const terkumpul = useRef<Contoh[]>([]);
  /**
   * Penanda untuk perulangan yang sedang berjalan.
   *
   * Dipisahkan dari `berjalan` yang berupa state: state dibaca saat render,
   * ref dibaca di dalam perulangan asinkron. Versi pertama hanya memakai ref,
   * dan akibatnya tombol tidak pernah berganti dari "Mulai latihan" menjadi
   * "Hentikan" — mengubah ref tidak memicu render ulang.
   */
  const hidup = useRef(false);

  const sekarang = URUTAN[indeks];
  const putaran = Math.floor(indeks / KOSAKATA.length) + 1;

  useEffect(() => {
    return () => {
      hidup.current = false;
    };
  }, []);

  async function rekamSatu(ke: number, percobaan: number): Promise<void> {
    const kata = URUTAN[ke];
    if (!kata) {
      hidup.current = false;
      setBerjalan(false);
      setTahap('selesai');
      onSelesai(terkumpul.current);
      return;
    }

    setTahap('menyebut');
    await new Promise((lanjut) => setTimeout(lanjut, JEDA_ABA_ABA_MS));
    if (!hidup.current) return;

    setTahap('merekam');
    detak.tik('dengar');

    try {
      const rekaman = await pengenal.rekam(REKAM_MS);
      if (!hidup.current) return;

      const ciri = ciriSatuKata(rekaman.contoh);
      detak.tik(ciri ? 'cari' : 'tolak');

      if (!ciri) {
        // Tidak ada ucapan yang cukup panjang terdengar. Contoh latih yang
        // buruk meracuni seluruh pengenalan sesudahnya tanpa terlihat, jadi
        // kata ini diulang alih-alih disimpan apa adanya.
        setGagalBeruntun((n) => n + 1);
        if (percobaan + 1 < ULANG_MAKS) {
          void rekamSatu(ke, percobaan + 1);
        } else {
          // Sudah dicoba beberapa kali. Dilewati, bukan menahan seluruh alur —
          // kata ini masih punya contoh dari putaran satunya.
          setIndeks(ke + 1);
          void rekamSatu(ke + 1, 0);
        }
        return;
      }

      terkumpul.current.push({ kata: kata.kata, bingkai: ciri });
      setGagalBeruntun(0);
      setIndeks(ke + 1);
      void rekamSatu(ke + 1, 0);
    } catch {
      detak.tik('tolak');
      hidup.current = false;
      setBerjalan(false);
      setTahap('siap');
    }
  }

  function mulai(): void {
    if (hidup.current) return;
    hidup.current = true;
    terkumpul.current = [];
    setBerjalan(true);
    setIndeks(0);
    setGagalBeruntun(0);
    void rekamSatu(0, 0);
  }

  function hentikan(): void {
    hidup.current = false;
    setBerjalan(false);
    onBatal();
  }

  const selesai = tahap === 'selesai';

  return (
    <Kerangka
      langkah={null}
      judul="Latih suara"
      subjudul={
        selesai
          ? 'Selesai. SUDEPI sekarang mengenali cara kamu menyebut angka.'
          : 'Tirukan setiap kata yang muncul. Sekitar satu setengah menit, sekali saja.'
      }
      onKembali={hentikan}
      petunjuk={
        tahap === 'merekam'
          ? 'Sebutkan sekarang'
          : tahap === 'menyebut'
            ? 'Bersiap…'
            : berjalan
              ? undefined
              : 'Ucapkan satu kata saja, jelas, lalu tunggu kata berikutnya'
      }
      aksi={
        selesai ? (
          <Tombol label="Selesai melatih suara, kembali ke awal" onAktif={onBatal}>
            Selesai
          </Tombol>
        ) : berjalan ? (
          <Tombol label="Hentikan pelatihan suara" ragam="hantu" onAktif={hentikan}>
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
          : berjalan
            ? `Ucapkan: ${sekarang?.kata ?? ''}`
            : ''}
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
          <span className="nominal text-4xl">
            {selesai ? '✓' : (sekarang?.kata ?? '')}
          </span>
        </div>

        {!selesai && berjalan && (
          <>
            <p className="text-xl font-bold" aria-hidden="true">
              Ucapkan:{' '}
              <span className="text-[var(--color-primer)]">{sekarang?.kata}</span>
            </p>

            <div aria-hidden="true">
              <div className="eyebrow text-[var(--color-tinta-samar)]">
                Putaran {putaran} dari {PUTARAN}
              </div>
              <div className="nominal mt-1 text-3xl">
                {Math.min(indeks + 1, URUTAN.length)} / {URUTAN.length}
              </div>
            </div>
          </>
        )}

        {gagalBeruntun >= 2 && !selesai && (
          <p className="max-w-[32ch] text-[0.9375rem] leading-snug text-[var(--color-ingat-tinta)]">
            Belum terdengar. Dekatkan ponsel ke mulut dan ucapkan sedikit lebih
            keras.
          </p>
        )}
      </div>
    </Kerangka>
  );
}
