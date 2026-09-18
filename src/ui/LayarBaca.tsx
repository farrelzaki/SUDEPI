/**
 * Layar baca uang — alat, bukan transaksi.
 *
 * Pengguna mengarahkan kamera, mendengar nominalnya, mengganti lembar,
 * mendengar lagi. Tidak ada langkah berikutnya, tidak ada yang harus
 * dikonfirmasi, dan tidak ada yang perlu diselesaikan.
 *
 * KENAPA DIPISAHKAN DARI TRANSAKSI. Pertanyaan "ini uang berapa" jauh lebih
 * sering muncul daripada "hitungkan kembalian saya" — saat merapikan dompet,
 * saat menerima uang dari seseorang, saat memastikan sebelum berangkat.
 * Memaksanya lewat alur transaksi berarti menuntut harga belanja dan verifikasi
 * kembalian untuk pertanyaan yang tidak ada hubungannya dengan keduanya.
 *
 * Seluruh keputusan apa yang diucapkan ada di `core/pembaca.ts` sebagai fungsi
 * murni yang sudah punya tesnya sendiri. Berkas ini hanya menjalankan efeknya.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  HasilPindai,
  PemindaiKamera,
  Pengucap,
  Platform,
} from '@/contracts';
import { bacaUang, PEMBACA_AWAL } from '@/core/pembaca';
import { keTeks } from '@/audio/pengucap';
import type { Detak } from '@/audio/detak';
import { Kerangka, Tombol } from './Kerangka';
import { Pratinjau } from './Pratinjau';

export interface LayarBacaProps {
  readonly pemindai: PemindaiKamera;
  readonly pengucap: Pengucap;
  readonly platform: Platform;
  readonly detak: Detak;
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly onKeluar: () => void;
}

export function LayarBaca({
  pemindai,
  pengucap,
  platform,
  detak,
  videoRef,
  onKeluar,
}: LayarBacaProps) {
  const [hasil, setHasil] = useState<HasilPindai | null>(null);
  const statePembaca = useRef(PEMBACA_AWAL);

  useEffect(() => {
    // Kamera dinyalakan sendiri di sini, bukan lewat mesin transaksi — alat ini
    // memang berada di luar alur transaksi sepenuhnya.
    void pemindai.mulai(1);
    detak.mulaiMenyiapkan();

    const lepas = pemindai.langgan((bingkai) => {
      setHasil(bingkai);

      const { state, efek } = bacaUang(statePembaca.current, bingkai);
      statePembaca.current = state;

      // Detak kerja: satu bunyi per bingkai yang selesai diproses, supaya
      // keheningan tidak bisa disalahartikan sebagai kerusakan.
      detak.hentikanMenyiapkan();
      if (bingkai.status === 'tidak-ada-objek') detak.tik('cari');
      else if (bingkai.status !== 'stabil') detak.tik('dekat');

      for (const e of efek) {
        if (e.jenis === 'UCAP') {
          console.log('[UCAP]', keTeks(e.ucapan));
          pengucap.redam(true);
          detak.senyapkan(true);
          void pengucap.ucap(e.ucapan).finally(() => {
            pengucap.redam(false);
            detak.senyapkan(false);
          });
        } else if (e.jenis === 'GETAR') {
          void platform.getar(e.pola);
        }
      }
    });

    return () => {
      lepas();
      detak.hentikanMenyiapkan();
      pemindai.berhenti();
      pengucap.hentikan();
      statePembaca.current = PEMBACA_AWAL;
    };
  }, [pemindai, pengucap, platform, detak]);

  return (
    <Kerangka
      langkah={null}
      judul="Baca uang"
      subjudul="Arahkan kamera ke uang. Ganti lembarnya kapan saja."
      onKembali={onKeluar}
      isiPenuh
      aksi={
        <Tombol
          label="Selesai membaca uang, kembali ke menu"
          ragam="sekunder"
          onAktif={onKeluar}
        >
          Selesai
        </Tombol>
      }
    >
      <Pratinjau
        videoRef={videoRef}
        hasil={hasil}
        onSenter={(n) => void pemindai.setSenter(n)}
      />
    </Kerangka>
  );
}
