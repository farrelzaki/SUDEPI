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
import type { PemindaiKamera, Platform } from '@/contracts';
import { buatPengucap } from '@/audio/pengucap';
import { buatMockPlatform, pilihPlatform } from '@/platform/mock';
import { DbSudepi, siapkanDb } from '@/data/db';
import { buatRepositori, type Repositori } from '@/data/repositori';
import { buatPemindai } from '@/vision/pemindai';
import { buatMockPemindai } from '@/vision/mockPemindai';
import { Kerangka, LapisanKetuk, Tombol } from './Kerangka';
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
  // Versi sebelumnya menyimpannya lokal, dan akibatnya menekan tombol angka
  // hanya mengubah tampilan tanpa mengirim apa pun ke mesin transaksi —
  // sehingga tidak ada yang diucapkan. Pengguna yang tidak bisa melihat layar
  // memasukkan nominal dan tidak punya cara mengetahui apakah tercatat.
  const nilaiKolom = state.totalBelanja ?? 0;

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
    // dengan pedagang, bukan bersiap memindai.
    kirim({ jenis: 'KONFIRMASI' });
  }

  const batal = (): void => kirim({ jenis: 'BATAL' });
  const label = labelUtama(state.fase, hasilPindai, state);

  /** Tombol batal, hadir di setiap fase kecuali Siaga dan Selesai. */
  const tombolBatal = (
    <Tombol
      label="Batalkan transaksi dan kembali ke awal"
      ragam="bahaya"
      onAktif={batal}
    >
      Batal dan kembali
    </Tombol>
  );

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
            petunjuk="Ketuk di mana saja untuk memulai"
            aksi={
              <Tombol label={label} onAktif={tindakanUtama}>
                Mulai transaksi
              </Tombol>
            }
          >
            <LapisanKetuk onAktif={tindakanUtama} />
            <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-3 text-center">
              <LogoDompet />
              <p className="max-w-xs text-lg leading-snug text-[var(--color-tinta-redup)]">
                Pindai uang, hitung kembalian, lalu periksa kembaliannya —
                seluruhnya tanpa internet.
              </p>
            </div>
          </Kerangka>
        );

      case 'PINDAI_BAYAR':
        return (
          <Kerangka
            langkah={1}
            judul="Pindai uang"
            subjudul="Arahkan kamera ke uang yang dibayarkan"
            isiPenuh
            petunjuk="Ketuk di mana saja untuk lanjut"
            aksi={
              <>
                <Tombol label={label} onAktif={tindakanUtama}>
                  Lanjutkan
                </Tombol>
                {tombolBatal}
              </>
            }
          >
            <LapisanKetuk onAktif={tindakanUtama} />
            <Pratinjau
              videoRef={videoRef}
              hasil={hasilPindai}
              judulBilah="Pindai uang rupiah di sini"
              onSenter={(n) => void pemindai.setSenter(n)}
            />
          </Kerangka>
        );

      case 'KALKULATOR':
        return (
          <Kerangka
            langkah={2}
            judul="Dialog transaksi kamu"
            subjudul="Masukkan total belanja agar kembalian bisa diperiksa"
            onKembali={batal}
            aksi={
              <>
                <Tombol label={label} onAktif={tindakanUtama}>
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
              nilai={nilaiKolom}
              onUbah={(n) => kirim({ jenis: 'SET_BELANJA', nilai: n })}
              namaKolom="total belanja"
              pertanyaan="Berapa total belanjaan kamu?"
            />
          </Kerangka>
        );

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
                {tombolBatal}
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
            judul="Deteksi kembalian"
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
              judulBilah="Pindai kembalian kamu"
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
            <div className="pointer-events-none flex h-full flex-col items-center justify-center gap-4 text-center">
              <LencanaCentang />
              <div
                className="text-2xl font-bold"
                style={{ color: 'var(--color-sukses)' }}
              >
                Transaksi selesai
              </div>
              <div>
                <div
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-kasir-redup)' }}
                >
                  Kembalian kamu
                </div>
                <div
                  className="text-6xl font-extrabold tracking-tight"
                  style={{ color: 'var(--color-kasir-teks)' }}
                >
                  Rp{(state.kembalianWajib ?? 0).toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </Kerangka>
        );
    }
  }
}

function LogoDompet() {
  return (
    <svg viewBox="0 0 24 24" className="size-24" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="5.5"
        width="19"
        height="14"
        rx="3.5"
        stroke="var(--color-primer)"
        strokeWidth="1.8"
      />
      <path
        d="M2.5 10h19"
        stroke="var(--color-primer)"
        strokeWidth="1.8"
      />
      <circle cx="17" cy="15" r="1.8" fill="var(--color-primer)" />
    </svg>
  );
}

function LencanaCentang() {
  return (
    <svg viewBox="0 0 24 24" className="size-24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="var(--color-sukses)"
        strokeWidth="1.6"
      />
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
