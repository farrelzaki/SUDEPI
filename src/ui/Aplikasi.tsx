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
  // komponen terpasang. `videoRef.current` masih null saat render pertama, dan
  // membuat pemindai dengan elemen video yang belum ada akan gagal diam-diam —
  // kamera tidak pernah menyala dan tidak ada pesan galat sama sekali.
  const [pemindai, setPemindai] = useState<PemindaiKamera>(() =>
    buatMockPemindai(),
  );

  useEffect(() => {
    if (PAKAI_MOCK) return;
    const video = videoRef.current;
    if (!video) return;
    const asli = buatPemindai({ video });
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

  const [nilaiKolom, setNilaiKolom] = useState(0);

  // Saat masuk kalkulator, kolom dimulai dari nol: yang diminta adalah TOTAL
  // BELANJA, sedangkan uang yang dibayar sudah terisi dari hasil pindai.
  useEffect(() => {
    if (state.fase === 'KALKULATOR') setNilaiKolom(0);
  }, [state.fase]);

  function tindakanUtama(): void {
    if (state.fase === 'SIAGA' || state.fase === 'SELESAI') {
      mulai();
      return;
    }
    if (state.fase === 'KALKULATOR') {
      kirim({ jenis: 'SET_BELANJA', nilai: nilaiKolom });
      kirim({ jenis: 'KONFIRMASI' });
      return;
    }
    kirim({ jenis: 'KONFIRMASI' });
  }

  const memindai =
    state.fase === 'PINDAI_BAYAR' || state.fase === 'PINDAI_KEMBALIAN';

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-black">
      {state.fase === 'KALKULATOR' ? (
        <PanelKalkulator
          nilai={nilaiKolom}
          onUbah={setNilaiKolom}
          onLanjut={tindakanUtama}
        />
      ) : (
      <TombolUtama label={labelUtama(state.fase, hasilPindai, state)} onAktif={tindakanUtama}>
        {/*
          Pratinjau SELALU dirender, hanya disembunyikan saat tidak memindai.
          Kalau elemen video ikut dilepas antar fase, `videoRef` kosong saat
          pemindai sungguhan dibuat, dan kamera tidak pernah menyala tanpa satu
          pun pesan galat.
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
