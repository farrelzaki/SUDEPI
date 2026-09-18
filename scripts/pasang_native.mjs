/**
 * Memasang berkas Java milik kami ke dalam proyek Android.
 *
 * KENAPA SKRIP INI ADA. `android/` sengaja tidak masuk git — ia dihasilkan
 * Capacitor dan berisi ratusan berkas yang tidak pernah kami sentuh. Tetapi
 * plugin pengenalan suara kami adalah kode Java, dan kode itu harus hidup di
 * dalam proyek Android untuk bisa dikompilasi.
 *
 * Meletakkannya langsung di `android/` berarti ia lenyap setiap kali proyek
 * Android dibuat ulang, di mesin mana pun, tanpa peringatan apa pun. Karena
 * itu sumbernya tinggal di `native/` yang masuk git, dan skrip ini menyalinnya
 * ke tempatnya sebelum setiap build.
 *
 * Dijalankan otomatis oleh perintah `cap:sync`, `cap:run`, dan `cap:kalibrasi`.
 * Aman dijalankan berulang kali.
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = join(dirname(fileURLToPath(import.meta.url)), '..');
const sumber = join(akar, 'native', 'android');
const tujuanJava = join(akar, 'android', 'app', 'src', 'main', 'java', 'id', 'ac', 'ipb', 'sudepi');
const manifes = join(akar, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!existsSync(join(akar, 'android'))) {
  console.log('[native] folder android/ belum ada — dilewati.');
  process.exit(0);
}

/* ------------------------------------------------------------ berkas Java */

mkdirSync(tujuanJava, { recursive: true });
for (const berkas of ['PengenalSuara.java', 'MainActivity.java']) {
  copyFileSync(join(sumber, berkas), join(tujuanJava, berkas));
  console.log(`[native] ${berkas} dipasang`);
}

/* -------------------------------------------------------------- manifes */

let xml = readFileSync(manifes, 'utf8');
let berubah = false;

/**
 * Izin mikrofon.
 *
 * Tidak ditambahkan Capacitor karena tidak ada plugin npm yang memintanya —
 * plugin kami hidup di dalam aplikasi ini sendiri.
 */
if (!xml.includes('android.permission.RECORD_AUDIO')) {
  xml = xml.replace(
    '<uses-permission android:name="android.permission.VIBRATE" />',
    '<uses-permission android:name="android.permission.VIBRATE" />\n' +
      '\n' +
      '    <!-- Pengenalan suara luring. Audio TIDAK PERNAH meninggalkan perangkat;\n' +
      '         lihat native/android/PengenalSuara.java dan ADR-0013. -->\n' +
      '    <uses-permission android:name="android.permission.RECORD_AUDIO" />',
  );
  berubah = true;
}

/**
 * Deklarasi `queries`.
 *
 * Sejak Android 11, sebuah aplikasi tidak bisa MELIHAT layanan milik aplikasi
 * lain kecuali menyatakannya lebih dulu di sini. Tanpa blok ini,
 * `SpeechRecognizer.isRecognitionAvailable` mengembalikan false di perangkat
 * yang sebenarnya mampu — kegagalan yang sangat membingungkan, karena
 * mesinnya ada dan izinnya lengkap.
 */
if (!xml.includes('android.speech.RecognitionService')) {
  xml = xml.replace(
    '</manifest>',
    '    <queries>\n' +
      '        <intent>\n' +
      '            <action android:name="android.speech.RecognitionService" />\n' +
      '        </intent>\n' +
      '    </queries>\n' +
      '</manifest>',
  );
  berubah = true;
}

if (berubah) {
  writeFileSync(manifes, xml, 'utf8');
  console.log('[native] AndroidManifest.xml diperbarui');
} else {
  console.log('[native] AndroidManifest.xml sudah sesuai');
}
