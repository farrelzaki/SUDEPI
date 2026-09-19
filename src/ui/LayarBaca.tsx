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
import { Kerangka, Tombol } from './Kerangka';
import { Pratinjau } from './Pratinjau';

export interface LayarBacaProps {
  readonly pemindai: PemindaiKamera;
  readonly pengucap: Pengucap;
  readonly platform: Platform;
  readonly detak: Detak;
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Tombol di bawah. Ditentukan pemanggil karena layar ini juga beranda. */
  readonly aksi: React.ReactNode;
  /**
   * Rencana B: meminta jawaban lewat internet untuk satu bingkai.
   *
   * Hanya diisi saat mode daring menyala. Hasilnya dialirkan lewat jalur yang
   * SAMA PERSIS dengan bingkai kamera biasa, sehingga penyusunan kalimat dan
   * penahan pengulangan tidak perlu tahu dari mana angkanya datang.
   */
  readonly onDaring?: (() => Promise<HasilPindai | null>) | undefined;
}

export function LayarBaca({
  pemindai,
  pengucap,
  platform,
  detak,
  videoRef,
  aksi,
  onDaring,
}: LayarBacaProps) {
  const [hasil, setHasil] = useState<HasilPindai | null>(null);
  const [bertanya, setBertanya] = useState(false);
  const statePembaca = useRef(PEMBACA_AWAL);
  const sudahPindaiAwal = useRef(false);
  const onDaringRef = useRef(onDaring);
  onDaringRef.current = onDaring;

  /**
   * Menanggapi satu hasil pindai, dari mana pun asalnya.
   *
   * Sengaja satu jalur untuk kamera dan untuk jawaban internet. Dua jalur
   * terpisah akan berarti dua tempat yang harus sama-sama ingat untuk tidak
   * mengulang kalimat, dan salah satunya pasti tertinggal saat diperbaiki.
   */
  function tanggapi(bingkai: HasilPindai): void {
    setHasil(bingkai);

    const { state, efek } = bacaUang(statePembaca.current, bingkai);
    statePembaca.current = state;

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
  }

  async function tanyaInternet(paksaUcap = false): Promise<void> {
    const fn = onDaringRef.current;
    if (!fn || bertanya) return;
    setBertanya(true);
    // Menunggu jaringan bisa memakan dua detik. Tanpa penanda, keheningan itu
    // tidak bisa dibedakan dari kerusakan — persoalan yang sama yang sudah
    // kami pecahkan untuk inferensi luring.
    detak.mulaiMenyiapkan();
    try {
      const jawaban = await fn();
      if (jawaban) {
        if (paksaUcap && jawaban.status === 'stabil') {
          // Hanya reset saat tombol manual ditekan agar pengguna bisa mendengar ulang jika diinginkan
          statePembaca.current = PEMBACA_AWAL;
        }
        tanggapi(jawaban);
      }
    } finally {
      detak.hentikanMenyiapkan();
      setBertanya(false);
    }
  }

  useEffect(() => {
    // Kamera dinyalakan sendiri di sini, bukan lewat mesin transaksi — alat ini
    // memang berada di luar alur transaksi sepenuhnya.
    void pemindai.mulai(1);
    detak.mulaiMenyiapkan();

    const lepas = pemindai.langgan((bingkai) => {
      // Detak kerja: satu bunyi per bingkai yang selesai diproses, supaya
      // keheningan tidak bisa disalahartikan sebagai kerusakan.
      detak.hentikanMenyiapkan();
      if (bingkai.status === 'tidak-ada-objek') detak.tik('cari');
      else if (bingkai.status !== 'stabil') detak.tik('dekat');

      tanggapi(bingkai);
    });

    // Pemindaian otomatis 1x saat pertama kali layar dibuka (setelah 1.2 detik kamera stabil)
    sudahPindaiAwal.current = false;
    const timerAwal = setTimeout(() => {
      if (!sudahPindaiAwal.current && onDaringRef.current) {
        sudahPindaiAwal.current = true;
        void tanyaInternet(false);
      }
    }, 1200);

    return () => {
      clearTimeout(timerAwal);
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
      aksi={
        onDaring ? (
          <>
            <Tombol
              label={
                bertanya
                  ? 'Sedang memindai uang'
                  : 'Pindai uang di depan kamera'
              }
              ragam="primer"
              nonaktif={bertanya}
              onAktif={() => void tanyaInternet(true)}
            >
              {bertanya ? 'Memindai…' : 'Pindai Uang'}
            </Tombol>
            {aksi}
          </>
        ) : (
          aksi
        )
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
