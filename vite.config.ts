import { fileURLToPath, URL } from 'node:url';
// defineConfig diambil dari 'vitest/config', bukan 'vite' — hanya versi ini
// yang mengenali kunci `test` di bawah.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    // Impor lintas-modul selalu '@/contracts', bukan '../../contracts'.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  // Wajib relatif. Capacitor menyajikan bundel dari skema lokal di dalam
  // WebView, bukan dari akar domain. Path absolut akan gagal dimuat di APK.
  base: './',

  build: {
    // Bobot ONNX dan audio sprite jauh melewati ambang inline bawaan. Meng-
    // inline-kannya jadi base64 akan membengkakkan bundel dan memperlambat
    // pemuatan. Nol berarti: selalu jadikan berkas terpisah.
    assetsInlineLimit: 0,
    target: 'es2022',
    sourcemap: true,
  },

  worker: {
    // Worker inferensi mengimpor onnxruntime-web sebagai modul ES.
    format: 'es',
  },

  server: {
    // Upaya mengaktifkan cross-origin isolation supaya WASM multithread hidup
    // saat `pnpm dev`. Di dalam WebView Capacitor ini kemungkinan besar TIDAK
    // berlaku — lihat ADR-0001. Target latensi kita sudah dirancang tercapai
    // tanpa multithread, jadi ini bonus, bukan syarat.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  test: {
    // Logika murni saja: NMS, kalkulator kembalian, reducer, penyusun angka.
    // Komponen React dan pembungkus Capacitor diperiksa manual lewat
    // docs/DEMO.md — lihat docs/PLAN.md bagian 6.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
