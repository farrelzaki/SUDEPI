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
            <div className="pointer-events-none flex h-full flex-col justify-center gap-6">
              <p className="max-w-[30ch] text-[1.0625rem] leading-relaxed text-[var(--color-tinta-redup)]">
                Kenali nominal uang, hitung kembalian, lalu periksa kembalian
                yang kamu terima.
              </p>

              <ol className="flex flex-col gap-2.5">
                {[
                  'Pindai uang yang kamu bayarkan',
                  'Masukkan total belanja',
                  'Tunjukkan layar ke pedagang',
                  'Periksa kembalian dari pedagang',
                ].map((teks, i) => (
                  <li
                    key={teks}
                    className="flex items-center gap-3.5 rounded-2xl bg-[var(--color-kartu)] px-4 py-3.5"
                    style={{ boxShadow: 'var(--shadow-kartu)' }}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold"
                      style={{
                        backgroundColor: 'var(--color-primer-tipis)',
                        color: 'var(--color-primer)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[0.9375rem] font-semibold">{teks}</span>
                  </li>
                ))}
              </ol>

              <div className="flex items-center gap-2.5 text-[var(--color-tinta-samar)]">
                <IkonLuring />
                <span className="text-[0.8125rem] font-semibold">
                  Bekerja sepenuhnya tanpa internet
                </span>
              </div>
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
                <span className="eyebrow" style={{ color: 'var(--color-sukses-terang)' }}>
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
                    <span className="eyebrow" style={{ color: 'var(--color-kasir-redup)' }}>
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
                <KodeTunanetra jumlah={3} warna="var(--color-kasir-redup)" ukuran={9} />
              </div>
            </div>
          </Kerangka>
        );
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
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
