/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' hanya pada build mode kalibrasi. Lihat `.env.kalibrasi`. */
  readonly VITE_METRIK?: string;
  /**
   * Kunci API model deteksi daring, disuntikkan dari `.env.local`.
   *
   * Kosong pada build biasa, dan fitur daring mati sendiri kalau kosong —
   * bukan gagal saat dipakai.
   */
  readonly VITE_KUNCI_DARING?: string;
  readonly VITE_KUNCI_MODEL_ONLINE?: string;
  readonly VITE_KUNCI_GEMINI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
