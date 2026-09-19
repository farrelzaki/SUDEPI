/**
 * Membaca uang lewat internet — Rencana B.
 *
 * Dipakai HANYA saat mode daring dinyalakan sendiri oleh pengguna. Lihat
 * `platform/mode.ts`, satu-satunya gerbang menuju jaringan di aplikasi ini.
 *
 * INTI RANCANGANNYA: hasilnya dibentuk menjadi `HasilPindai`, tipe yang sama
 * persis dengan keluaran model kami sendiri. Dengan begitu seluruh lapisan
 * sesudahnya — penyusun kalimat, penahan pengulangan, penurunan nominal koin,
 * verifikasi kembalian — tidak perlu tahu sama sekali dari mana angkanya
 * datang. Tidak ada satu baris pun di hilir yang berubah karena berkas ini ada.
 *
 * GERBANG ABSTAIN IKUT DIBAWA KE SINI. Model bahasa cenderung menjawab apa pun
 * yang ditanyakan, dan itu sifat yang berbahaya untuk pekerjaan ini. Karena itu
 * ia diminta menyatakan keraguannya secara eksplisit, dan jawaban ragu
 * diterjemahkan menjadi `abstain` — bukan menjadi tebakan. Aturan nomor dua
 * proyek ini berlaku sama di kedua mode: lebih baik diam daripada salah sebut.
 */

import {
  kodeDariNominal,
  NOMINAL_URUT,
  type Deteksi,
  type HasilPindai,
  type Nominal,
} from '@/contracts';
import { KUNCI_GEMINI } from '@/platform/mode';

/**
 * Rantai model inferensi online, dicoba berurutan.
 *
 * Rantai model disiapkan secara bertingkat agar jika kuota satu model tercapai,
 * sistem langsung berpindah ke model online berikutnya secara otomatis tanpa jeda.
 * Model yang lebih cepat dan efisien diprioritaskan lebih dulu.
 */
const MODEL: readonly string[] = [
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
];

const alamat = (model: string): string =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/**
 * Lebar gambar yang dikirim.
 *
 * Dinaikkan dari 768 setelah pengujian di perangkat: pada 768, model sering
 * menjawab "tidak yakin" untuk foto yang sebenarnya jelas bagi mata manusia.
 * Angka nominal pada uang kertas Rupiah dicetak kecil, dan ketika lebar
 * gambarnya dipangkas, angka itulah yang pertama hilang.
 */
const LEBAR_KIRIM = 1024;

/** Batas menunggu jaringan. Lebih lama dari ini, pengguna sudah menyerah. */
const BATAS_MS = 12_000;

const PERINTAH = `Kamu membantu orang tunanetra mengenali uang kertas Rupiah Indonesia.

Lihat gambar ini dan laporkan uang yang terlihat.

Aturan yang WAJIB dipatuhi:
- Pecahan yang sah hanya: 1000, 2000, 5000, 10000, 20000, 50000, 100000.
- "lembar" berisi satu angka untuk SETIAP lembar fisik yang terlihat.
  Dua lembar dua puluh ribu ditulis [20000, 20000].
- "koin" bernilai true bila ada uang logam terlihat, berapa pun nilainya.
- Hitung SETIAP lembar fisik, walaupun sebagian tertutup lembar lain, asalkan
  pecahannya masih bisa kamu kenali dari warna, ukuran, atau angka yang terlihat.
- "yakin" bernilai TRUE bila kamu bisa mengenali pecahan setiap lembar yang
  kamu laporkan. Foto yang sedikit miring, kurang tajam, atau terpotong di
  pinggir TIDAK membuatmu harus menjawab tidak yakin.
- "yakin" bernilai FALSE hanya bila kamu benar-benar tidak bisa memastikan
  pecahannya, atau yang terlihat memang bukan uang Rupiah.

Menebak nominal yang salah membuat orang kehilangan uang sungguhan, jadi jangan
menebak. Tetapi menjawab "tidak yakin" untuk uang yang sebenarnya terbaca juga
merugikan — ia membuat orang mengulang-ulang tanpa pernah mendapat jawaban.`;

/** Bentuk jawaban yang diminta. Dipaksakan lewat skema, bukan diharapkan. */
const SKEMA = {
  type: 'object',
  properties: {
    lembar: { type: 'array', items: { type: 'integer' } },
    koin: { type: 'boolean' },
    yakin: { type: 'boolean' },
  },
  required: ['lembar', 'koin', 'yakin'],
} as const;

/* ------------------------------------------------------------- penguraian */

const SAH: ReadonlySet<number> = new Set<number>(NOMINAL_URUT);

/**
 * Mengubah jawaban mentah menjadi `HasilPindai`.
 *
 * Fungsi MURNI, dan seluruh perilakunya diuji tanpa jaringan. Di sinilah
 * keputusan percaya-atau-tidak diambil, bukan di tempat panggilan jaringannya.
 */
export function uraiJawaban(teks: string): HasilPindai {
  let isi: unknown;
  try {
    isi = JSON.parse(teks);
  } catch {
    // Jawaban yang tidak bisa dibaca diperlakukan sama seperti jawaban ragu.
    return abstain();
  }

  if (typeof isi !== 'object' || isi === null) return abstain();
  const o = isi as Record<string, unknown>;

  if (o.yakin !== true) return abstain();

  const mentah = Array.isArray(o.lembar) ? o.lembar : null;
  if (!mentah) return abstain();

  const deteksi: Deteksi[] = [];
  for (const n of mentah) {
    if (typeof n !== 'number' || !SAH.has(n)) {
      // Satu pecahan di luar tabel berarti jawabannya tidak bisa dipercaya
      // seluruhnya. Membuang yang asing dan memakai sisanya akan menghasilkan
      // total yang lebih kecil daripada uang yang sebenarnya ada.
      return abstain();
    }
    const kode = kodeDariNominal(n as Nominal);
    if (kode === null) return abstain();

    deteksi.push({
      kodeKelas: kode,
      nominal: n as Nominal,
      koin: false,
      // Jalur ini tidak menghasilkan skor keyakinan per kotak; yang ada hanya
      // pernyataan yakin atau tidak untuk seluruh gambar.
      skor: 1,
      // Tidak ada kotak sungguhan. Diisi bidang penuh supaya lapisan hilir yang
      // membaca `kotak` tidak perlu menangani kasus khusus.
      kotak: { x: 0, y: 0, w: 1, h: 1 },
      // Nol, bukan tinggi: peringatan "renggangkan lembarannya" tidak berlaku
      // di sini. Model bahasa melaporkan jumlah lembar secara langsung, jadi
      // tidak ada ambiguitas kotak bertindih yang perlu diperingatkan.
      iouMaks: 0,
    });
  }

  const adaKoin = o.koin === true;
  if (deteksi.length === 0 && !adaKoin) return abstain();

  return {
    status: 'stabil',
    deteksi,
    totalKertas: deteksi.reduce((j, d) => j + (d.nominal ?? 0), 0),
    adaKoin,
    latensiMs: 0,
    fps: 0,
    luma: 1,
    senterAktif: false,
  };
}

function abstain(): HasilPindai {
  return {
    status: 'abstain',
    deteksi: [],
    totalKertas: 0,
    adaKoin: false,
    latensiMs: 0,
    fps: 0,
    luma: 1,
    senterAktif: false,
  };
}

/* ---------------------------------------------------------------- gambar */

/**
 * Mengambil satu bingkai dari elemen video menjadi JPEG base64.
 *
 * Dikecilkan seperlunya saja. Memangkas terlalu jauh menghemat waktu kirim
 * tetapi menghapus justru bagian yang paling menentukan: angka nominal pada
 * uang kertas Rupiah dicetak kecil, dan itulah yang pertama hilang.
 */
export function ambilBingkai(video: HTMLVideoElement): string | null {
  const lebarAsli = video.videoWidth;
  const tinggiAsli = video.videoHeight;
  if (lebarAsli === 0 || tinggiAsli === 0) return null;

  const skala = Math.min(1, LEBAR_KIRIM / lebarAsli);
  const kanvas = document.createElement('canvas');
  kanvas.width = Math.round(lebarAsli * skala);
  kanvas.height = Math.round(tinggiAsli * skala);

  const ctx = kanvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, kanvas.width, kanvas.height);

  // Hanya bagian base64-nya; awalan `data:image/jpeg;base64,` dibuang.
  return kanvas.toDataURL('image/jpeg', 0.8).split(',')[1] ?? null;
}

/* --------------------------------------------------------------- jaringan */

export class GalatDaring extends Error {}

/**
 * Bertanya kepada model deteksi online berapa uang yang terlihat.
 *
 * Melempar `GalatDaring` bila jaringan gagal, kuota habis, atau jawabannya
 * tidak berbentuk. Pemanggil WAJIB menanganinya — kegagalan jaringan yang
 * dibiarkan menggantung membuat pengguna menunggu jawaban yang tidak akan
 * pernah datang, dan ia tidak bisa melihat layar untuk tahu sebabnya.
 */
export async function bacaUangDaring(jpegBase64: string): Promise<HasilPindai> {
  if (KUNCI_GEMINI.length === 0) throw new GalatDaring('KUNCI_KOSONG');

  let galatTerakhir: GalatDaring = new GalatDaring('JARINGAN_GAGAL');

  for (const model of MODEL) {
    try {
      const teks = await tanyaSatuModel(model, jpegBase64);
      console.log('[DARING] inferensi model online selesai');
      return uraiJawaban(teks);
    } catch (galat) {
      galatTerakhir =
        galat instanceof GalatDaring ? galat : new GalatDaring('JARINGAN_GAGAL');

      // Kuota model ini habis untuk hari ini. Model berikutnya punya jatahnya
      // sendiri, jadi pindah SEGERA — mencoba ulang model yang sama hanya
      // membuang waktu pengguna yang sedang menunggu jawaban.
      if (galatTerakhir.message === 'HTTP_429') continue;

      // Jaringan putus atau kunci bermasalah: berpindah model tidak akan
      // menolong, dan setiap percobaan menambah waktu tunggu.
      if (
        galatTerakhir.message === 'JARINGAN_GAGAL' ||
        galatTerakhir.message === 'TERLALU_LAMA' ||
        galatTerakhir.message === 'HTTP_400' ||
        galatTerakhir.message === 'HTTP_403'
      ) {
        throw galatTerakhir;
      }
      // Sisanya, termasuk 503 karena server penuh, layak dicoba ke model lain.
    }
  }

  throw galatTerakhir;
}

/** Satu permintaan ke satu model. Melempar `GalatDaring` pada kegagalan apa pun. */
async function tanyaSatuModel(
  model: string,
  jpegBase64: string,
): Promise<string> {
  const batal = new AbortController();
  const pewaktu = setTimeout(() => batal.abort(), BATAS_MS);

  try {
    const jawab = await fetch(`${alamat(model)}?key=${KUNCI_GEMINI}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: batal.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PERINTAH },
              { inline_data: { mime_type: 'image/jpeg', data: jpegBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SKEMA,
          // Serendah mungkin. Yang dibutuhkan pembacaan yang sama untuk gambar
          // yang sama, bukan jawaban yang bervariasi.
          temperature: 0,
        },
      }),
    });

    if (!jawab.ok) throw new GalatDaring(`HTTP_${jawab.status}`);

    const isi = (await jawab.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const teks = isi.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    if (!teks) throw new GalatDaring('JAWABAN_KOSONG');
    return teks;
  } catch (galat) {
    if (galat instanceof GalatDaring) throw galat;
    throw new GalatDaring(
      galat instanceof Error && galat.name === 'AbortError'
        ? 'TERLALU_LAMA'
        : 'JARINGAN_GAGAL',
    );
  } finally {
    clearTimeout(pewaktu);
  }
}
