import { describe, expect, it } from 'vitest';
import { VOTING_BUTUH, VOTING_DARI, type Deteksi } from '@/contracts';
import { sidikJari, votingTemporal } from './voting';

/**
 * Bingkai berisi kelas-kelas tertentu.
 *
 * TEMPAT SETIAP LEMBAR DITENTUKAN KELASNYA, bukan urutannya dalam larik.
 * Versi pertama memakai indeks larik, dan itu keliru sejak awal: menukar urutan
 * deteksi lalu berarti MEMINDAHKAN uangnya. Selama voting hanya melihat nama
 * kelas, kekeliruan itu tidak kelihatan; begitu voting mulai melihat tempat
 * (ADR-0012), ia langsung membuat tes menguji hal yang mustahil terjadi.
 *
 * Lembar kedua bernominal sama digeser ke tempatnya sendiri, karena dua lembar
 * memang tidak bisa menempati satu ruang.
 */
function bingkai(kelas: readonly number[], geser = 0): readonly Deteksi[] {
  const sudahDipakai = new Map<number, number>();
  return kelas.map((kodeKelas) => {
    const ke = sudahDipakai.get(kodeKelas) ?? 0;
    sudahDipakai.set(kodeKelas, ke + 1);
    return {
      kodeKelas,
      nominal: null,
      koin: false,
      skor: 0.95,
      kotak: {
        x: 0.1 + geser,
        y: 0.02 + ((kodeKelas * 2 + ke) % 9) * 0.105,
        w: 0.5,
        h: 0.08,
      },
      iouMaks: 0,
    };
  });
}

const KOSONG: readonly Deteksi[] = [];

describe('sidikJari', () => {
  it('mengabaikan urutan deteksi', () => {
    expect(sidikJari(bingkai([5, 2, 6]))).toBe(sidikJari(bingkai([6, 5, 2])));
  });

  it('MENGABAIKAN posisi kotak', () => {
    // Uang yang dipegang tangan selalu bergeser antar bingkai. Menuntut
    // kotaknya berimpit akan membuat sistem tidak pernah mencapai stabil.
    expect(sidikJari(bingkai([5], 0))).toBe(sidikJari(bingkai([5], 0.3)));
  });

  it('membedakan jumlah lembar yang sama nominalnya', () => {
    expect(sidikJari(bingkai([5]))).not.toBe(sidikJari(bingkai([5, 5])));
  });

  it('bingkai kosong menghasilkan sidik jari kosong', () => {
    expect(sidikJari(KOSONG)).toBe('');
  });
});

describe('votingTemporal', () => {
  it('stabil setelah cukup bingkai sepakat', () => {
    const hasil = votingTemporal([bingkai([5]), bingkai([5]), bingkai([5])]);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi).toHaveLength(1);
  });

  it('BELUM stabil kalau baru satu bingkai di bawah ambang', () => {
    expect(votingTemporal([bingkai([5]), bingkai([5])]).status).toBe('belum-stabil');
  });

  it('tidak stabil saat jawabannya berganti-ganti', () => {
    // Persis pola yang muncul dari kilatan cahaya atau guncangan tangan.
    // Confidence gating saja tidak akan menangkap ini — skornya bisa 0,95.
    const hasil = votingTemporal([
      bingkai([5]),
      bingkai([4]),
      bingkai([5, 2]),
      bingkai([6]),
      bingkai([4, 4]),
    ]);
    expect(hasil.status).toBe('belum-stabil');
    expect(hasil.deteksi).toEqual([]);
  });

  it('stabil walau ada bingkai menyimpang di tengah', () => {
    // 3 dari 5 sepakat. Satu kedipan tidak boleh membatalkan hasil yang benar.
    const hasil = votingTemporal([
      bingkai([5]),
      bingkai([4]),
      bingkai([5]),
      bingkai([]),
      bingkai([5]),
    ]);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi.map((d) => d.kodeKelas)).toEqual([5]);
  });

  it('meja kosong yang konsisten dilaporkan tidak-ada-objek, bukan stabil', () => {
    const hasil = votingTemporal([KOSONG, KOSONG, KOSONG, KOSONG]);
    expect(hasil.status).toBe('tidak-ada-objek');
    expect(hasil.deteksi).toEqual([]);
  });

  it('jendela kosong tidak menghasilkan error', () => {
    expect(votingTemporal([])).toEqual({ status: 'tidak-ada-objek', deteksi: [] });
  });

  it('hanya menghitung VOTING_DARI bingkai terakhir', () => {
    // Enam bingkai lama berisi 50.000, lalu pengguna mengganti uangnya.
    // Hasil lama tidak boleh menahan sistem.
    const jendela = [
      ...Array.from({ length: 6 }, () => bingkai([5])),
      ...Array.from({ length: 3 }, () => bingkai([6])),
    ];
    const hasil = votingTemporal(jendela);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi.map((d) => d.kodeKelas)).toEqual([6]);
  });

  it('mengambil kotak dari bingkai TERBARU yang sepakat', () => {
    // Kotak yang diucapkan harus sedekat mungkin dengan apa yang sedang
    // dilihat kamera, bukan posisi beberapa bingkai lalu.
    const hasil = votingTemporal([
      bingkai([5], 0),
      bingkai([5], 0.1),
      bingkai([5], 0.25),
    ]);
    expect(hasil.deteksi[0]?.kotak.x).toBeCloseTo(0.35, 6);
  });

  it('menghormati tetapan VOTING_BUTUH dari VOTING_DARI', () => {
    const pas = Array.from({ length: VOTING_BUTUH }, () => bingkai([5]));
    expect(votingTemporal(pas).status).toBe('stabil');

    const kurang = Array.from({ length: VOTING_BUTUH - 1 }, () => bingkai([5]));
    expect(votingTemporal(kurang).status).toBe('belum-stabil');
  });

  it('butuh mayoritas, jadi dua jawaban seimbang tidak bisa menang', () => {
    expect(VOTING_BUTUH).toBeGreaterThan(VOTING_DARI / 2);
    const hasil = votingTemporal([
      bingkai([5]),
      bingkai([6]),
      bingkai([5]),
      bingkai([6]),
    ]);
    expect(hasil.status).toBe('belum-stabil');
  });

  /** Satu lembar di satu tempat, dengan kelas dan pergeseran yang ditentukan. */
  function satuTempat(kodeKelas: number, geserX = 0): readonly Deteksi[] {
    return [
      {
        kodeKelas,
        nominal: null,
        koin: false,
        skor: 0.95,
        kotak: { x: 0.25 + geserX, y: 0.4, w: 0.5, h: 0.25 },
        iouMaks: 0,
      },
    ];
  }

  it('satu lembar yang IDENTITASNYA berkedip tidak pernah disebut', () => {
    // Kegagalan yang melahirkan voting per-tempat. Dengan voting per-kelas,
    // satu lembar yang tebakannya berayun antara beberapa pecahan membuat
    // masing-masing pecahan mengumpulkan suaranya sendiri — dan satu lembar di
    // tangan dilaporkan sebagai beberapa lembar, dengan total LEBIH BESAR
    // daripada uang yang sebenarnya ada.
    const hasil = votingTemporal([
      satuTempat(4),
      satuTempat(5),
      satuTempat(4),
      satuTempat(5),
      satuTempat(6),
    ]);
    expect(hasil.status).not.toBe('stabil');
    expect(hasil.deteksi).toHaveLength(0);
  });

  it('satu lembar yang identitasnya MANTAP tetap disebut walau sesekali meleset', () => {
    // Batas dari keputusan di atas: satu tebakan meleset di tengah tidak boleh
    // melumpuhkan sistem, selama sisanya sepakat.
    const hasil = votingTemporal([
      satuTempat(4),
      satuTempat(4),
      satuTempat(5),
      satuTempat(4),
      satuTempat(4),
    ]);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi.map((d) => d.kodeKelas)).toEqual([4]);
  });

  it('lembar yang bergeser di tangan tetap dihitung SATU, bukan beberapa', () => {
    // Uang dipegang tangan dan selalu bergeser di antara bingkai. Kalau
    // pergeseran itu membuatnya dianggap lembar baru, satu lembar akan
    // dijumlahkan berkali-kali.
    const hasil = votingTemporal([
      satuTempat(4, 0),
      satuTempat(4, 0.04),
      satuTempat(4, 0.08),
      satuTempat(4, 0.12),
      satuTempat(4, 0.16),
    ]);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi).toHaveLength(1);
  });

  it('lembar kedua yang BERKEDIP tetap ikut diumumkan', () => {
    // Inilah kasus yang melahirkan ADR-0012. Lembar yang paling jelas terbaca
    // muncul di setiap bingkai; lembar kedua berkedip melintasi ambang. Dengan
    // voting per-himpunan, jawaban yang menang adalah {A} — yaitu jawaban yang
    // MENGHILANGKAN uang milik pengguna.
    const hasil = votingTemporal([
      bingkai([4]),
      bingkai([4, 2]),
      bingkai([4]),
      bingkai([4, 2]),
      bingkai([4, 2]),
    ]);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi.map((d) => d.kodeKelas).sort()).toEqual([2, 4]);
  });

  it('lembar yang hanya sesekali terlihat TIDAK ikut diumumkan', () => {
    // Batas dari keputusan di atas. Dua dari lima bingkai bukan kesepakatan,
    // dan menyebut uang yang tidak ada jauh lebih berbahaya daripada diam.
    const hasil = votingTemporal([
      bingkai([4]),
      bingkai([4, 2]),
      bingkai([4]),
      bingkai([4]),
      bingkai([4, 2]),
    ]);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi.map((d) => d.kodeKelas)).toEqual([4]);
  });

  it('dua lembar bernominal sama tidak menyusut jadi satu', () => {
    // Kalau kesepakatan hanya dihitung "ada atau tidak ada", dua lembar lima
    // ribu akan dilaporkan sebagai satu lembar — dan pengguna kehilangan uang
    // tanpa pernah diberi tahu.
    const hasil = votingTemporal([
      bingkai([2, 2]),
      bingkai([2]),
      bingkai([2, 2]),
      bingkai([2, 2]),
      bingkai([2, 2]),
    ]);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi.map((d) => d.kodeKelas)).toEqual([2, 2]);
  });

  it('tumpukan tiga lembar dikenali sebagai satu jawaban utuh', () => {
    const hasil = votingTemporal([
      bingkai([6, 4, 2]),
      bingkai([6, 4]),
      bingkai([2, 6, 4]),
      bingkai([6, 4, 2]),
    ]);
    expect(hasil.status).toBe('stabil');
    expect(hasil.deteksi).toHaveLength(3);
  });
});
