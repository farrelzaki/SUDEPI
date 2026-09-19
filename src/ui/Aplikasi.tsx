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
import {
  frasa,
  type HasilPindai,
  type PemindaiKamera,
  type Platform,
} from '@/contracts';
import { buatPengucap } from '@/audio/pengucap';
import { buatMockPlatform, pilihPlatform } from '@/platform/mock';
import {
  buatPengenalSuara,
  kodeGalat,
  type PengenalSuara,
} from '@/platform/pengenalSuara';
import { dengarNominal, type Contoh } from '@/audio/dengar/pengenal';
import { bacaContoh, tulisContoh } from '@/audio/dengar/templat';
import { uraiPerintahNavigasi } from '@/audio/perintah';
import {
  bacaMode,
  bolehDaring,
  tulisMode,
  KUNCI_DARING,
  type ModeSistem,
} from '@/platform/mode';
import { ambilBingkai, bacaUangDaring } from '@/vision/daring';
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

/** Jeda singkat agar transisi selesai sebelum mikrofon menyala. */
const JEDA_SEBELUM_REKAM_MS = 100;

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

  /** Kolom mana yang sedang diisi di kalkulator. */
  const [kolom, setKolom] = useState<'bayar' | 'belanja'>('bayar');

  /**
   * Rencana A atau Rencana B. Baku luring, dan hanya berganti kalau pengguna
   * sendiri menekan tombolnya. Lihat `platform/mode.ts`.
   */
  const [modeSistem, setModeSistem] = useState<ModeSistem>('luring');
  useEffect(() => {
    setModeSistem(bacaMode());
  }, []);

  const daringAktif = bolehDaring(modeSistem);

  function gantiMode(): void {
    const baru: ModeSistem = modeSistem === 'luring' ? 'daring' : 'luring';
    setModeSistem(baru);
    tulisMode(baru);
    void platform.getar('ringan');
    detak.tik(baru === 'daring' ? 'dengar' : 'tolak');
  }

  /**
   * Pindai uang:
   * 1. Utamakan model deteksi daring jika daring aktif dan ada koneksi (sangat cepat & akurat).
   * 2. Jika offline / error jaringan / kuota habis / mode pesawat:
   *    Otomatis fallback ke model lokal ONNX (sudepi.onnx) di perangkat!
   */
  async function bacaLewatInternet(): Promise<HasilPindai | null> {
    const video = videoRef.current;
    if (!video) return null;

    // 1. Coba lewat model deteksi daring jika daring aktif
    if (daringAktif) {
      const gambar = ambilBingkai(video);
      if (gambar) {
        try {
          const hasil = await bacaUangDaring(gambar);
          console.log(`[DARING] status=${hasil.status} total=${hasil.totalKertas}`);
          if (hasil.status === 'stabil') {
            return hasil;
          }
        } catch (galat) {
          console.log('[DARING] gagal/offline, beralih ke model lokal:', String(galat));
        }
      }
    }

    // 2. Fallback Luring: Gunakan model ONNX lokal sudepi.onnx yang terpasang di perangkat
    try {
      if (typeof pemindai.pindaiSekarang === 'function') {
        const hasilLuring = await pemindai.pindaiSekarang();
        console.log(`[LURING] status=${hasilLuring.status} total=${hasilLuring.totalKertas}`);
        return hasilLuring;
      }
    } catch (galatLuring) {
      console.log('[LURING] gagal:', String(galatLuring));
    }

    detak.tik('tolak');
    void platform.getar('gagal');
    return null;
  }
  /**
   * Contoh suara pengguna. Kosong berarti fitur suara belum dilatih, dan
   * tombolnya tidak ditawarkan sama sekali.
   */
  const [pustaka, setPustaka] = useState<readonly Contoh[]>([]);

  useEffect(() => {
    setPustaka(bacaContoh());
  }, []);

  // Di mode daring fitur suara tidak menuntut pelatihan sama sekali — mesin
  // Android yang mengenalinya. Di mode luring ia baru ada setelah dilatih.
  const suaraTersedia = pustaka.length > 0 || modeSistem === 'daring';

  const { state, hasilPindai, kirim, mulai, detak } = useTransaksi({
    pemindai,
    pengucap,
    platform,
    repositori,
  });

  const [hasilDaring, setHasilDaring] = useState<HasilPindai | null>(null);
  const [memindaiDaring, setMemindaiDaring] = useState(false);
  const sudahPindaiKembalian = useRef(false);

  useEffect(() => {
    setHasilDaring(null);
  }, [state.fase]);

  useEffect(() => {
    if (state.fase !== 'PINDAI_KEMBALIAN') {
      sudahPindaiKembalian.current = false;
      return undefined;
    }

    sudahPindaiKembalian.current = false;
    const timerKembalian = setTimeout(() => {
      if (!sudahPindaiKembalian.current) {
        sudahPindaiKembalian.current = true;
        void pindaiLewatInternet();
      }
    }, 1200);

    return () => {
      clearTimeout(timerKembalian);
    };
  }, [state.fase]);

  async function pindaiLewatInternet(): Promise<HasilPindai | null> {
    if (memindaiDaring) return null;
    setMemindaiDaring(true);
    detak.mulaiMenyiapkan();
    try {
      const h = await bacaLewatInternet();
      if (h) {
        setHasilDaring(h);
        kirim({ jenis: 'HASIL_PINDAI', muatan: h });
      }
      return h;
    } finally {
      detak.hentikanMenyiapkan();
      setMemindaiDaring(false);
    }
  }

  const hasilAktif: HasilPindai | null = memindaiDaring
    ? {
        status: 'belum-stabil',
        totalKertas: 0,
        deteksi: [],
        adaKoin: false,
        latensiMs: 0,
        fps: 0,
        luma: 0.5,
        senterAktif: false,
      }
    : (hasilDaring ?? hasilPindai);

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
    if (state.fase === 'PINDAI_KEMBALIAN') {
      // Apapun kejadiannya, pengguna berhak menyelesaikan transaksi (anggap uang pas)
      if (
        state.nominalKoin === null ||
        state.hasilPindaiTerakhir?.status !== 'stabil'
      ) {
        const kembalian = state.kembalianWajib ?? 0;
        kirim({
          jenis: 'HASIL_PINDAI',
          muatan: {
            status: 'stabil',
            totalKertas: kembalian,
            deteksi: [],
            adaKoin: false,
            latensiMs: 0,
            fps: 0,
            luma: 1,
            senterAktif: false,
          },
        });
      }
      kirim({ jenis: 'KONFIRMASI' });
      return;
    }
    kirim({ jenis: 'KONFIRMASI' });
  }

  /**
   * Mendengarkan perintah suara pengguna untuk navigasi ataupun input nominal.
   *
   * Mendukung navigasi antar halaman secara hands-free:
   * - SIAGA: "mulai transaksi" -> masuk kalkulator
   * - KALKULATOR: input nominal angka atau "lanjutkan" -> ke kasir
   * - LAYAR_KASIR: "periksa kembalian" -> ke periksa kembalian
   * - PINDAI_KEMBALIAN: "selesaikan transaksi" -> selesai
   * - SELESAI: "selesai" / "kembali" -> ke beranda
   * - Di mana saja: "batal" -> batalkan transaksi
   */
  async function dengarPerintahSuara(): Promise<void> {
    if (mendengar) return;

    const berizin = await pengenal.mintaIzin();
    if (!berizin) {
      detak.tik('tolak');
      void platform.getar('gagal');
      return;
    }

    setMendengar(true);
    void platform.getar('ringan');
    detak.tik('dengar');

    await new Promise((lanjut) => setTimeout(lanjut, JEDA_SEBELUM_REKAM_MS));

    try {
      let kemungkinan: readonly string[] = [];
      if (modeSistem === 'daring') {
        kemungkinan = await pengenal.dengarDaring();
        console.log('[PERINTAH] suara:', kemungkinan.join(' | '));
      } else {
        const rekaman = await pengenal.rekam(REKAM_UCAPAN_MS);
        const hasil = dengarNominal(rekaman.contoh, pustaka);
        if (hasil.nominal !== null) {
          kemungkinan = [String(hasil.nominal)];
        }
      }
      detak.tik('usai');

      const tindakan = uraiPerintahNavigasi(kemungkinan, state.fase);
      console.log('[PERINTAH] tindakan:', tindakan?.jenis);

      if (!tindakan) {
        detak.tik('tolak');
        void platform.getar('gagal');
        return;
      }

      void platform.getar('ringan');

      switch (tindakan.jenis) {
        case 'MULAI_TRANSAKSI':
          mulaiTransaksi();
          break;

        case 'LANJUTKAN':
          lanjutKalkulator();
          break;

        case 'NOMINAL':
          kirim(
            kolom === 'bayar'
              ? { jenis: 'SET_BAYAR', nilai: tindakan.nilai }
              : { jenis: 'SET_BELANJA', nilai: tindakan.nilai },
          );
          break;

        case 'PERIKSA_KEMBALIAN':
        case 'SELESAIKAN_TRANSAKSI':
        case 'SELESAI':
          tindakanUtama();
          break;

        case 'PINDAI_ULANG':
          if (state.fase === 'SIAGA') {
            void bacaLewatInternet();
          } else if (state.fase === 'PINDAI_KEMBALIAN') {
            void pindaiLewatInternet();
          }
          break;

        case 'BATAL':
          batal();
          break;
      }
    } catch (galat) {
      console.log('[PERINTAH] galat:', kodeGalat(galat));
      detak.tik('tolak');
      void platform.getar('gagal');
    } finally {
      setMendengar(false);
    }
  }

  async function dengarkanNominal(): Promise<void> {
    await dengarPerintahSuara();
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
  const label = labelUtama(state.fase, hasilAktif, state);

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

  const tombolBicaraPerintah = (
    <Tombol
      label={
        mendengar
          ? 'Sedang mendengarkan perintah suara'
          : 'Bicara perintah suara untuk navigasi'
      }
      ragam="sekunder"
      nonaktif={mendengar}
      onAktif={() => void dengarPerintahSuara()}
    >
      {mendengar ? 'Mendengarkan…' : '🎤 Bicara Perintah'}
    </Tombol>
  );

  const tombolBicaraPerintahGelap = (
    <Tombol
      label={
        mendengar
          ? 'Sedang mendengarkan perintah suara'
          : 'Bicara perintah suara untuk navigasi'
      }
      ragam="sekunder"
      gelap
      nonaktif={mendengar}
      onAktif={() => void dengarPerintahSuara()}
    >
      {mendengar ? 'Mendengarkan…' : '🎤 Bicara Perintah'}
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

  return (
    <>
      {isiLayar()}

      {/*
        Hanya untuk keadaan mendesak: abstain dan uang kurang. Pengumuman
        rutin sudah disuarakan pengucap; mencerminkannya ke sini akan membuat
        TalkBack membacakannya lagi setelah suara kita selesai.
      */}
      <div role="alert" aria-live="assertive" className="sr-only">
        {hasilAktif?.status === 'abstain' ? 'Belum yakin, coba pindai lagi' : ''}
      </div>
    </>
  );

  function isiLayar() {
    switch (state.fase) {
      case 'SIAGA':
        // Layar baca uang ADALAH berandanya. Tidak ada halaman pembuka: yang
        // paling sering dibutuhkan pantas berada di tempat yang tidak perlu
        // dicari, dan membuka aplikasi berarti kamera sudah siap menjawab.
        return (
          <LayarBaca
            pemindai={pemindai}
            pengucap={pengucap}
            platform={platform}
            detak={detak}
            videoRef={videoRef}
            onDaring={bacaLewatInternet}
            aksi={
              <>
                {tombolBicaraPerintah}
                <Tombol
                  label="Mulai transaksi dan hitung kembalian"
                  onAktif={mulaiTransaksi}
                >
                  Mulai transaksi
                </Tombol>

                {/*
                  Saklar Rencana A / Rencana B, sengaja TERLIHAT.

                  Mode daring mengirim gambar uang dan suara penggunanya ke
                  internet, dan itu tidak pernah boleh terjadi tanpa ia tahu.
                  Menyembunyikannya di menu pengaturan akan membuat sebagian
                  pengguna memakainya tanpa pernah sadar.
                */}
                {!KUNCI_DARING && (
                  <Tombol
                    label={
                      modeSistem === 'luring'
                        ? 'Mode luring aktif. Ganti ke mode daring yang memakai internet'
                        : 'Mode daring aktif, memakai internet. Ganti kembali ke mode luring'
                    }
                    ragam="hantu"
                    onAktif={gantiMode}
                  >
                    {modeSistem === 'luring'
                      ? 'Mode: luring'
                      : 'Mode: daring (internet)'}
                  </Tombol>
                )}
              </>
            }
          />
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
                {tombolBicaraPerintahGelap}
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
            subjudul={
              state.kembalianWajib !== null
                ? `Kembalian seharusnya Rp${state.kembalianWajib.toLocaleString('id-ID')}`
                : 'Arahkan kamera ke uang kembalian dari pedagang'
            }
            isiPenuh
            petunjuk="Ketuk di mana saja untuk menyelesaikan transaksi"
            aksi={
              <>
                <Tombol
                  label={
                    memindaiDaring
                      ? 'Sedang memindai uang kembalian'
                      : 'Pindai uang kembalian dari pedagang'
                  }
                  ragam="primer"
                  nonaktif={memindaiDaring}
                  onAktif={() => void pindaiLewatInternet()}
                >
                  {memindaiDaring ? 'Memindai…' : 'Pindai uang'}
                </Tombol>
                <Tombol label={label} onAktif={tindakanUtama}>
                  Selesaikan transaksi
                </Tombol>
                {tombolBicaraPerintah}
                {tombolBatal}
              </>
            }
          >
            <LapisanKetuk onAktif={tindakanUtama} />
            <Pratinjau
              videoRef={videoRef}
              hasil={hasilAktif}
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
              <>
                <Tombol label={label} onAktif={tindakanUtama}>
                  Selesai
                </Tombol>
                {tombolBicaraPerintahGelap}
              </>
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
