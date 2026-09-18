/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' hanya pada build mode kalibrasi. Lihat `.env.kalibrasi`. */
  readonly VITE_METRIK?: string;
  /**
   * Kunci Gemini untuk Rencana B, disuntikkan dari `.env.local`.
   *
   * Kosong pada build biasa, dan fitur daring mati sendiri kalau kosong —
   * bukan gagal saat dipakai.
   */
  readonly VITE_KUNCI_GEMINI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
