/**
 * Keluaran suara.
 *
 * Dua strategi, dipilih otomatis:
 *
 *   1. Audio sprite pra-render lewat Web Audio API — JALUR UTAMA.
 *   2. `speechSynthesis` — CADANGAN, hanya kalau sprite gagal dimuat.
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

/** Nama potongan di dalam sprite: klip bilangan atau frasa sistem. */
export type NamaPotongan = Klip | IdFrasa;

export interface ManifesSprite {
  /** Lokasi berkas audio, relatif terhadap bundel. */
  readonly berkas: string;
  /** Detik mulai dan durasi tiap potongan. */
  readonly potongan: Readonly<Record<string, { mulai: number; durasi: number }>>;
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
 * Membuat pengucap, mencoba sprite lebih dulu lalu jatuh ke TTS.
 *
 * `siap()` tidak pernah melempar error. Kegagalan memuat sprite adalah keadaan
 * yang diantisipasi, bukan kesalahan — dan aplikasi harus tetap bersuara.
 */
export function buatPengucap(opsi: OpsiPengucap = {}): Pengucap {
  const urlManifes = opsi.urlManifes ?? './audio/sprite.json';
  const kecepatan = opsi.kecepatan ?? 1;

  let konteks: AudioContext | null = null;
  let penguat: GainNode | null = null;
  let bufferSprite: AudioBuffer | null = null;
  let manifes: ManifesSprite | null = null;
  let sumberAktif: AudioBufferSourceNode | null = null;
  let dibatalkan = false;

  async function muatSprite(): Promise<void> {
    // fetch di sini menyasar aset di dalam bundel, bukan host luar. Ia tetap
    // berfungsi dalam mode pesawat.
    const resManifes = await fetch(urlManifes);
    if (!resManifes.ok) throw new Error(`Manifes sprite tidak ada: ${urlManifes}`);
    const m = (await resManifes.json()) as ManifesSprite;

    const dasar = urlManifes.slice(0, urlManifes.lastIndexOf('/') + 1);
    const resAudio = await fetch(dasar + m.berkas);
    if (!resAudio.ok) throw new Error(`Berkas audio tidak ada: ${m.berkas}`);

    const ctx = ambilKonteks();
    bufferSprite = await ctx.decodeAudioData(await resAudio.arrayBuffer());
    manifes = m;
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
    const p = manifes?.potongan[nama];
    if (!bufferSprite || !p || !penguat) return Promise.resolve();

    // Disalin ke const lokal: penyempitan tipe hilang di dalam closure di
    // bawah, karena keduanya variabel yang bisa berubah antar pemanggilan.
    const tujuan = penguat;
    const buffer = bufferSprite;

    return new Promise<void>((selesai) => {
      const sumber = ctx.createBufferSource();
      sumber.buffer = buffer;
      sumber.playbackRate.value = kecepatan;
      sumber.connect(tujuan);
      sumber.onended = () => {
        sumberAktif = null;
        selesai();
      };
      sumberAktif = sumber;
      sumber.start(0, p.mulai, p.durasi);
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
        await muatSprite();
      } catch {
        // Sengaja ditelan. Sprite hilang berarti kita memakai TTS, bukan
        // berarti aplikasi gagal. Perbedaan ini penting: melempar error di
        // sini akan menghentikan seluruh aplikasi hanya karena suara tidak
        // seideal yang direncanakan.
        bufferSprite = null;
        manifes = null;
      }
    },

    async ucap(ucapan: Ucapan) {
      dibatalkan = false;

      if (bufferSprite && manifes) {
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
