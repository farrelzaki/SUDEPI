/**
 * Detak kerja — bunyi pendek yang menandakan sistem sedang bekerja.
 *
 * MASALAH YANG DISELESAIKAN. Inferensi memakan sekitar 0,7 detik per bingkai,
 * dan selama tidak ada yang cukup diyakini, aplikasi tidak mengatakan apa pun.
 * Bagi pengguna yang tidak bisa melihat layar, keheningan itu **tidak bisa
 * dibedakan dari kerusakan**. Ia tidak tahu apakah sistem sedang berusaha,
 * kameranya tertutup jari, atau aplikasinya memang mati — jadi ia berhenti
 * mencoba, dan kembali bergantung pada orang lain.
 *
 * Kenapa bunyi, bukan kalimat. Kalimat "sedang mencari" yang diulang tiap
 * bingkai akan menyumbat satu-satunya saluran keluaran yang kita punya —
 * persis kesalahan nomor 10 di docs/PROGRES.md. Detak pendek menyampaikan hal
 * yang sama dalam 40 milidetik, tidak menuntut perhatian, dan bisa diabaikan
 * begitu pengguna terbiasa. Idiomnya sudah dikenal luas: pemindai barkode di
 * kasir, alat detektor logam, mesin EDC.
 *
 * SATU DETAK SAMA DENGAN SATU BINGKAI YANG SELESAI DIPROSES. Bukan timer
 * hiasan. Artinya iramanya jujur: kalau HP melambat karena panas, detaknya ikut
 * melambat, dan pengguna mendengar apa adanya.
 *
 * DIBANGKITKAN, BUKAN DIREKAM. Tidak ada berkas audio baru yang perlu dibundel
 * — osilator Web Audio bekerja sepenuhnya luring dan menambah nol byte ke APK.
 */

export type JenisDetak =
  /** Bingkai bersih, belum ada apa-apa di depan kamera. */
  | 'cari'
  /** Ada yang terlihat tetapi belum cukup diyakini. Nadanya naik. */
  | 'dekat'
  /** Sedang menyiapkan model, sebelum bingkai pertama tiba. */
  | 'siap'
  /** Permintaan tidak dimengerti. Nadanya TURUN. */
  | 'tolak'
  /** Mulai mendengarkan ucapan. Nadanya naik, pendek. */
  | 'dengar'
  /** Jendela mendengarkan sudah tutup. Satu nada datar. */
  | 'usai';

export interface Detak {
  /** Satu bunyi pendek. Diabaikan diam-diam kalau sedang disenyapkan. */
  tik(jenis: JenisDetak): void;
  /** Denyut lambat berulang, untuk masa tunggu yang belum menghasilkan apa pun. */
  mulaiMenyiapkan(): void;
  hentikanMenyiapkan(): void;
  /** Disenyapkan selagi sistem bicara, supaya tidak menutupi kalimatnya. */
  senyapkan(aktif: boolean): void;
  tutup(): void;
}

/**
 * Volume detak, jauh di bawah ucapan.
 *
 * Ucapan memakai penguatan 3,5 karena nominal uang harus terdengar di pasar.
 * Detak justru harus berada di latar: cukup untuk meyakinkan, tidak cukup untuk
 * mengganggu, dan tidak pernah bersaing dengan angka.
 */
const PUNCAK = 0.08;
const PANJANG_DETIK = 0.045;
const JEDA_MENYIAPKAN_MS = 900;

const NADA: Record<JenisDetak, readonly number[]> = {
  // Rendah dan tumpul: "aku hidup, belum melihat apa-apa".
  cari: [440],
  // Dua nada naik: "ada sesuatu, aku sedang memastikan". Kenaikan itu
  // disengaja — arah nada adalah satu-satunya isyarat yang bisa ditangkap
  // tanpa harus mengingat nada sebelumnya.
  dekat: [523, 659],
  // Denyut tunggal yang lebih dalam, khusus masa menyiapkan.
  siap: [330],
  // Dua nada TURUN. Arah nada adalah isyarat yang bisa dipahami tanpa harus
  // mengingat nada sebelumnya, jadi naik berarti "silakan" dan turun berarti
  // "tidak" — tanpa satu kata pun, dan tanpa menyumbat saluran suara.
  tolak: [523, 349],
  dengar: [587, 784],
  // Satu nada datar. Tanpa penanda ini pengguna hanya menebak kapan ia boleh
  // berhenti bicara, dan sebagian ucapannya terpotong di ujung rekaman.
  usai: [587],
};

export function buatDetak(): Detak {
  let konteks: AudioContext | null = null;
  let senyap = false;
  let timerSiap: ReturnType<typeof setInterval> | null = null;

  function ambilKonteks(): AudioContext | null {
    // AudioContext hanya boleh dibuat setelah ada gestur pengguna. Di aplikasi
    // ini gestur itu pasti sudah terjadi — detak baru berbunyi setelah
    // pemindaian dimulai, dan pemindaian dimulai oleh ketukan.
    try {
      konteks ??= new AudioContext();
      if (konteks.state === 'suspended') void konteks.resume();
      return konteks;
    } catch {
      // Perangkat tanpa Web Audio tetap boleh memakai aplikasi. Yang hilang
      // hanya kepastian bahwa sistem sedang bekerja, bukan fungsinya.
      return null;
    }
  }

  function bunyikan(frekuensi: number, mundurDetik: number): void {
    const ctx = ambilKonteks();
    if (!ctx) return;

    const mulai = ctx.currentTime + mundurDetik;
    const osilator = ctx.createOscillator();
    const amplop = ctx.createGain();

    // Gelombang segitiga, bukan sinus murni: sedikit lebih berisi sehingga
    // tetap terdengar lewat speaker HP yang kecil, tanpa menjadi kasar.
    osilator.type = 'triangle';
    osilator.frequency.value = frekuensi;

    // Serangan sangat cepat lalu peluruhan mulus. Tanpa amplop, gelombang yang
    // dimulai dan dihentikan mendadak menghasilkan bunyi 'klik' di ujungnya.
    amplop.gain.setValueAtTime(0.0001, mulai);
    amplop.gain.exponentialRampToValueAtTime(PUNCAK, mulai + 0.006);
    amplop.gain.exponentialRampToValueAtTime(0.0001, mulai + PANJANG_DETIK);

    osilator.connect(amplop);
    amplop.connect(ctx.destination);
    osilator.start(mulai);
    osilator.stop(mulai + PANJANG_DETIK + 0.02);
  }

  function tik(jenis: JenisDetak): void {
    if (senyap) return;
    const nada = NADA[jenis];
    nada.forEach((f, i) => bunyikan(f, i * 0.07));
  }

  return {
    tik,

    mulaiMenyiapkan() {
      if (timerSiap !== null) return;
      tik('siap');
      timerSiap = setInterval(() => tik('siap'), JEDA_MENYIAPKAN_MS);
    },

    hentikanMenyiapkan() {
      if (timerSiap === null) return;
      clearInterval(timerSiap);
      timerSiap = null;
    },

    senyapkan(aktif: boolean) {
      senyap = aktif;
    },

    tutup() {
      if (timerSiap !== null) clearInterval(timerSiap);
      timerSiap = null;
      void konteks?.close().catch(() => {});
      konteks = null;
    },
  };
}
