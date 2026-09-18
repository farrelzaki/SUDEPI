/**
 * Keluaran suara.
 *
 * Dua strategi, dipilih otomatis:
 *
 *   1. Potongan audio pra-render lewat Web Audio API — JALUR UTAMA.
 *   2. `speechSynthesis` — CADANGAN, hanya kalau potongan gagal dimuat.
 *
 * Kenapa bukan `speechSynthesis` saja, yang jauh lebih sedikit kodenya: di
 * dalam WebView Android ia meneruskan permintaan ke mesin TTS sistem, yang
 * hanya bekerja luring kalau paket suara Bahasa Indonesia sudah terpasang di
 * perangkat itu. Paket itu tidak selalu ada dan tidak bisa kami pasang dari
 * dalam aplikasi. Kalau tidak ada, HP mencoba mengambilnya dari jaringan — dan
 * dalam mode pesawat aplikasi MEMBISU TOTAL.
 *
 * Untuk aplikasi yang seluruh keluarannya suara dan dipakai orang yang tidak
 * bisa membaca layar, membisu bukan berarti berkurang fiturnya; ia sepenuhnya
 * tidak berguna. Dan kegagalan itu paling mungkin terjadi justru di HP yang
 * baru pertama kali dipasangi aplikasi kami — misalnya HP juri. Lihat ADR-0003.
 */

import type { IdFrasa, Pengucap, Ucapan } from '@/contracts';
import { rupiahKeKlip, type Klip } from './angka';
import { TEKS_FRASA } from './frasa';

/** Nama potongan: klip bilangan atau frasa sistem. */
export type NamaPotongan = Klip | IdFrasa;

export interface ManifesAudio {
  readonly suara: string;
  readonly kecepatan: string;
  /** Nama potongan yang tersedia sebagai berkas `<nama>.mp3`. */
  readonly potongan: readonly string[];
}

/** Meratakan `Ucapan` menjadi daftar potongan yang harus diputar berurutan. */
export function keUrutanPotongan(ucapan: Ucapan): readonly NamaPotongan[] {
  switch (ucapan.jenis) {
    case 'frasa':
      return [ucapan.id];
    case 'rupiah':
      return rupiahKeKlip(ucapan.nilai);
    case 'urutan':
      return ucapan.bagian.flatMap(keUrutanPotongan);
  }
}

/** Bentuk teks dari sebuah ucapan. Untuk `aria-label` dan cadangan TTS. */
export function keTeks(ucapan: Ucapan): string {
  return keUrutanPotongan(ucapan)
    .map((p) => (p in TEKS_FRASA ? TEKS_FRASA[p as IdFrasa] : p))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface OpsiPengucap {
  readonly urlManifes?: string;
  readonly kecepatan?: number;
}

/**
 * Potongan disimpan sebagai berkas terpisah, BUKAN satu sprite dengan offset.
 *
 * Alasan sprite pada umumnya adalah menghemat permintaan jaringan. Di sini
 * tidak ada jaringan sama sekali — seluruhnya aset lokal di dalam APK —
 * sehingga keuntungannya hilang, sementara biayanya tetap: menggabung audio
 * butuh perkakas tambahan, dan perhitungan offset milidetik adalah sumber
 * kesalahan yang tidak akan terdengar sampai satu kata terpotong di tengah
 * kalimat. Lihat amandemen pada ADR-0003.
 */

/**
 * Membuat pengucap, mencoba potongan pra-render lebih dulu lalu jatuh ke TTS.
 *
 * `siap()` tidak pernah melempar error. Kegagalan memuat potongan adalah
 * keadaan yang diantisipasi, bukan kesalahan — dan aplikasi harus tetap
 * bersuara.
 */
export function buatPengucap(opsi: OpsiPengucap = {}): Pengucap {
  // Diselesaikan jadi mutlak terhadap halaman, pelajaran yang sama dengan
  // pemuatan model: path relatif bisa diselesaikan terhadap berkas lain dan
  // gagal diam-diam.
  const urlManifes = new URL(
    opsi.urlManifes ?? './audio/manifes.json',
    globalThis.location.href,
  ).href;
  const kecepatan = opsi.kecepatan ?? 1;

  let konteks: AudioContext | null = null;
  let penguat: GainNode | null = null;
  let sumberAktif: AudioBufferSourceNode | null = null;
  let dibatalkan = false;
  const buffer = new Map<string, AudioBuffer>();

  async function muatKlip(): Promise<void> {
    // fetch di sini menyasar aset di dalam bundel, bukan host luar. Ia tetap
    // berfungsi dalam mode pesawat.
    const res = await fetch(urlManifes);
    if (!res.ok) throw new Error(`Manifes audio tidak ada: ${urlManifes}`);
    const m = (await res.json()) as ManifesAudio;

    const dasar = urlManifes.slice(0, urlManifes.lastIndexOf('/') + 1);
    const ctx = ambilKonteks();

    // Dimuat paralel. Semuanya aset lokal, jadi yang memakan waktu adalah
    // decode, bukan pengambilan berkas.
    await Promise.all(
      m.potongan.map(async (nama) => {
        const r = await fetch(`${dasar}${nama}.mp3`);
        if (!r.ok) return;
        buffer.set(nama, await ctx.decodeAudioData(await r.arrayBuffer()));
      }),
    );

    if (buffer.size === 0) throw new Error('Tidak ada potongan audio yang termuat');
  }

  function ambilKonteks(): AudioContext {
    if (!konteks) {
      konteks = new AudioContext();
      penguat = konteks.createGain();
      penguat.connect(konteks.destination);
    }
    return konteks;
  }

  function putarPotongan(nama: NamaPotongan): Promise<void> {
    const ctx = ambilKonteks();
    const buf = buffer.get(nama);
    // Potongan yang belum dirender dilewati diam-diam. Lebih baik satu kata
    // hilang daripada seluruh kalimat berhenti di tengah.
    if (!buf || !penguat) return Promise.resolve();

    // Disalin ke const lokal: penyempitan tipe hilang di dalam closure.
    const tujuan = penguat;

    return new Promise<void>((selesai) => {
      const sumber = ctx.createBufferSource();
      sumber.buffer = buf;
      sumber.playbackRate.value = kecepatan;
      sumber.connect(tujuan);
      sumber.onended = () => {
        sumberAktif = null;
        selesai();
      };
      sumberAktif = sumber;
      sumber.start();
    });
  }

  function ucapDenganTts(teks: string): Promise<void> {
    return new Promise<void>((selesai) => {
      if (typeof speechSynthesis === 'undefined') {
        selesai();
        return;
      }
      const u = new SpeechSynthesisUtterance(teks);
      u.lang = 'id-ID';
      u.rate = kecepatan;
      u.onend = () => selesai();
      // Kegagalan TTS tidak boleh menggantung alur transaksi.
      u.onerror = () => selesai();
      speechSynthesis.speak(u);
    });
  }

  return {
    async siap() {
      try {
        await muatKlip();
      } catch {
        // Sengaja ditelan. Klip hilang berarti kita memakai TTS, bukan berarti
        // aplikasi gagal. Perbedaan ini penting: melempar error di sini akan
        // menghentikan seluruh aplikasi hanya karena suara tidak seideal yang
        // direncanakan.
        buffer.clear();
      }
    },

    async ucap(ucapan: Ucapan) {
      dibatalkan = false;

      if (buffer.size > 0) {
        for (const potongan of keUrutanPotongan(ucapan)) {
          if (dibatalkan) return;
          await putarPotongan(potongan);
        }
        return;
      }

      await ucapDenganTts(keTeks(ucapan));
    },

    hentikan() {
      dibatalkan = true;
      try {
        sumberAktif?.stop();
      } catch {
        // Sumber yang sudah berhenti melempar error saat di-stop lagi.
      }
      sumberAktif = null;
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },

    redam(aktif: boolean) {
      // Audio ducking. Karena kita mengendalikan grafik audionya sendiri, ini
      // cukup satu nilai penguatan — jauh lebih tepat daripada mencoba meredam
      // mesin TTS sistem, yang memang tidak menyediakan caranya.
      if (!penguat || !konteks) return;
      penguat.gain.setTargetAtTime(aktif ? 0.25 : 1, konteks.currentTime, 0.08);
    },
  };
}
