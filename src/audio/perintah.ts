/**
 * Pengenal perintah suara untuk navigasi transaksi SUDEPI.
 *
 * Fungsi murni tanpa efek samping: menerima teks hasil pengenalan ucapan
 * (larik kemungkinan teks dari speech recognizer) dan fase aktif,
 * lalu mengembalikan jenis tindakan navigasi yang dimaksud pengguna.
 */

import type { Fase } from '@/contracts';
import { uraiNominalWajar } from './urai';

export type TindakanNavigasi =
  | { readonly jenis: 'MULAI_TRANSAKSI' }
  | { readonly jenis: 'LANJUTKAN' }
  | { readonly jenis: 'PERIKSA_KEMBALIAN' }
  | { readonly jenis: 'SELESAIKAN_TRANSAKSI' }
  | { readonly jenis: 'SELESAI' }
  | { readonly jenis: 'PINDAI_ULANG' }
  | { readonly jenis: 'BATAL' }
  | { readonly jenis: 'NOMINAL'; readonly nilai: number }
  | null;

export function uraiPerintahNavigasi(
  kemungkinan: readonly string[],
  fase: Fase,
): TindakanNavigasi {
  for (const teks of kemungkinan) {
    const t = teks.toLowerCase().trim();
    if (!t) continue;

    // 1. Perintah Batal Global (berlaku di semua fase kecuali SIAGA)
    if (
      t.includes('batal') ||
      t.includes('cancel') ||
      t.includes('ulang dari awal')
    ) {
      if (fase !== 'SIAGA') {
        return { jenis: 'BATAL' };
      }
    }

    // 2. Perintah Berdasarkan Fase
    switch (fase) {
      case 'SIAGA': {
        if (
          t.includes('mulai') ||
          t.includes('transaksi') ||
          t.includes('belanja') ||
          t.includes('hitung') ||
          t.includes('bayar') ||
          t.includes('buka')
        ) {
          return { jenis: 'MULAI_TRANSAKSI' };
        }
        if (
          t.includes('pindai') ||
          t.includes('scan') ||
          t.includes('foto') ||
          t.includes('baca')
        ) {
          return { jenis: 'PINDAI_ULANG' };
        }
        break;
      }

      case 'KALKULATOR': {
        // Cek apakah berupa perintah navigasi maju
        if (
          t === 'lanjut' ||
          t.includes('lanjutkan') ||
          t.includes('berikutnya') ||
          t.includes('ke kasir') ||
          t.includes('kasir') ||
          t.includes('pedagang') ||
          t.includes('tunjukkan') ||
          t === 'oke' ||
          t === 'ok' ||
          t === 'siap' ||
          t === 'sudah' ||
          t === 'pas'
        ) {
          return { jenis: 'LANJUTKAN' };
        }

        // Cek apakah berupa ucapan nominal angka
        const nominal = uraiNominalWajar(t);
        if (nominal !== null) {
          return { jenis: 'NOMINAL', nilai: nominal };
        }
        break;
      }

      case 'LAYAR_KASIR': {
        if (
          t.includes('kembalian') ||
          t.includes('periksa') ||
          t.includes('cek') ||
          t.includes('lanjut') ||
          t.includes('oke') ||
          t.includes('ok') ||
          t.includes('siap') ||
          t.includes('tunjukkan')
        ) {
          return { jenis: 'PERIKSA_KEMBALIAN' };
        }
        break;
      }

      case 'PINDAI_KEMBALIAN': {
        if (
          t.includes('selesai') ||
          t.includes('beres') ||
          t.includes('pas') ||
          t.includes('cocok') ||
          t.includes('sudah') ||
          t.includes('terima') ||
          t.includes('tutup') ||
          t === 'oke' ||
          t === 'ok'
        ) {
          return { jenis: 'SELESAIKAN_TRANSAKSI' };
        }
        if (
          t.includes('pindai') ||
          t.includes('scan') ||
          t.includes('ulang') ||
          t.includes('foto')
        ) {
          return { jenis: 'PINDAI_ULANG' };
        }
        break;
      }

      case 'SELESAI': {
        if (
          t.includes('selesai') ||
          t.includes('kembali') ||
          t.includes('beranda') ||
          t.includes('awal') ||
          t.includes('tutup') ||
          t.includes('keluar') ||
          t.includes('oke') ||
          t.includes('ok')
        ) {
          return { jenis: 'SELESAI' };
        }
        break;
      }

      case 'PINDAI_BAYAR':
        break;
    }
  }

  return null;
}
