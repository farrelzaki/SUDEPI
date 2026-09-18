/**
 * Basis data lokal SUDEPI.
 *
 * Lapisan tipis di atas Dexie. Seluruh logika yang bisa dipikirkan tanpa
 * IndexedDB ada di `penyangga.ts` sebagai fungsi murni; berkas ini hanya
 * mendefinisikan bentuk dan melakukan tulis-baca.
 */

import Dexie, { type EntityTable } from 'dexie';
import { PENGATURAN_BAWAAN, TABEL_DENOMINASI, type Pengaturan } from '@/contracts';
import { rupiahKeTeks } from '@/audio/angka';
import type {
  BarisAgregatMetrik,
  BarisDenominasi,
  BarisHasilDeteksi,
  BarisLogKejadian,
  BarisPengaturan,
  BarisSesiPemindaian,
  BarisSesiTransaksi,
  BarisVersiModel,
} from './skema';

export class DbSudepi extends Dexie {
  declare denominasi: EntityTable<BarisDenominasi, 'kodeKelas'>;
  declare versi_model: EntityTable<BarisVersiModel, 'idModel'>;
  declare pengaturan: EntityTable<BarisPengaturan, 'id'>;
  declare sesi_transaksi: EntityTable<BarisSesiTransaksi, 'idTransaksi'>;
  declare sesi_pemindaian: EntityTable<BarisSesiPemindaian, 'idPemindaian'>;
  declare hasil_deteksi: EntityTable<BarisHasilDeteksi, 'idDeteksi'>;
  declare log_kejadian: EntityTable<BarisLogKejadian, 'idKejadian'>;
  declare agregat_metrik: EntityTable<BarisAgregatMetrik, 'idMetrik'>;

  constructor(nama = 'sudepi') {
    super(nama);

    // Indeks sengaja sedikit. Setiap indeks memperlambat penulisan, dan
    // penulisan adalah hal yang paling ingin kita jaga tetap murah di HP kelas
    // bawah. Yang diindeks hanya yang benar-benar dipakai untuk menelusuri:
    // relasi induk-anak, dan waktu untuk ringkasan harian.
    this.version(1).stores({
      denominasi: 'kodeKelas',
      versi_model: 'idModel, dipasangPadaMs',
      pengaturan: 'id',
      sesi_transaksi: 'idTransaksi, mulaiPadaMs, status',
      sesi_pemindaian: 'idPemindaian, idTransaksi',
      hasil_deteksi: 'idDeteksi, idPemindaian',
      log_kejadian: 'idKejadian, idTransaksi, padaMs',
      agregat_metrik: 'idMetrik',
    });
  }
}

/**
 * Mengisi tabel referensi statis.
 *
 * Dipanggil idempoten: aman dijalankan berkali-kali. `bulkPut` menimpa, jadi
 * kalau tabel denominasi berubah karena model baru, isinya ikut diperbarui.
 */
export async function siapkanDb(db: DbSudepi): Promise<void> {
  await db.denominasi.bulkPut(
    TABEL_DENOMINASI.map((d) => ({
      kodeKelas: d.kodeKelas,
      nominal: d.nominal,
      koin: d.koin,
      naskahSuara: d.koin ? 'koin' : rupiahKeTeks(d.nominal ?? 0),
    })),
  );

  // Pengaturan hanya diisi kalau belum ada, supaya preferensi pengguna tidak
  // terhapus setiap aplikasi dibuka.
  const ada = await db.pengaturan.get('tunggal');
  if (!ada) {
    await db.pengaturan.put({ id: 'tunggal', ...PENGATURAN_BAWAAN });
  }
}

export async function bacaPengaturan(db: DbSudepi): Promise<Pengaturan> {
  const baris = await db.pengaturan.get('tunggal');
  if (!baris) return PENGATURAN_BAWAAN;
  const { id: _id, ...sisa } = baris;
  return sisa;
}

export async function tulisPengaturan(
  db: DbSudepi,
  sebagian: Partial<Pengaturan>,
): Promise<void> {
  const kini = await bacaPengaturan(db);
  await db.pengaturan.put({ id: 'tunggal', ...kini, ...sebagian });
}
