import type { Fase, HasilPindai, StateTransaksi } from '@/contracts';

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
        // Nominalnya SENGAJA tidak diulang di sini. Audio kita sudah
        // menyebutkannya begitu hasil menjadi stabil; mengulangnya di label
        // membuat pengguna TalkBack mendengar angka yang sama dua kali, dari
        // dua suara berbeda, seringkali bertumpuk. Terbukti di Galaxy M32.
        //
        // Pembagiannya: TalkBack mengurus NAVIGASI (ini tombol apa), audio
        // kita mengurus HASIL (berapa nominalnya).
        return 'Uang terdeteksi. Lanjut ke kalkulator.';
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
        // Sama seperti Fase 1: nominal kembalian sudah diucapkan audio kita.
        return 'Kembalian cocok. Selesaikan transaksi.';
      }
      if (hasil?.status === 'abstain') {
        return 'Belum yakin dengan kembaliannya. Coba pindai lagi.';
      }
      return 'Arahkan kamera ke uang kembalian.';

    case 'SELESAI':
      return 'Transaksi selesai. Kembali ke mode siaga.';
  }
}
