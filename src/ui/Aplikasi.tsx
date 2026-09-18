/**
 * Layar utama SUDEPI.
 *
 * Merakit fase demi fase di atas pola dua tombol dari `docs/AKSESIBILITAS.md`.
 * Seluruh keputusan alur ada di `core/mesin.ts`; berkas ini hanya memilih apa
 * yang tampil dan apa yang dibacakan.
 *
 * Aturan yang mengikat seluruh berkas ini: **tulis kode dengan anggapan
 * layarnya mati.** Bukan "pengguna kesulitan melihat", tapi benar-benar tidak
 * ada gambar sama sekali. Kalau sebuah alur hanya bisa diselesaikan dengan
 * melihat sesuatu, alur itu belum selesai dikerjakan.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PemindaiKamera, Platform } from '@/contracts';
import { buatPengucap } from '@/audio/pengucap';
import { buatMockPlatform, pilihPlatform } from '@/platform/mock';
import { DbSudepi, siapkanDb } from '@/data/db';
import { buatRepositori, type Repositori } from '@/data/repositori';
import { buatPemindai } from '@/vision/pemindai';
import { buatMockPemindai } from '@/vision/mockPemindai';
import { LayarKasir } from './LayarKasir';
import { Pratinjau } from './Pratinjau';
import { labelUtama } from './label';
import { PanelKalkulator } from './PanelKalkulator';
import { TombolBatal, TombolUtama } from './Tombol';
import { useTransaksi } from './useTransaksi';

/**
 * Di browser desktop tidak ada kamera belakang maupun model, jadi `pnpm dev`
 * memakai pemindai bernaskah. Naskahnya sengaja memuat kasus buruk — abstain,
 * belum stabil, tidak ada objek — supaya jalur buruk ikut terbangun sejak awal
 * dan tidak baru ketahuan di jam ke-21.
 */
const PAKAI_MOCK = !import.meta.env.PROD;

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

  const { state, hasilPindai, kirim, mulai } = useTransaksi({
    pemindai,
    pengucap,
    platform,
    repositori,
  });

  // Nilai kalkulator TIDAK disimpan di komponen, melainkan di state machine.
  //
  // Versi sebelumnya menyimpannya lokal, dan akibatnya menekan tombol pecahan
  // hanya mengubah angka di layar tanpa mengirim apa pun ke mesin transaksi —
  // sehingga tidak ada yang diucapkan. Pengguna yang tidak bisa melihat layar
  // menekan "+50.000" dan tidak punya cara mengetahui apakah tercatat.
  const nilaiKolom = state.totalBelanja ?? 0;
  const ubahBelanja = (nilai: number): void => {
    kirim({ jenis: 'SET_BELANJA', nilai });
  };

  function tindakanUtama(): void {
    if (state.fase === 'SIAGA') {
      mulai();
      return;
    }
    // Dari SELESAI kita kembali ke Mode Siaga, BUKAN langsung memulai
    // transaksi baru. Dua alasan: labelnya memang menjanjikan itu, dan exsum
    // Bab III Fase 4 menyebutnya ("aplikasi kembali ke Mode Siaga").
    //
    // Langsung menyalakan kamera lagi juga salah secara praktis — begitu
    // transaksi beres, pengguna sedang memasukkan uang ke dompet dan bicara
    // dengan pedagang, bukan bersiap memindai. Kamera yang menyala sendiri
    // memboroskan baterai tanpa ada yang menyadarinya.

    kirim({ jenis: 'KONFIRMASI' });
  }

  const memindai =
    state.fase === 'PINDAI_BAYAR' || state.fase === 'PINDAI_KEMBALIAN';

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-black">
      {state.fase === 'KALKULATOR' ? (
        <PanelKalkulator
          nilai={nilaiKolom}
          onUbah={ubahBelanja}
          onLanjut={tindakanUtama}
        />
      ) : (
      <TombolUtama label={labelUtama(state.fase, hasilPindai, state)} onAktif={tindakanUtama}>
        {/*
          Pratinjau tetap dirender di seluruh fase cabang ini, hanya
          disembunyikan saat tidak memindai — melepas dan memasangnya kembali
          tiap fase memaksa kamera menyala ulang tanpa alasan.

          Perlu diingat cabang KALKULATOR di atas TIDAK memuat pratinjau, jadi
          elemen video memang dibuat ulang setiap kali pengguna melewatinya.
          Itu tidak apa-apa sekarang: pemindai memegang `videoRef`, bukan
          elemennya. Dulu ia memegang elemennya, dan satu kali lewat kalkulator
          sudah cukup untuk mematikan kamera sampai aplikasi dibuka ulang.
        */}
        <div className={memindai ? 'absolute inset-0' : 'absolute h-0 w-0 overflow-hidden opacity-0'}>
          <Pratinjau videoRef={videoRef} hasil={memindai ? hasilPindai : null} />
        </div>

        {state.fase === 'SIAGA' && (
          <div className="z-10 text-center">
            <div className="text-6xl font-bold tracking-tight text-white">SUDEPI</div>
            <div className="mt-2 text-xl text-white/60">Ketuk untuk mulai</div>
          </div>
        )}

        {state.fase === 'LAYAR_KASIR' && (
          <div className="absolute inset-0">
            <LayarKasir
              totalBelanja={state.totalBelanja ?? 0}
              uangDibayar={state.uangDibayar ?? 0}
              kembalian={state.kembalianWajib ?? 0}
            />
          </div>
        )}

        {state.fase === 'SELESAI' && (
          <div className="z-10 text-center">
            <div className="text-5xl font-bold text-[var(--color-stabil)]">SELESAI</div>
            <div className="mt-3 text-2xl text-white/70">
              Kembalian {(state.kembalianWajib ?? 0).toLocaleString('id-ID')}
            </div>
          </div>
        )}
      </TombolUtama>
      )}

      {/*
        Mode Siaga tidak punya tombol batal — tidak ada yang bisa dibatalkan
        di sana, dan tombol yang tidak melakukan apa-apa hanya membingungkan
        pengguna yang menelusurinya dengan TalkBack.
      */}
      {state.fase !== 'SIAGA' ? (
        <TombolBatal onBatal={() => kirim({ jenis: 'BATAL' })} />
      ) : (
        <div className="h-[25dvh] w-full bg-black" />
      )}

      {/*
        Hanya untuk keadaan mendesak: abstain dan uang kurang. Pengumuman
        rutin sudah disuarakan pengucap; mencerminkannya ke sini akan membuat
        TalkBack membacakannya lagi setelah suara kita selesai.
      */}
      <div role="alert" aria-live="assertive" className="sr-only">
        {hasilPindai?.status === 'abstain' ? 'Belum yakin, coba pindai lagi' : ''}
      </div>
    </main>
  );
}
