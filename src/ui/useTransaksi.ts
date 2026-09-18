/**
 * Penghubung antara reducer murni dan dunia nyata.
 *
 * `core/mesin.ts` tidak tahu apa-apa soal kamera, suara, atau getaran — ia
 * hanya mengembalikan daftar `Efek`. Berkas inilah yang menjalankannya.
 *
 * Pemisahan ini yang membuat seluruh alur transaksi bisa diuji dalam milidetik
 * tanpa perangkat apa pun, dan berkas ini sengaja dibuat setipis mungkin:
 * semakin banyak keputusan yang bocor ke sini, semakin sedikit yang terlindungi
 * oleh tes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  STATE_AWAL,
  type Efek,
  type HasilPindai,
  type PemindaiKamera,
  type Pengucap,
  type Peristiwa,
  type Platform,
  type StateTransaksi,
} from '@/contracts';
import { reduksi } from '@/core/mesin';
import { keTeks } from '@/audio/pengucap';
import { buatDetak, type Detak } from '@/audio/detak';
import { buatPenyangga } from '@/data/penyangga';
import type { Repositori } from '@/data/repositori';

export interface OpsiTransaksi {
  readonly pemindai: PemindaiKamera;
  readonly pengucap: Pengucap;
  readonly platform: Platform;
  /**
   * Opsional. Tanpa ini transaksi tetap berjalan normal, hanya tidak
   * meninggalkan riwayat — dan itu memang urutan prioritasnya: menghitung
   * kembalian jauh lebih penting daripada mencatatnya.
   */
  readonly repositori?: Repositori | null;
}

export interface KendaliTransaksi {
  readonly state: StateTransaksi;
  /**
   * Nada kerja, dibagikan supaya seluruh aplikasi memakai SATU AudioContext.
   * Membuat yang kedua berarti dua rantai audio yang bisa saling menindih.
   */
  readonly detak: Detak;
  readonly hasilPindai: HasilPindai | null;
  readonly kirim: (peristiwa: Peristiwa) => void;
  /** Jalan pintas MULAI yang menyuntikkan waktu, supaya reducer tetap murni. */
  readonly mulai: () => void;
}

export function useTransaksi({
  pemindai,
  pengucap,
  platform,
  repositori = null,
}: OpsiTransaksi): KendaliTransaksi {
  const [state, setState] = useState<StateTransaksi>(STATE_AWAL);
  const [hasilPindai, setHasilPindai] = useState<HasilPindai | null>(null);

  // Riwayat dikumpulkan di memori selama memindai, lalu ditulis SEKALI saat
  // fase berakhir. Menulis tiap bingkai berarti ratusan transaksi tulis per
  // menit di utas yang sama dengan UI, dan pratinjau kamera akan tersendat
  // tanpa satu pun petunjuk penyebabnya. Lihat data/penyangga.ts.
  const penyangga = useRef(buatPenyangga());

  /**
   * Detak kerja. Bukan hiasan — ia yang membedakan "sistem sedang berusaha"
   * dari "sistem mati" bagi orang yang tidak bisa melihat layar. Lihat
   * audio/detak.ts.
   */
  const detak = useMemo(() => buatDetak(), []);
  /** Menandai masa antara kamera dinyalakan dan bingkai pertama selesai. */
  const menyiapkan = useRef(false);
  const idTransaksi = useRef<string | null>(null);
  const fasePindai = useRef<1 | 4 | null>(null);
  const mulaiPindaiMs = useRef(0);
  const stateRef = useRef<StateTransaksi>(STATE_AWAL);
  stateRef.current = state;

  // Efek dijalankan lewat ref, bukan lewat dependensi useCallback. Kalau
  // `kirim` berubah identitasnya tiap render, langganan pemindai ikut
  // dipasang ulang terus-menerus dan kamera tersendat.
  const efekRef = useRef<(efek: readonly Efek[]) => void>(() => {});

  efekRef.current = (efek: readonly Efek[]): void => {
    for (const e of efek) {
      switch (e.jenis) {
        case 'UCAP':
          // Dicatat dengan sengaja, dan dipertahankan di produksi.
          //
          // Pernah ada bug di mana setiap bingkai stabil memicu pengumuman
          // baru — delapan kali per detik, saling menumpuk, terdengar seperti
          // gema yang tidak berhenti. Kalau baris ini muncul beruntun dengan
          // isi yang sama, bug itu kembali, dan penyebabnya langsung terlihat
          // tanpa perlu menebak.
          console.log('[UCAP]', keTeks(e.ucapan));
          pengucap.redam(true);
          // Detak ikut disenyapkan selagi bicara. Kalimat yang menyampaikan
          // nominal uang tidak boleh ditumpangi bunyi apa pun.
          detak.senyapkan(true);
          void pengucap.ucap(e.ucapan).finally(() => {
            pengucap.redam(false);
            detak.senyapkan(false);
          });
          break;

        case 'GETAR':
          void platform.getar(e.pola);
          break;

        case 'MULAI_PINDAI':
          penyangga.current.kosongkan();
          fasePindai.current = e.fase;
          mulaiPindaiMs.current = Date.now();
          // Id dibuat di awal transaksi, bukan saat menyimpan, supaya sesi
          // pemindaian Fase 1 dan Fase 4 bisa menunjuk induk yang sama.
          if (e.fase === 1) idTransaksi.current = `trx_${Date.now().toString(36)}`;
          // Memuat model dan menyalakan kamera memakan beberapa detik. Tanpa
          // penanda apa pun, detik-detik itu terdengar sama persis seperti
          // aplikasi yang gagal dijalankan.
          menyiapkan.current = true;
          detak.mulaiMenyiapkan();
          void pemindai.mulai(e.fase);
          break;

        case 'HENTIKAN_PINDAI': {
          const fase = fasePindai.current;
          const id = idTransaksi.current;
          if (repositori && fase !== null && id !== null) {
            void repositori.simpanPemindaian(
              id,
              fase,
              mulaiPindaiMs.current,
              Date.now(),
              penyangga.current.ringkas(),
            );
          }
          fasePindai.current = null;
          menyiapkan.current = false;
          detak.hentikanMenyiapkan();
          pemindai.berhenti();
          // Ucapan yang sedang berjalan ikut dihentikan. Membiarkannya
          // menyelesaikan kalimat tentang fase yang sudah ditinggalkan hanya
          // membingungkan.
          pengucap.hentikan();
          break;
        }

        case 'SIMPAN_TRANSAKSI': {
          const id = idTransaksi.current;
          if (!repositori || id === null) break;
          const s = stateRef.current;
          // Status diturunkan dari state, bukan dikirim reducer: fase SELESAI
          // berarti berhasil, selain itu berarti pengguna keluar di tengah.
          const status =
            s.fase === 'SELESAI'
              ? 'selesai'
              : s.alasanAbstain !== null
                ? 'abstain'
                : 'dibatalkan';
          const kini = Date.now();
          void repositori
            .simpanTransaksi(id, s, status, kini, null)
            .then(() => repositori.perbaruiAgregat(kini));
          idTransaksi.current = null;
          break;
        }
      }
    }
  };

  const kirim = useCallback((peristiwa: Peristiwa): void => {
    setState((sebelum) => {
      const { state: sesudah, efek } = reduksi(sebelum, peristiwa);
      // Efek dijalankan setelah render, bukan di dalam updater. Updater React
      // bisa dipanggil dua kali di StrictMode, dan efek yang dijalankan di
      // dalamnya akan berbunyi atau bergetar dua kali.
      queueMicrotask(() => efekRef.current(efek));
      return sesudah;
    });
  }, []);

  const mulai = useCallback((): void => {
    kirim({ jenis: 'MULAI', padaMs: Date.now() });
  }, [kirim]);

  // Hasil pindai mengalir masuk terus-menerus selama kamera hidup.
  useEffect(() => {
    const lepas = pemindai.langgan((hasil) => {
      // Satu detak per bingkai yang benar-benar selesai diproses, sehingga
      // iramanya jujur: kalau perangkat melambat, detaknya ikut melambat.
      //
      // Hasil 'stabil' TIDAK ditandai detak — pada saat itu sistem sudah
      // menyebut nominalnya, dan menambahkan bunyi di atas kalimat itu hanya
      // mengaburkan satu-satunya informasi yang benar-benar dibutuhkan.
      if (menyiapkan.current) {
        menyiapkan.current = false;
        detak.hentikanMenyiapkan();
      }
      if (hasil.status === 'tidak-ada-objek') detak.tik('cari');
      else if (hasil.status !== 'stabil') detak.tik('dekat');

      setHasilPindai(hasil);
      penyangga.current.tambah(hasil);
      kirim({ jenis: 'HASIL_PINDAI', muatan: hasil });
    });
    return () => {
      lepas();
    };
  }, [pemindai, kirim, detak]);

  // Pembersihan saat komponen dilepas. Tanpa ini kamera tetap menyala setelah
  // aplikasi ditutup, dan lampu kamera yang menyala terus tidak akan disadari
  // oleh pengguna yang tidak bisa melihatnya.
  useEffect(() => {
    return () => {
      pemindai.berhenti();
      pengucap.hentikan();
      detak.tutup();
    };
  }, [pemindai, pengucap, detak]);

  return useMemo(
    () => ({ state, hasilPindai, kirim, mulai, detak }),
    [state, hasilPindai, kirim, mulai, detak],
  );
}
