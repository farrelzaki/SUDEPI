import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.ac.ipb.sudepi',
  appName: 'SUDEPI',
  webDir: 'dist',

  android: {
    // Tidak ada konten campuran: seluruh aset berasal dari bundel lokal.
    // Kalau suatu saat ini perlu dinyalakan, berarti ada yang menyelundupkan
    // panggilan jaringan ke dalam aplikasi luring.
    allowMixedContent: false,
    // Menjaga pratinjau kamera tetap mulus pada perangkat kelas bawah.
    webContentsDebuggingEnabled: true,
  },

  server: {
    // https, bukan http. WebView memperlakukan http sebagai origin tidak aman,
    // dan getUserMedia menolak berjalan di origin tidak aman — kamera kita
    // langsung mati tanpa pesan yang jelas.
    androidScheme: 'https',
  },

  plugins: {
    SplashScreen: {
      // Nol detik. Aplikasi ini harus langsung siap memindai begitu dibuka;
      // layar pembuka hanya menambah waktu tunggu bagi orang yang bahkan tidak
      // bisa melihatnya.
      launchShowDuration: 0,
    },
  },
};

export default config;
