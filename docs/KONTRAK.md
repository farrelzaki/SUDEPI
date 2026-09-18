# Kontrak Antar-Modul

Status: **beku setelah disepakati** · Sumber kebenaran: `src/contracts/*.ts`

---

## Kenapa dokumen ini ada

Dua orang menulis kode di sisi berlawanan dari batas yang sama, pada waktu yang
sama, masing-masing dibantu agen AI. Satu-satunya cara itu bisa berjalan adalah
kalau **bentuk sambungannya disepakati sebelum isinya ditulis**.

Setelah kontrak disepakati, setiap orang bisa bekerja terhadap *tipe*, bukan
terhadap *kode orang lain*. Yang mengerjakan UI tidak perlu menunggu model
selesai, karena dia bisa memakai mock yang memenuhi antarmuka yang sama. Yang
mengerjakan deteksi tidak perlu tahu bentuk layarnya sama sekali.

Dokumen ini adalah penjelasannya. **Kodenya yang berlaku, bukan tulisan ini.**
Kalau keduanya berbeda, `src/contracts/*.ts` yang menang, dan dokumen ini yang
salah dan harus diperbaiki.

## Aturan perubahan

1. Ubah hanya setelah **disepakati lisan** dengan anggota yang terdampak.
2. Perubahan masuk dalam **satu commit yang hanya menyentuh `src/contracts/`**.
   Jangan campur dengan perubahan fitur. Commit itu harus bisa dibaca sekilas.
3. Umumkan setelah push, supaya yang lain `git pull --rebase` sebelum lanjut.
4. Menambah field opsional itu murah. Mengganti nama atau menghapus field itu
   mahal — di jam ke-15, hindari sama sekali kecuali terpaksa.

## Peta ketergantungan

```
                 ┌──────────────┐
                 │  contracts/  │   tidak mengimpor apa pun
                 └──────┬───────┘
        ┌───────────┬───┴────┬────────────┬──────────┐
        ▼           ▼        ▼            ▼          ▼
    vision/      core/    audio/       data/     platform/
        └───────────┴────────┴────────────┴──────────┘
                            ▲
                            │  hanya ui/ yang boleh mengimpor semuanya
                       ┌────┴────┐
                       │   ui/   │
                       └─────────┘
```

Arah panah tidak boleh dibalik. `vision/` tidak tahu `ui/` ada.
`core/` tidak tahu React ada. Kalau kamu tergoda melanggar ini, kemungkinan
besar yang kamu butuhkan adalah tipe baru di `contracts/`, bukan impor baru.

---

## 1. Domain uang — `contracts/uang.ts`

Model mengenali **8 kelas**: 7 pecahan kertas ditambah 1 kelas koin.

Tahun emisi **tidak** dipisahkan menjadi kelas berbeda. Uang TE 2016 dan
TE 2022 sama-sama masuk ke kelas nominal yang sama, karena sistem tidak pernah
mengucapkan tahun emisi kepada pengguna. Lihat ADR-0007. Koin hanya dideteksi
*keberadaannya*, tidak pernah nilainya.

```ts
export type Nominal = 1000 | 2000 | 5000 | 10000 | 20000 | 50000 | 100000;

/** Indeks keluaran model, 0..7. Dipetakan lewat tabel `denominasi`. */
export type KodeKelas = number;

export interface Denominasi {
  kodeKelas: KodeKelas;
  /** null hanya untuk kelas koin. */
  nominal: Nominal | null;
  koin: boolean;
}
```

**Nilai Rupiah selalu bilangan bulat.** Tidak ada sen, tidak ada `float`.
Perbandingan uang memakai `===`, bukan toleransi epsilon.

## 2. Penglihatan — `contracts/vision.ts`

```ts
/** Ternormalisasi 0..1 terhadap bingkai asli, bukan piksel. */
export interface Kotak { x: number; y: number; w: number; h: number }

export interface Deteksi {
  kodeKelas: KodeKelas;
  nominal: Nominal | null;
  koin: boolean;
  /** 0..1. Sudah dijamin >= AMBANG_KEYAKINAN saat sampai ke pemanggil. */
  skor: number;
  kotak: Kotak;
  /** IoU tertinggi terhadap kotak lain sebelum NMS. Untuk audit. */
  iouMaks: number;
}

export type StatusPindai =
  | 'tidak-ada-objek'   // bingkai kosong, belum perlu bicara
  | 'belum-stabil'      // ada deteksi, voting temporal belum lolos
  | 'stabil'            // boleh diucapkan
  | 'abstain';          // ada objek tapi tidak pernah lolos ambang

export interface HasilPindai {
  status: StatusPindai;
  /** Hanya berisi hasil final saat status === 'stabil'. Selain itu kosong. */
  deteksi: Deteksi[];
  /** Jumlah seluruh uang kertas, Rupiah. 0 kalau bukan 'stabil'. */
  totalKertas: number;
  adaKoin: boolean;
  latensiMs: number;
  fps: number;
  /** Kecerahan rata-rata 0..1. Dipakai untuk senter otomatis. */
  luma: number;
  senterAktif: boolean;
}
```

**Kontrak penting:** pemanggil **tidak pernah** perlu menyaring ulang.
Kalau `status === 'stabil'`, isi `deteksi` sudah lolos gating, NMS, dan voting
temporal. Kalau bukan `'stabil'`, `deteksi` kosong dan `totalKertas` bernilai 0.
Ini sengaja: supaya mustahil ada kode di `ui/` atau `core/` yang secara tidak
sengaja membaca hasil mentah dan menyebut nominal yang belum diyakini.

```ts
/** Lapisan terbawah: satu bingkai masuk, kotak keluar. Tanpa state. */
export interface MesinInferensi {
  siap(): Promise<void>;
  /** Sudah menerapkan NMS dan confidence gating. Belum voting temporal. */
  deteksi(bingkai: ImageBitmap): Promise<Deteksi[]>;
  tutup(): void;
}

/** Lapisan atas: mengelola kamera, laju bingkai, senter, dan voting temporal. */
export interface PemindaiKamera {
  mulai(fase: 1 | 4): Promise<void>;
  berhenti(): void;
  /** Mengembalikan fungsi untuk berhenti berlangganan. */
  langgan(pendengar: (hasil: HasilPindai) => void): () => void;
  setSenter(nyala: boolean): Promise<void>;
}
```

### Tetapan yang dipakai bersama

```ts
export const AMBANG_KEYAKINAN = 0.70; // dikalibrasi (ADR-0010)
export const AMBANG_IOU = 0.40;
export const VOTING_BUTUH = 3;   // dari
export const VOTING_DARI = 5;    // bingkai berurutan
export const UKURAN_MASUKAN = 320;
```

Angka-angka ini **hanya boleh hidup di sini**. Jangan pernah menulis nilai ambang
sebagai literal di tempat lain — saat kalibrasi, kita harus bisa
mengubahnya di satu tempat.

## 3. Transaksi — `contracts/transaksi.ts`

State machine ditulis sebagai **reducer murni**. Ia tidak menyentuh kamera,
suara, atau basis data. Ia mengembalikan state baru **dan daftar efek** yang
harus dijalankan pemanggil. Inilah yang membuatnya bisa diuji penuh dalam
milidetik.

```ts
export type Fase =
  | 'SIAGA'
  | 'PINDAI_BAYAR'        // Fase 1
  | 'KALKULATOR'          // Fase 2
  | 'LAYAR_KASIR'         // Fase 3 (opsional, bisa dilewati)
  | 'PINDAI_KEMBALIAN'    // Fase 4
  | 'SELESAI';

export interface StateTransaksi {
  fase: Fase;
  totalBelanja: number | null;
  uangDibayar: number | null;
  kembalianWajib: number | null;
  kembalianTerverifikasi: number | null;
  /** Selisih kembalian wajib dengan uang kertas terdeteksi. */
  nominalKoin: number | null;
  hasilPindaiTerakhir: HasilPindai | null;
  mulaiPadaMs: number;
  alasanAbstain: string | null;
}

export type Peristiwa =
  | { jenis: 'MULAI' }
  | { jenis: 'HASIL_PINDAI'; muatan: HasilPindai }
  | { jenis: 'KONFIRMASI' }            // ketuk ganda
  | { jenis: 'BATAL' }                 // escape hatch
  | { jenis: 'SET_BELANJA'; nilai: number }
  | { jenis: 'SET_BAYAR'; nilai: number }
  | { jenis: 'LEWATI_LAYAR_KASIR' }
  | { jenis: 'ULANGI_PINDAI' };

export type Efek =
  | { jenis: 'UCAP'; ucapan: Ucapan }
  | { jenis: 'GETAR'; pola: PolaGetar }
  | { jenis: 'MULAI_PINDAI'; fase: 1 | 4 }
  | { jenis: 'HENTIKAN_PINDAI' }
  | { jenis: 'SIMPAN_TRANSAKSI' };

export interface HasilReduksi {
  state: StateTransaksi;
  efek: Efek[];
}

/** Murni. Tanpa I/O, tanpa Date.now(), tanpa Math.random(). */
export function reduksi(state: StateTransaksi, peristiwa: Peristiwa): HasilReduksi;
```

**Peristiwa yang tidak sah pada suatu fase harus dikembalikan tanpa perubahan**,
bukan melempar error. Sistem yang dipakai tunanetra tidak boleh mati karena
ketukan tak terduga. Tapi setiap penolakan itu **wajib** punya tes.

Waktu masuk lewat `mulaiPadaMs` dan tidak pernah dibaca dari dalam reducer.
Kalau reducer memanggil `Date.now()`, tesnya jadi tidak deterministik.

## 4. Suara — `contracts/suara.ts`

```ts
export type Ucapan =
  | { jenis: 'rupiah'; nilai: number }
  | { jenis: 'frasa'; id: IdFrasa }
  | { jenis: 'urutan'; bagian: Ucapan[] };

export type IdFrasa =
  | 'arahkan_kamera'
  | 'belum_yakin_ulangi'
  | 'total_belanja'
  | 'uang_dibayar'
  | 'kembalian'
  | 'ditambah_koin'
  | 'uang_kurang'
  | 'transaksi_dibatalkan'
  | 'transaksi_selesai'
  | 'renggangkan_lembaran';

export interface Pengucap {
  siap(): Promise<void>;
  /** Selesai saat audio benar-benar habis diputar. */
  ucap(ucapan: Ucapan): Promise<void>;
  hentikan(): void;
  /** Audio ducking: turunkan suara lain selama sistem bicara. */
  redam(aktif: boolean): void;
}
```

Pemanggil **tidak pernah menyusun string Indonesia sendiri.** Selalu kirim
`{ jenis: 'rupiah', nilai: 115000 }`, biar `audio/angka.ts` yang mengubahnya
jadi "seratus lima belas ribu rupiah". Kalau susunan kalimat tersebar di
banyak modul, kita akan menemukan "satu ribu rupiah" di depan juri.

## 5. Platform — `contracts/platform.ts`

```ts
export type PolaGetar = 'ringan' | 'sedang' | 'berhasil' | 'gagal';

export interface Platform {
  getar(pola: PolaGetar): Promise<void>;
  setSenter(nyala: boolean): Promise<void>;
  bacaPengaturan(): Promise<Pengaturan>;
  tulisPengaturan(p: Partial<Pengaturan>): Promise<void>;
}
```

Seluruh pemanggilan Capacitor disembunyikan di balik antarmuka ini. Alasannya
praktis: `pnpm dev` di browser desktop tidak punya Capacitor, dan kita ingin
bisa mengembangkan sebagian besar aplikasi tanpa HP tertancap. Implementasi
`platform/mock.ts` cukup mencatat ke konsol.

## 6. Mock wajib

Setiap antarmuka di atas **harus** punya implementasi mock yang dikirim bersama
kontraknya. Ini bukan kemewahan — inilah yang memungkinkan kerja paralel.

| Antarmuka | Mock | Kegunaan |
| --- | --- | --- |
| `MesinInferensi` | `vision/mockMesin.ts` | Mengembalikan deteksi bersandar naskah, sehingga UI bisa dibangun sebelum model siap. |
| `PemindaiKamera` | `vision/mockPemindai.ts` | Memutar urutan `HasilPindai` bersandar waktu, termasuk kasus abstain. |
| `Pengucap` | `audio/mockPengucap.ts` | Mencatat ucapan ke konsol, tanpa audio. |
| `Platform` | `platform/mock.ts` | Tanpa Capacitor, untuk `pnpm dev` di desktop. |

Mock harus bisa mereproduksi **kasus buruk**, bukan cuma jalur bahagia:
abstain, uang kurang, tidak ada objek, koin saja tanpa uang kertas.
Kalau mock hanya memutar jalur bahagia, bug jalur buruk baru ketahuan jam 21.
