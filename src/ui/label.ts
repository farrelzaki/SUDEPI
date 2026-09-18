import type { Fase, HasilPindai, StateTransaksi } from '@/contracts';
import { rupiahKeTeks } from '@/audio/angka';

/**
 * Label tombol utama: keadaan sekarang DAN akibat mengaktifkannya.
 *
 * Label ini tidak boleh menjanjikan sesuatu yang akan ditolak reducer. Kalau
 * ia berkata "ketuk untuk menyelesaikan" padahal ketukannya akan ditolak,
 * pengguna yang tidak bisa melihat layar hanya mengetuk dan tidak terjadi
 * apa-apa — tanpa cara mengetahui penyebabnya. Karena itu ia membaca `state`,
 * bukan hanya hasil pindai.
 */
export function labelUtama(
  fase: Fase,
  hasil: HasilPindai | null,
  state: StateTransaksi,
): string {
  switch (fase) {
    case 'SIAGA':
      return 'SUDEPI siap. Mulai memindai uang.';

    case 'PINDAI_BAYAR':
      if (hasil?.status === 'stabil') {
        return `Terdeteksi ${rupiahKeTeks(hasil.totalKertas)}${
          hasil.adaKoin ? ', ditambah koin' : ''
        }. Lanjut ke kalkulator.`;
      }
      if (hasil?.status === 'abstain') {
        return 'Belum yakin. Dekatkan uang atau cari tempat lebih terang, lalu tunggu.';
      }
      return 'Mencari uang. Arahkan kamera ke uang, jarak sekitar dua puluh sentimeter.';

    case 'KALKULATOR':
      return 'Kunci nominal dan lanjut.';

    case 'LAYAR_KASIR':
      return 'Layar menghadap pedagang. Lanjut memeriksa kembalian.';

    case 'PINDAI_KEMBALIAN':
      if (hasil?.status === 'stabil') {
        // nominalKoin non-null menandakan penurunan koin berhasil. Kalau null,
        // selisihnya tidak masuk akal sebagai koin — biasanya ada uang kertas
        // yang belum terdeteksi — dan KONFIRMASI akan ditolak.
        if (state.nominalKoin === null) {
          return (
            'Kembalian belum cocok dengan yang seharusnya. ' +
            'Periksa apakah ada uang yang belum terbaca, lalu pindai lagi.'
          );
        }
        const koin =
          state.nominalKoin > 0
            ? `, ditambah koin ${rupiahKeTeks(state.nominalKoin)}`
            : '';
        return `Kembalian ${rupiahKeTeks(hasil.totalKertas)}${koin}. Selesaikan transaksi.`;
      }
      if (hasil?.status === 'abstain') {
        return 'Belum yakin dengan kembaliannya. Coba pindai lagi.';
      }
      return 'Arahkan kamera ke uang kembalian.';

    case 'SELESAI':
      return 'Transaksi selesai. Kembali ke mode siaga.';
  }
}
