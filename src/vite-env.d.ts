/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' hanya pada build mode kalibrasi. Lihat `.env.kalibrasi`. */
  readonly VITE_METRIK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
