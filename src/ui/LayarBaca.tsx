/**
 * Layar baca uang — sekaligus BERANDA aplikasi.
 *
 * Pengguna mengarahkan kamera, mendengar nominalnya, mengganti lembar,
 * mendengar lagi. Tidak ada langkah berikutnya, tidak ada yang harus
 * dikonfirmasi, dan tidak ada yang perlu diselesaikan.
 *
 * KENAPA INI YANG PERTAMA TERBUKA. Pertanyaan "ini uang berapa" jauh lebih
 * sering muncul daripada "hitungkan kembalian saya" — saat merapikan dompet,
 * saat menerima uang dari seseorang, saat memastikan sebelum berangkat. Yang
 * paling sering dibutuhkan pantas berada di tempat yang tidak perlu dicari.
 *
 * Karena itu tidak ada halaman pembuka sama sekali. Membuka aplikasi berarti
 * kamera sudah menyala dan siap menjawab; transaksi dan pelatihan suara ada
 * sebagai tombol di layar yang sama, bukan sebagai tujuan yang harus dilewati
 * lebih dulu.
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
import { Kerangka } from './Kerangka';
import { Pratinjau } from './Pratinjau';

export interface LayarBacaProps {
  readonly pemindai: PemindaiKamera;
  readonly pengucap: Pengucap;
  readonly platform: Platform;
  readonly detak: Detak;
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Tombol di bawah. Ditentukan pemanggil karena layar ini juga beranda. */
  readonly aksi: React.ReactNode;
}

export function LayarBaca({
  pemindai,
  pengucap,
  platform,
  detak,
  videoRef,
  aksi,
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
      judul="SUDEPI"
      subjudul="Arahkan kamera ke uang. Ganti lembarnya kapan saja."
      isiPenuh
      aksi={aksi}
    >
      <Pratinjau
        videoRef={videoRef}
        hasil={hasil}
        onSenter={(n) => void pemindai.setSenter(n)}
      />
    </Kerangka>
  );
}
