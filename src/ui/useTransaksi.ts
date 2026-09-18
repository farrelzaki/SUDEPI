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

export interface OpsiTransaksi {
  readonly pemindai: PemindaiKamera;
  readonly pengucap: Pengucap;
  readonly platform: Platform;
}

export interface KendaliTransaksi {
  readonly state: StateTransaksi;
  readonly hasilPindai: HasilPindai | null;
  readonly kirim: (peristiwa: Peristiwa) => void;
  /** Jalan pintas MULAI yang menyuntikkan waktu, supaya reducer tetap murni. */
  readonly mulai: () => void;
}

export function useTransaksi({
  pemindai,
  pengucap,
  platform,
}: OpsiTransaksi): KendaliTransaksi {
  const [state, setState] = useState<StateTransaksi>(STATE_AWAL);
  const [hasilPindai, setHasilPindai] = useState<HasilPindai | null>(null);

  // Efek dijalankan lewat ref, bukan lewat dependensi useCallback. Kalau
  // `kirim` berubah identitasnya tiap render, langganan pemindai ikut
  // dipasang ulang terus-menerus dan kamera tersendat.
  const efekRef = useRef<(efek: readonly Efek[]) => void>(() => {});

  efekRef.current = (efek: readonly Efek[]): void => {
    for (const e of efek) {
      switch (e.jenis) {
        case 'UCAP':
          // Ducking dinyalakan sebelum bicara dan dimatikan setelahnya, bukan
          // dipasang permanen — kalau tidak, suara sekitar tertekan terus dan
          // pengguna kehilangan kesadaran situasi di pasar.
          pengucap.redam(true);
          void pengucap.ucap(e.ucapan).finally(() => pengucap.redam(false));
          break;

        case 'GETAR':
          void platform.getar(e.pola);
          break;

        case 'MULAI_PINDAI':
          void pemindai.mulai(e.fase);
          break;

        case 'HENTIKAN_PINDAI':
          pemindai.berhenti();
          // Ucapan yang sedang berjalan ikut dihentikan. Membiarkannya
          // menyelesaikan kalimat tentang fase yang sudah ditinggalkan hanya
          // membingungkan.
          pengucap.hentikan();
          break;

        case 'SIMPAN_TRANSAKSI':
          // Persistensi Dexie menyusul di src/data/. Sengaja dibiarkan kosong
          // daripada dipalsukan — transaksi tetap berjalan tanpa riwayat.
          break;
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
      setHasilPindai(hasil);
      kirim({ jenis: 'HASIL_PINDAI', muatan: hasil });
    });
    return () => {
      lepas();
    };
  }, [pemindai, kirim]);

  // Pembersihan saat komponen dilepas. Tanpa ini kamera tetap menyala setelah
  // aplikasi ditutup, dan lampu kamera yang menyala terus tidak akan disadari
  // oleh pengguna yang tidak bisa melihatnya.
  useEffect(() => {
    return () => {
      pemindai.berhenti();
      pengucap.hentikan();
    };
  }, [pemindai, pengucap]);

  return useMemo(
    () => ({ state, hasilPindai, kirim, mulai }),
    [state, hasilPindai, kirim, mulai],
  );
}
