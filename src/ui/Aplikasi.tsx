/**
 * Layar utama SUDEPI.
 *
 * Merakit fase demi fase. Seluruh keputusan alur ada di `core/mesin.ts`;
 * berkas ini hanya memilih apa yang tampil dan apa yang dibacakan.
 *
 * Aturan yang mengikat seluruh berkas ini: **tulis kode dengan anggapan
 * layarnya mati.** Bukan "pengguna kesulitan melihat", tapi benar-benar tidak
 * ada gambar sama sekali. Kalau sebuah alur hanya bisa diselesaikan dengan
 * melihat sesuatu, alur itu belum selesai dikerjakan.
 *
 * Bentuk visualnya mengikuti prototipe Fajar di `UI reference/`, dan alurnya
 * mengikuti kebiasaan Android: satu langkah per layar, penghitung langkah dan
 * batang kemajuan di atas, tindakan di bawah, tombol kembali selalu di pojok
 * kiri atas. Pengguna kami memakai Android setiap hari — hal paling ramah yang
 * bisa kami lakukan adalah berperilaku seperti aplikasi Android lain.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { frasa, type PemindaiKamera, type Platform } from '@/contracts';
import { buatPengucap } from '@/audio/pengucap';
import { buatMockPlatform, pilihPlatform } from '@/platform/mock';
import {
  buatPengenalSuara,
  kodeGalat,
  type PengenalSuara,
} from '@/platform/pengenalSuara';
import { NOMINAL_MAKS } from '@/audio/urai';
import { dengarNominal, type Contoh } from '@/audio/dengar/pengenal';
import { bacaContoh, tulisContoh } from '@/audio/dengar/templat';
import { LatihSuara } from './LatihSuara';
import { LayarBaca } from './LayarBaca';
import { DbSudepi, siapkanDb } from '@/data/db';
import { buatRepositori, type Repositori } from '@/data/repositori';
import { buatPemindai } from '@/vision/pemindai';
import { buatMockPemindai } from '@/vision/mockPemindai';
import { Kerangka, KodeTunanetra, LapisanKetuk, Tombol } from './Kerangka';
import { LayarKasir } from './LayarKasir';
import { PapanAngka } from './PapanAngka';
import { Pratinjau } from './Pratinjau';
import { labelUtama } from './label';
import { useTransaksi } from './useTransaksi';

/**
 * Di browser desktop tidak ada kamera belakang maupun model, jadi `pnpm dev`
 * memakai pemindai bernaskah. Naskahnya sengaja memuat kasus buruk — abstain,
 * belum stabil, tidak ada objek — supaya jalur buruk ikut terbangun sejak awal
 * dan tidak baru ketahuan di jam ke-21.
 */
const PAKAI_MOCK = !import.meta.env.PROD;

/**
 * Lama merekam satu ucapan nominal.
 *
 * "Seratus dua puluh lima ribu" adalah lima kata dan butuh sekitar dua detik
 * diucapkan dengan jeda yang wajar. Tiga detik memberi ruang tanpa membuat
 * pengguna merasa menunggu.
 */
const REKAM_UCAPAN_MS = 3000;

/** Jeda agar TalkBack selesai bicara sebelum mikrofon menyala. */
const JEDA_SEBELUM_REKAM_MS = 700;

export function Aplikasi() {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Mulai dari mock lalu diganti yang asli begitu diketahui: `pilihPlatform`
  // asinkron, dan aplikasi harus sudah bisa dirender sebelum jawabannya tiba.
  const [platform, setPlatform] = useState<Platform>(() => buatMockPlatform());

  useEffect(() => {
    void pilihPlatform().then(setPlatform);
  }, []);

  const pengucap = useMemo(() => buatPengucap(), []);
  useEffect(() => {
    void pengucap.siap();
  }, [pengucap]);

  // Selalu mulai dari mock, lalu ditukar ke pemindai sungguhan setelah
  // komponen terpasang.
  //
  // Pemindai menerima RUJUKAN video, bukan elemennya, sehingga ia selalu
  // menulis ke elemen yang benar-benar terpasang saat itu. Versi sebelumnya
  // menangkap elemennya sekali di sini, dan itu diam-diam mematikan kamera
  // untuk selamanya begitu React membuat ulang elemennya. Lihat catatan di
  // `OpsiPemindai.videoRef`.
  const [pemindai, setPemindai] = useState<PemindaiKamera>(() =>
    buatMockPemindai(),
  );

  useEffect(() => {
    if (PAKAI_MOCK) return;
    const asli = buatPemindai({ videoRef });
    setPemindai(asli);
    return () => {
      asli.berhenti();
    };
  }, []);

  // Basis data dibuka di latar belakang. Aplikasi harus sudah bisa dipakai
  // sebelum ia siap — riwayat transaksi bukan syarat untuk menghitung
  // kembalian, dan menunggu IndexedDB terbuka hanya menunda pengguna.
  const [repositori, setRepositori] = useState<Repositori | null>(null);
  useEffect(() => {
    const db = new DbSudepi();
    let dibatalkan = false;
    void db
      .open()
      .then(() => siapkanDb(db))
      .then(() => {
        if (!dibatalkan) setRepositori(buatRepositori(db));
      })
      .catch(() => {
        // IndexedDB bisa saja diblokir, misalnya di mode penyamaran. Aplikasi
        // tetap berjalan penuh, hanya tanpa riwayat.
      });
    return () => {
      dibatalkan = true;
      db.close();
    };
  }, []);

  /**
   * Pengenalan suara luring.
   *
   * Ketersediaannya diperiksa SEKALI saat aplikasi dibuka, dan hasilnya
   * menentukan apakah tombol suara dirender sama sekali. Perangkat tanpa mesin
   * luring tidak pernah melihat tombol itu — bukan melihatnya dalam keadaan
   * mati. Lihat ADR-0013.
   */
  const pengenal = useMemo<PengenalSuara>(() => buatPengenalSuara(), []);
  const [mendengar, setMendengar] = useState(false);
  const [melatih, setMelatih] = useState(false);

  /**
   * Layar mana yang sedang dibuka di luar alur transaksi.
   *
   * Membaca uang dan melatih suara bukan fase transaksi, jadi keduanya tidak
   * hidup di state machine. Menaruhnya di sana akan memaksa `src/contracts/`
   * yang beku ikut berubah demi dua layar yang tidak ada hubungannya dengan
   * perhitungan kembalian.
   */
  const [mode, setMode] = useState<'beranda' | 'baca'>('beranda');

  /** Kolom mana yang sedang diisi di kalkulator. */
  const [kolom, setKolom] = useState<'bayar' | 'belanja'>('bayar');
  /**
   * Contoh suara pengguna. Kosong berarti fitur suara belum dilatih, dan
   * tombolnya tidak ditawarkan sama sekali.
   */
  const [pustaka, setPustaka] = useState<readonly Contoh[]>([]);

  useEffect(() => {
    setPustaka(bacaContoh());
  }, []);

  const suaraTersedia = pustaka.length > 0;

  const { state, hasilPindai, kirim, mulai, detak } = useTransaksi({
    pemindai,
    pengucap,
    platform,
    repositori,
  });

  // Nilai kalkulator TIDAK disimpan di komponen, melainkan di state machine.
  //
  // Versi sebelumnya menyimpannya lokal, dan akibatnya menekan tombol angka
  // hanya mengubah tampilan tanpa mengirim apa pun ke mesin transaksi —
  // sehingga tidak ada yang diucapkan. Pengguna yang tidak bisa melihat layar
  // memasukkan nominal dan tidak punya cara mengetahui apakah tercatat.

  function mulaiTransaksi(): void {
    setKolom('bayar');
    mulai();
  }

  /**
   * Lanjut dari kalkulator.
   *
   * Kolom pertama hanya berpindah di dalam antarmuka — mesin transaksi tidak
   * tahu apa-apa soal urutan pengisian, dan memang tidak perlu tahu. Ia baru
   * dilibatkan setelah kedua nominal terisi, dan di situlah ia menolak
   * pembayaran yang kurang, sebelum satu angka pun tampil ke pedagang.
   */
  function lanjutKalkulator(): void {
    if (kolom === 'bayar') {
      setKolom('belanja');
      // Kolom berikutnya disebutkan supaya pengguna tahu ia sedang mengisi apa.
      void pengucap.ucap(frasa('total_belanja'));
      void platform.getar('ringan');
      return;
    }
    kirim({ jenis: 'KONFIRMASI' });
  }

  function tindakanUtama(): void {
    if (state.fase === 'SIAGA') {
      mulaiTransaksi();
      return;
    }
    // Dari SELESAI kita kembali ke Mode Siaga, BUKAN langsung memulai
    // transaksi baru. Dua alasan: labelnya memang menjanjikan itu, dan exsum
    // Bab III Fase 4 menyebutnya ("aplikasi kembali ke Mode Siaga").
    //
    // Langsung menyalakan kamera lagi juga salah secara praktis — begitu
    // transaksi beres, pengguna sedang memasukkan uang ke dompet dan bicara
    // dengan pedagang, bukan bersiap memindai.
    kirim({ jenis: 'KONFIRMASI' });
  }

  /**
   * Mendengarkan nominal yang diucapkan.
   *
   * Tidak ada konfirmasi terpisah, dan itu disengaja: `SET_BELANJA` sudah
   * MEMBACAKAN KEMBALI nominalnya lewat suara kami sendiri, dan pengguna baru
   * melanjutkan setelah mendengarnya. Jadi pembacaan ulang itulah konfirmasinya
   * — menambah satu langkah "benar atau salah" hanya akan memperpanjang alur
   * tanpa menambah keamanan.
   */
  async function dengarkanNominal(): Promise<void> {
    if (mendengar) return;

    // Izin diminta pada ketukan pertama, bukan saat aplikasi dibuka. Dialog
    // izin yang muncul tiba-tiba di layar pembuka membingungkan siapa pun, dan
    // jauh lebih membingungkan bagi orang yang tidak bisa membacanya — di sini
    // ia muncul tepat setelah pengguna sendiri meminta fitur suara.
    const berizin = await pengenal.mintaIzin();
    if (!berizin) {
      detak.tik('tolak');
      void platform.getar('gagal');
      return;
    }

    setMendengar(true);
    void platform.getar('ringan');
    detak.tik('dengar');

    // Jeda sebelum mikrofon menyala. TalkBack yang masih menyelesaikan
    // kalimatnya akan ikut terekam dan dicocokkan sebagai kata — kesalahan
    // yang tidak terlihat sama sekali dari luar, dan membuat hampir setiap
    // ucapan ditolak.
    await new Promise((lanjut) => setTimeout(lanjut, JEDA_SEBELUM_REKAM_MS));

    try {
      const rekaman = await pengenal.rekam(REKAM_UCAPAN_MS);
      detak.tik('usai');

      const hasil = dengarNominal(rekaman.contoh, pustaka);
      console.log(
        `[SUARA] potongan=${hasil.jumlahPotongan}`,
        `kata=[${hasil.kata.join(' ')}]`,
        `nominal=${hasil.nominal}`,
      );
      // Jejak kalibrasi: peringkat penuh tiap potongan, termasuk yang ditolak.
      // Ambang hanya boleh ditetapkan dari angka seperti ini, tidak dari
      // tebakan — pelajaran yang sudah mahal kami bayar pada ambang penglihatan.
      for (const r of hasil.rincian) {
        console.log(
          `[KATA] ${r.diterima ?? 'DITOLAK'}`,
          `juara=${r.juara}:${r.jarak.toFixed(1)}`,
          `kedua=${r.kedua ?? '-'}:${r.jarakKedua?.toFixed(1) ?? '-'}`,
        );
      }

      const nilai =
        hasil.nominal !== null && hasil.nominal <= NOMINAL_MAKS
          ? hasil.nominal
          : undefined;

      if (nilai === undefined) {
        // Dua kegagalan yang menuntut tindakan berbeda dari pengguna, jadi
        // dibedakan bunyinya: tidak ada suara sama sekali berarti ia harus
        // bicara lebih keras atau lebih dekat, sedangkan ada suara yang tidak
        // dimengerti berarti ia harus mengulang dengan jeda antar kata.
        detak.tik(hasil.jumlahPotongan === 0 ? 'siap' : 'tolak');
        void platform.getar('gagal');
        return;
      }

      kirim(
        kolom === 'bayar'
          ? { jenis: 'SET_BAYAR', nilai }
          : { jenis: 'SET_BELANJA', nilai },
      );
    } catch (galat) {
      console.log('[SUARA] galat:', kodeGalat(galat));
      detak.tik('tolak');
      void platform.getar('gagal');
    } finally {
      setMendengar(false);
    }
  }

  const batal = (): void => kirim({ jenis: 'BATAL' });
  const tombolBatalGelap = (
    <Tombol
      label="Batalkan transaksi dan kembali ke awal"
      ragam="hantu"
      gelap
      onAktif={batal}
    >
      Batal dan kembali
    </Tombol>
  );
  const label = labelUtama(state.fase, hasilPindai, state);

  /** Tombol batal, hadir di setiap fase kecuali Siaga dan Selesai. */
  const tombolBatal = (
    <Tombol
      label="Batalkan transaksi dan kembali ke awal"
      ragam="hantu"
      onAktif={batal}
    >
      Batal dan kembali
    </Tombol>
  );


  if (melatih) {
    return (
      <LatihSuara
        pengenal={pengenal}
        detak={detak}
        onSelesai={(contoh) => {
          tulisContoh(contoh);
          setPustaka(contoh);
        }}
        onBatal={() => setMelatih(false)}
      />
    );
  }

  if (mode === 'baca') {
    return (
      <LayarBaca
        pemindai={pemindai}
        pengucap={pengucap}
        platform={platform}
        detak={detak}
        videoRef={videoRef}
        onKeluar={() => setMode('beranda')}
      />
    );
  }

  return (
    <>
      {isiLayar()}

      {/*
        Hanya untuk keadaan mendesak: abstain dan uang kurang. Pengumuman
        rutin sudah disuarakan pengucap; mencerminkannya ke sini akan membuat
        TalkBack membacakannya lagi setelah suara kita selesai.
      */}
      <div role="alert" aria-live="assertive" className="sr-only">
        {hasilPindai?.status === 'abstain' ? 'Belum yakin, coba pindai lagi' : ''}
      </div>
    </>
  );

  function isiLayar() {
    switch (state.fase) {
      case 'SIAGA':
        return (
          <Kerangka
            langkah={null}
            judul="SUDEPI"
            subjudul="Suara Deteksi Rupiah"
            aksi={
              <>
                <Tombol
                  label="Baca uang dengan kamera"
                  onAktif={() => setMode('baca')}
                >
                  Baca uang
                </Tombol>
                <Tombol
                  label="Mulai transaksi dan hitung kembalian"
                  ragam="sekunder"
                  onAktif={mulaiTransaksi}
                >
                  Mulai transaksi
                </Tombol>
                <Tombol
                  label={
                    suaraTersedia
                      ? 'Latih ulang suara untuk memasukkan nominal'
                      : 'Latih suara agar nominal bisa disebutkan, sekitar satu setengah menit'
                  }
                  ragam="hantu"
                  onAktif={() => setMelatih(true)}
                >
                  {suaraTersedia ? 'Latih ulang suara' : 'Latih suara'}
                </Tombol>
              </>
            }
          >
            {/*
              Tidak ada LapisanKetuk di layar ini.

              Dulu seluruh layar adalah satu tombol "mulai", karena hanya ada
              satu hal yang bisa dilakukan. Sekarang ada dua jalan yang berbeda
              — membaca uang dan bertransaksi — dan sasaran sebesar layar akan
              memilih salah satunya tanpa pengguna tahu yang mana.
            */}
            <div className="pointer-events-none flex h-full flex-col justify-center gap-5">
              <p className="max-w-[30ch] text-[1.0625rem] leading-relaxed text-[var(--color-tinta-redup)]">
                Kenali nominal uang kapan saja, atau hitung kembalian untuk satu
                transaksi.
              </p>

              {/*
                Dulu di sini ada dua kartu penjelas, satu untuk tiap tombol.
                Keduanya dibuang: isinya mengulang persis nama tombol yang ada
                tepat di bawahnya, dan bagi pengguna TalkBack itu berarti
                mendengar hal yang sama dua kali sebelum sampai ke tombolnya.
              */}
              <div className="flex items-center gap-2.5 text-[var(--color-tinta-samar)]">
                <IkonLuring />
                <span className="text-[0.8125rem] font-semibold">
                  Bekerja sepenuhnya tanpa internet
                </span>
              </div>
            </div>
          </Kerangka>
        );

      case 'KALKULATOR': {
        const bayar = kolom === 'bayar';
        return (
          <Kerangka
            langkah={bayar ? 1 : 2}
            judul={bayar ? 'Uang kamu' : 'Total belanja'}
            subjudul={
              bayar
                ? 'Masukkan nominal uang yang kamu pegang'
                : 'Masukkan harga yang harus dibayar'
            }
            onKembali={bayar ? batal : () => setKolom('bayar')}
            aksi={
              <>
                <Tombol
                  label={
                    bayar
                      ? 'Kunci uang kamu dan lanjut ke total belanja'
                      : 'Kunci total belanja dan tunjukkan ke pedagang'
                  }
                  onAktif={lanjutKalkulator}
                >
                  Lanjutkan
                </Tombol>
                {tombolBatal}
              </>
            }
          >
            {/*
              Tidak ada LapisanKetuk di sini, dan itu disengaja. Layar ini
              penuh tombol angka; sasaran ketuk sebesar layar di belakangnya
              akan menelan setiap ketukan yang meleset sedikit saja dan
              mengunci nominal yang belum selesai diketik.
            */}
            <PapanAngka
              nilai={bayar ? (state.uangDibayar ?? 0) : (state.totalBelanja ?? 0)}
              onUbah={(n) =>
                kirim(
                  bayar
                    ? { jenis: 'SET_BAYAR', nilai: n }
                    : { jenis: 'SET_BELANJA', nilai: n },
                )
              }
              namaKolom={bayar ? 'uang kamu' : 'total belanja'}
              pertanyaan={
                bayar
                  ? 'Berapa uang yang kamu pegang?'
                  : 'Berapa total belanjanya?'
              }
              onSuara={suaraTersedia ? () => void dengarkanNominal() : undefined}
              mendengar={mendengar}
            />
          </Kerangka>
        );
      }

      case 'LAYAR_KASIR':
        return (
          <Kerangka
            langkah={3}
            judul="Tunjukkan ke pedagang"
            subjudul="Pedagang bisa memeriksa sendiri angkanya di layar ini"
            gelap
            petunjuk="Ketuk di mana saja untuk lanjut memeriksa kembalian"
            aksi={
              <>
                <Tombol label={label} onAktif={tindakanUtama}>
                  Periksa kembalian
                </Tombol>
                {tombolBatalGelap}
              </>
            }
          >
            <LapisanKetuk onAktif={tindakanUtama} />
            <div className="pointer-events-none h-full">
              <LayarKasir
                totalBelanja={state.totalBelanja ?? 0}
                uangDibayar={state.uangDibayar ?? 0}
                kembalian={state.kembalianWajib ?? 0}
              />
            </div>
          </Kerangka>
        );

      case 'PINDAI_KEMBALIAN':
        return (
          <Kerangka
            langkah={4}
            judul="Periksa kembalian"
            subjudul="Arahkan kamera ke uang kembalian dari pedagang"
            isiPenuh
            petunjuk="Ketuk di mana saja untuk menyelesaikan transaksi"
            aksi={
              <>
                <Tombol label={label} onAktif={tindakanUtama}>
                  Selesaikan transaksi
                </Tombol>
                {tombolBatal}
              </>
            }
          >
            <LapisanKetuk onAktif={tindakanUtama} />
            <Pratinjau
              videoRef={videoRef}
              hasil={hasilPindai}
              onSenter={(n) => void pemindai.setSenter(n)}
            />
          </Kerangka>
        );

      case 'SELESAI':
        return (
          <Kerangka
            langkah={null}
            judul="SUDEPI"
            gelap
            petunjuk="Ketuk di mana saja untuk kembali ke awal"
            aksi={
              <Tombol label={label} onAktif={tindakanUtama}>
                Selesai
              </Tombol>
            }
          >
            <LapisanKetuk onAktif={tindakanUtama} />
            <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-7">
              <LencanaCentang />

              <div className="flex flex-col items-center gap-2">
                <span
                  className="eyebrow"
                  style={{ color: 'var(--color-sukses-terang)' }}
                >
                  Transaksi selesai
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white/45">Rp</span>
                  <span className="nominal text-[3.5rem] text-white">
                    {(state.kembalianWajib ?? 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <span
                  className="text-[0.9375rem] font-medium"
                  style={{ color: 'var(--color-kasir-redup)' }}
                >
                  kembalian yang kamu terima
                </span>
              </div>

              <div
                className="flex w-full items-center justify-between rounded-2xl px-5 py-4"
                style={{ backgroundColor: 'rgb(255 255 255 / 0.06)' }}
              >
                {[
                  ['Belanja', state.totalBelanja ?? 0],
                  ['Dibayar', state.uangDibayar ?? 0],
                ].map(([teks, nilai]) => (
                  <div key={String(teks)} className="flex flex-col gap-1">
                    <span
                      className="eyebrow"
                      style={{ color: 'var(--color-kasir-redup)' }}
                    >
                      {teks}
                    </span>
                    <span
                      className="nominal text-xl"
                      style={{ color: 'var(--color-kasir-teks)' }}
                    >
                      Rp{Number(nilai).toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}
                <KodeTunanetra
                  jumlah={3}
                  warna="var(--color-kasir-redup)"
                  ukuran={9}
                />
              </div>
            </div>
          </Kerangka>
        );

      case 'PINDAI_BAYAR':
        // Fase ini tidak lagi dipakai sejak ADR-0014: uang yang dibayarkan
        // dimasukkan lewat kalkulator, bukan dipindai. Ia masih ada di
        // `src/contracts/` yang beku, jadi cabang ini dijaga agar tidak ada
        // keadaan yang berakhir di layar kosong.
        return null;
    }
  }
}

function IkonLuring() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M2 8.5a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16.5a5 5 0 0 1 6 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LencanaCentang() {
  return (
    <svg viewBox="0 0 24 24" className="size-20" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10.25" fill="rgb(23 185 120 / 0.14)" />
      <circle cx="12" cy="12" r="9.5" stroke="var(--color-sukses)" strokeWidth="1.4" />
      <path
        d="m7.8 12.3 2.9 2.9 5.6-6"
        stroke="var(--color-sukses)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
