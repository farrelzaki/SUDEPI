/**
 * State machine transaksi.
 *
 * Reducer MURNI: tanpa I/O, tanpa `Date.now()`, tanpa `Math.random()`. Ia
 * mengembalikan state baru beserta daftar `Efek` yang harus dijalankan
 * pemanggil. Itulah yang membuat seluruh alur transaksi bisa diuji dalam
 * milidetik, tanpa kamera, tanpa suara, tanpa HP.
 *
 * Dua sifat yang wajib dijaga, keduanya punya tes:
 *
 * 1. `BATAL` sah dari fase mana pun kecuali SIAGA. Satu fase yang tidak bisa
 *    dibatalkan adalah jebakan bagi orang yang tidak bisa melihat di mana dia
 *    terjebak.
 * 2. Peristiwa yang tidak sah dikembalikan TANPA PERUBAHAN, bukan melempar
 *    error. Aplikasi yang dipakai tunanetra tidak boleh mati karena ketukan
 *    tak terduga.
 */

import {
  AMBANG_BERDEMPETAN,
  frasa,
  rupiah,
  urutan,
  STATE_AWAL,
  type Efek,
  type HasilReduksi,
  type HasilPindai,
  type Peristiwa,
  type StateTransaksi,
} from '@/contracts';
import { hitungKembalian } from './kembalian';
import { turunkanKoin } from './koin';

/** Tidak ada perubahan. Dipakai untuk setiap peristiwa yang tidak sah. */
function diam(state: StateTransaksi): HasilReduksi {
  return { state, efek: [] };
}

/**
 * Kembali ke Mode Siaga dan buang seluruh data transaksi.
 *
 * Transaksi yang dibatalkan TETAP disimpan. Lampiran 7 mencantumkan
 * "dibatalkan lewat Escape-Hatch" sebagai status yang sah, dan angkanya justru
 * yang dibutuhkan tahap Check pada Lampiran 11: seberapa sering pengguna
 * menyerah di tengah jalan adalah ukuran kegunaan yang lebih jujur daripada
 * seberapa sering ia berhasil.
 */
function batalkan(alasanUcap: boolean): HasilReduksi {
  const efek: Efek[] = [{ jenis: 'HENTIKAN_PINDAI' }, { jenis: 'SIMPAN_TRANSAKSI' }];
  if (alasanUcap) {
    efek.push(
      { jenis: 'UCAP', ucapan: frasa('transaksi_dibatalkan') },
      { jenis: 'GETAR', pola: 'gagal' },
    );
  }
  return { state: STATE_AWAL, efek };
}

/**
 * Apakah ada lembaran yang terlalu berdempetan.
 *
 * Mitigasi risiko nomor 2 pada Lampiran 8. `iouMaks` adalah tumpang tindih
 * tertinggi sebuah kotak terhadap kotak lain SEBELUM penyaringan, jadi nilai
 * tinggi berarti dua hal yang tidak bisa dibedakan dari satu bingkai: satu
 * lembar yang terbaca dua kali, atau dua lembar yang bertumpuk.
 *
 * Sistem tidak bisa menjawabnya. Pengguna bisa, dalam satu detik.
 */
function adaYangBerdempetan(hasil: HasilPindai): boolean {
  return hasil.deteksi.some((d) => d.iouMaks > AMBANG_BERDEMPETAN);
}

/** Menyusun ucapan hasil pindai: tiap lembar, total, lalu koin. */
export function ucapkanHasilPindai(hasil: HasilPindai): Efek[] {
  const bernominal = hasil.deteksi.filter((d) => d.nominal !== null);

  if (bernominal.length === 0 && !hasil.adaKoin) {
    return [{ jenis: 'UCAP', ucapan: frasa('tidak_ada_uang') }];
  }

  const bagian = [
    frasa('terdeteksi'),
    ...bernominal.map((d) => rupiah(d.nominal ?? 0)),
    frasa('total'),
    rupiah(hasil.totalKertas),
    ...(hasil.adaKoin ? [frasa('ditambah_koin')] : []),
    // Peringatan ditaruh di AKHIR, setelah nominalnya disebut. Kalau ditaruh
    // di depan, pengguna mendengar instruksi sebelum tahu angkanya, dan harus
    // menunggu seluruh kalimat selesai untuk tahu apakah perlu bertindak.
    ...(adaYangBerdempetan(hasil) ? [frasa('renggangkan_lembaran')] : []),
  ];

  return [
    { jenis: 'UCAP', ucapan: urutan(...bagian) },
    { jenis: 'GETAR', pola: 'sedang' },
  ];
}

/**
 * Apakah dua hasil pindai menyampaikan isi yang sama kepada pengguna.
 *
 * Kamera menghasilkan sekitar 8 bingkai stabil per detik selama uang masih
 * berada di depannya. Tanpa pembanding ini, setiap bingkai memicu pengumuman
 * baru — delapan kali per detik, saling menumpuk, dan tidak pernah berhenti
 * selama uangnya belum disingkirkan.
 *
 * Yang dibandingkan hanya apa yang DIDENGAR pengguna: total, keberadaan koin,
 * dan himpunan pecahannya. Posisi kotak sengaja diabaikan — uang yang dipegang
 * tangan selalu bergeser sedikit, dan itu tidak mengubah apa pun yang diucapkan.
 */
export function isinyaSama(a: HasilPindai | null, b: HasilPindai): boolean {
  if (!a || a.status !== 'stabil' || b.status !== 'stabil') return false;
  if (a.totalKertas !== b.totalKertas) return false;
  if (a.adaKoin !== b.adaKoin) return false;

  const kunci = (h: HasilPindai): string =>
    h.deteksi.map((d) => d.kodeKelas).sort((x, y) => x - y).join(',');
  return kunci(a) === kunci(b);
}

/** Respons seragam saat sistem tidak cukup yakin. */
export const EFEK_ABSTAIN: readonly Efek[] = [
  { jenis: 'UCAP', ucapan: frasa('belum_yakin_ulangi') },
  { jenis: 'GETAR', pola: 'gagal' },
];

/**
 * Abstain diberitahukan SEKALI per kejadian, bukan sekali per bingkai.
 *
 * Bingkai berdatangan sekitar sekali per 0,85 detik, dan versi pertama
 * mengucapkan "belum yakin, coba pindai lagi" pada setiap bingkai abstain.
 * Kalimatnya sendiri lebih panjang dari jeda itu, sehingga ucapan berikutnya
 * memotong yang sebelumnya di tengah kata — terdengar sebagai suku kata yang
 * terus mengulang dan tidak pernah selesai. Terjadi paling parah pada uang
 * TERLIPAT, karena keyakinannya bertahan lama tepat di bawah ambang.
 *
 * Yang menjengkelkan bagi orang awas, melumpuhkan bagi pengguna kami: satu-
 * satunya saluran keluaran kami adalah suara, dan saluran itu jadi tersumbat
 * oleh peringatan yang sama berulang kali. Pengguna tidak bisa mendengar
 * kalimat utuhnya, jadi ia bahkan tidak tahu apa yang diminta sistem.
 *
 * `alasanAbstain` dipakai sebagai kuncinya — ia sudah ada di kontrak dan sudah
 * dibersihkan setiap kali hasil stabil tiba, sehingga tidak perlu menambah
 * bidang baru ke `src/contracts/`.
 */
function tanggapiAbstain(
  state: StateTransaksi,
  dasar: StateTransaksi,
  alasan: string,
): HasilReduksi {
  const sudahDiberitahu = state.alasanAbstain !== null;
  return {
    state: { ...dasar, alasanAbstain: alasan },
    efek: sudahDiberitahu ? [] : [...EFEK_ABSTAIN],
  };
}

export function reduksi(
  state: StateTransaksi,
  peristiwa: Peristiwa,
): HasilReduksi {
  // BATAL berlaku dari mana pun kecuali SIAGA. Ditangani lebih dulu supaya
  // tidak ada satu fase pun yang bisa lupa menyediakannya.
  if (peristiwa.jenis === 'BATAL') {
    return state.fase === 'SIAGA' ? diam(state) : batalkan(true);
  }

  switch (state.fase) {
    case 'SIAGA': {
      if (peristiwa.jenis !== 'MULAI') return diam(state);
      // Transaksi kini dimulai dari KALKULATOR, bukan dari kamera.
      //
      // Membaca uang dan bertransaksi adalah dua kebutuhan berbeda, dan
      // menyatukannya memaksa orang yang hanya ingin tahu "ini uang berapa"
      // melewati alur yang menuntut harga belanja, layar pedagang, dan
      // verifikasi kembalian. Alat bacanya kini berdiri sendiri di
      // `core/pembaca.ts`, dan kamera hanya muncul lagi di akhir untuk
      // memeriksa kembalian. Lihat ADR-0014.
      return {
        state: { ...STATE_AWAL, fase: 'KALKULATOR', mulaiPadaMs: peristiwa.padaMs },
        efek: [{ jenis: 'UCAP', ucapan: frasa('uang_dibayar') }],
      };
    }

    case 'PINDAI_BAYAR': {
      switch (peristiwa.jenis) {
        case 'HASIL_PINDAI': {
          const hasil = peristiwa.muatan;

          if (hasil.status === 'stabil') {
            const dasar: StateTransaksi = {
              ...state,
              hasilPindaiTerakhir: hasil,
              alasanAbstain: null,
            };
            // Isi yang sama TIDAK diumumkan ulang. Selama uang masih di depan
            // kamera, bingkai stabil terus berdatangan; mengucapkannya tiap
            // kali membuat suara bertumpuk dan tak pernah berhenti.
            if (isinyaSama(state.hasilPindaiTerakhir, hasil)) {
              return { state: dasar, efek: [] };
            }
            // Isi yang BERBEDA tetap diumumkan — pengguna mungkin menambah
            // atau mengganti lembaran, dan itu wajib terdengar.
            return { state: dasar, efek: ucapkanHasilPindai(hasil) };
          }

          // KUNCI HASIL STABIL. Begitu sebuah nominal diucapkan, ia menjadi
          // tawaran yang berlaku sampai pengguna menanggapinya. Hasil tidak
          // stabil berikutnya TIDAK boleh menghapusnya.
          //
          // Tanpa penguncian ini muncul kegagalan yang sangat merugikan:
          // pengguna mendengar "terdeteksi seratus ribu, ketuk untuk lanjut",
          // lalu memindahkan jempolnya untuk mengetuk. Dalam satu detik itu
          // tangannya bergeser sedikit, bingkai berikutnya jadi tidak stabil,
          // dan ketukannya DITOLAK DIAM-DIAM. Bagi orang yang tidak bisa
          // melihat layar, tidak ada cara mengetahui apa yang terjadi — ia
          // hanya mengetuk dan tidak terjadi apa-apa.
          //
          // Ditemukan saat menelusuri antarmuka sungguhnya, bukan lewat tes.
          if (state.hasilPindaiTerakhir?.status === 'stabil') {
            return diam(state);
          }

          if (hasil.status === 'abstain') {
            return tanggapiAbstain(
              state,
              { ...state, hasilPindaiTerakhir: hasil },
              'keyakinan di bawah ambang',
            );
          }

          // 'belum-stabil' dan 'tidak-ada-objek': simpan, jangan bicara.
          //
          // Bedanya, 'tidak-ada-objek' MENGAKHIRI kejadian abstain: uangnya
          // sudah disingkirkan dari depan kamera, jadi percobaan berikutnya
          // berhak mendapat peringatan lagi. 'belum-stabil' tidak, karena ia
          // hanya kedipan di tengah percobaan yang sama.
          return {
            state: {
              ...state,
              hasilPindaiTerakhir: hasil,
              alasanAbstain:
                hasil.status === 'tidak-ada-objek' ? null : state.alasanAbstain,
            },
            efek: [],
          };
        }

        case 'KONFIRMASI': {
          const hasil = state.hasilPindaiTerakhir;
          // Hanya hasil yang sudah stabil yang boleh dikunci jadi nominal.
          if (!hasil || hasil.status !== 'stabil' || hasil.totalKertas <= 0) {
            return diam(state);
          }
          return {
            state: { ...state, fase: 'KALKULATOR', uangDibayar: hasil.totalKertas },
            efek: [
              { jenis: 'HENTIKAN_PINDAI' },
              { jenis: 'GETAR', pola: 'berhasil' },
              {
                jenis: 'UCAP',
                ucapan: urutan(
                  frasa('uang_dibayar'),
                  rupiah(hasil.totalKertas),
                  frasa('total_belanja'),
                ),
              },
            ],
          };
        }

        case 'ULANGI_PINDAI':
          return {
            state: { ...state, hasilPindaiTerakhir: null, alasanAbstain: null },
            efek: [{ jenis: 'MULAI_PINDAI', fase: 1 }],
          };

        default:
          return diam(state);
      }
    }

    case 'KALKULATOR': {
      switch (peristiwa.jenis) {
        case 'SET_BELANJA':
          // Nominalnya diucapkan SETIAP kali berubah, dan hanya angkanya —
          // tanpa awalan "total belanja". Konteksnya sudah disebut saat masuk
          // fase ini, dan mengulanginya tiap tekan membuat pengguna menunggu
          // dua kata sebelum mendengar hal yang ia butuhkan.
          //
          // Getaran ringan mendampinginya karena ia sampai SEKETIKA, sebelum
          // suara sempat mulai. Di pasar yang bising, sering hanya itu yang
          // benar-benar terasa.
          return {
            state: { ...state, totalBelanja: peristiwa.nilai },
            efek: [
              { jenis: 'GETAR', pola: 'ringan' },
              { jenis: 'UCAP', ucapan: rupiah(peristiwa.nilai) },
            ],
          };

        case 'SET_BAYAR':
          return {
            state: { ...state, uangDibayar: peristiwa.nilai },
            efek: [
              { jenis: 'GETAR', pola: 'ringan' },
              { jenis: 'UCAP', ucapan: rupiah(peristiwa.nilai) },
            ],
          };

        case 'KONFIRMASI':
          return kunciPembayaran(state, 'LAYAR_KASIR');

        case 'LEWATI_LAYAR_KASIR':
          return kunciPembayaran(state, 'PINDAI_KEMBALIAN');

        default:
          return diam(state);
      }
    }

    case 'LAYAR_KASIR': {
      if (peristiwa.jenis !== 'KONFIRMASI') return diam(state);
      return {
        state: { ...state, fase: 'PINDAI_KEMBALIAN' },
        efek: [
          { jenis: 'MULAI_PINDAI', fase: 4 },
          { jenis: 'UCAP', ucapan: frasa('arahkan_kamera') },
        ],
      };
    }

    case 'PINDAI_KEMBALIAN': {
      switch (peristiwa.jenis) {
        case 'HASIL_PINDAI': {
          const hasil = peristiwa.muatan;
          const dasar: StateTransaksi = { ...state, hasilPindaiTerakhir: hasil };

          if (hasil.status !== 'stabil') {
            // Penguncian yang sama seperti di PINDAI_BAYAR: kembalian yang
            // sudah diucapkan tidak boleh hilang sebelum pengguna sempat
            // menanggapinya. Lihat catatan panjang di fase itu.
            if (state.hasilPindaiTerakhir?.status === 'stabil') {
              return diam(state);
            }
            if (hasil.status === 'abstain') {
              return tanggapiAbstain(
                state,
                dasar,
                'keyakinan di bawah ambang',
              );
            }
            return {
              state: {
                ...dasar,
                alasanAbstain:
                  hasil.status === 'tidak-ada-objek' ? null : state.alasanAbstain,
              },
              efek: [],
            };
          }

          if (state.kembalianWajib === null) return diam(state);

          // Sama seperti Fase 1: jangan mengulang kalau isinya tidak berubah.
          if (isinyaSama(state.hasilPindaiTerakhir, hasil)) {
            return { state: dasar, efek: [] };
          }

          const koin = turunkanKoin(state.kembalianWajib, hasil.totalKertas);
          if (!koin.ok) {
            // Selisih tidak masuk akal sebagai koin. Jangan menebak.
            return tanggapiAbstain(
              state,
              { ...dasar, nominalKoin: null },
              koin.alasan,
            );
          }

          return {
            state: {
              ...dasar,
              kembalianTerverifikasi: hasil.totalKertas,
              nominalKoin: koin.nominalKoin,
              alasanAbstain: null,
            },
            efek: [
              {
                jenis: 'UCAP',
                ucapan: urutan(
                  frasa('kembalian'),
                  rupiah(hasil.totalKertas),
                  ...(koin.adaKoin
                    ? [frasa('ditambah_koin'), rupiah(koin.nominalKoin)]
                    : []),
                ),
              },
              { jenis: 'GETAR', pola: 'sedang' },
            ],
          };
        }

        case 'KONFIRMASI': {
          const hasil = state.hasilPindaiTerakhir;
          // nominalKoin non-null menandakan penurunan koin berhasil.
          if (!hasil || hasil.status !== 'stabil' || state.nominalKoin === null) {
            return diam(state);
          }
          return {
            state: { ...state, fase: 'SELESAI' },
            efek: [
              { jenis: 'HENTIKAN_PINDAI' },
              { jenis: 'SIMPAN_TRANSAKSI' },
              { jenis: 'UCAP', ucapan: frasa('transaksi_selesai') },
              { jenis: 'GETAR', pola: 'berhasil' },
            ],
          };
        }

        case 'ULANGI_PINDAI':
          return {
            state: {
              ...state,
              hasilPindaiTerakhir: null,
              nominalKoin: null,
              kembalianTerverifikasi: null,
              alasanAbstain: null,
            },
            efek: [{ jenis: 'MULAI_PINDAI', fase: 4 }],
          };

        default:
          return diam(state);
      }
    }

    case 'SELESAI': {
      // Kembali ke Mode Siaga tanpa mengucapkan "dibatalkan" — transaksinya
      // berhasil, bukan dibatalkan.
      //
      // Tetapi TETAP mengucapkan "siap memindai". Tanpa itu, pengguna yang
      // tidak bisa melihat layar hanya mendengar kesunyian setelah menekan,
      // dan tidak punya cara mengetahui apakah aplikasi sudah siap untuk
      // transaksi berikutnya atau justru tersangkut.
      if (peristiwa.jenis === 'KONFIRMASI') {
        const hasil = batalkan(false);
        return {
          state: hasil.state,
          efek: [...hasil.efek, { jenis: 'UCAP', ucapan: frasa('mode_siaga') }],
        };
      }
      if (peristiwa.jenis === 'MULAI') {
        return {
          state: { ...STATE_AWAL, fase: 'PINDAI_BAYAR', mulaiPadaMs: peristiwa.padaMs },
          efek: [
            { jenis: 'MULAI_PINDAI', fase: 1 },
            { jenis: 'UCAP', ucapan: frasa('arahkan_kamera') },
          ],
        };
      }
      return diam(state);
    }
  }
}

/**
 * Mengunci nominal belanja dan bayar, lalu berpindah ke fase tujuan.
 *
 * Dipakai dua kali: lewat KONFIRMASI (menuju LAYAR_KASIR) dan lewat
 * LEWATI_LAYAR_KASIR (langsung ke PINDAI_KEMBALIAN). Penolakan bayar kurang
 * terjadi di sini — sebelum angka apa pun sempat tampil ke pedagang.
 */
function kunciPembayaran(
  state: StateTransaksi,
  tujuan: 'LAYAR_KASIR' | 'PINDAI_KEMBALIAN',
): HasilReduksi {
  if (state.totalBelanja === null || state.uangDibayar === null) {
    return diam(state);
  }

  const hasil = hitungKembalian(state.totalBelanja, state.uangDibayar);
  if (!hasil.ok) {
    return {
      state,
      efek: [
        {
          jenis: 'UCAP',
          ucapan:
            hasil.alasan === 'bayar-kurang'
              ? frasa('uang_kurang')
              : frasa('belum_yakin_ulangi'),
        },
        { jenis: 'GETAR', pola: 'gagal' },
      ],
    };
  }

  const efek: Efek[] = [
    {
      jenis: 'UCAP',
      ucapan: urutan(frasa('kembalian'), rupiah(hasil.kembalian)),
    },
    { jenis: 'GETAR', pola: 'berhasil' },
  ];
  if (tujuan === 'PINDAI_KEMBALIAN') {
    efek.push({ jenis: 'MULAI_PINDAI', fase: 4 });
  }

  return {
    state: { ...state, fase: tujuan, kembalianWajib: hasil.kembalian },
    efek,
  };
}
