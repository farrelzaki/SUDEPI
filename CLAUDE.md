# SUDEPI — Panduan Agen & Kontributor

> Baca file ini dulu. Ia sengaja pendek dan bersifat penunjuk arah.
> Detail ada di `docs/`. Jangan salin isi `docs/` ke sini.

## Hubungan dengan AGENTS.md

Repo ini punya dua kumpulan aturan yang **saling melengkapi, bukan bersaing**:

| Berkas | Mengatur | Menjawab |
| --- | --- | --- |
| `AGENTS.md`, `TASK.md`, `PROJECT_STATE.md` | **Proses** | Bagaimana cara agen bekerja: checkpoint, persetujuan, pelaporan. |
| `CLAUDE.md`, `docs/` | **Sistem** | Apa yang dibangun: stack, kontrak, arsitektur, aksesibilitas. |

Keduanya berlaku sekaligus. Ikuti alur kerja `AGENTS.md` (mode `competition`:
Scope, Discovery, Analysis, Plan, Approval, baru menulis), **dan** patuhi
keputusan teknis di `docs/`. Kalau keduanya tampak bertentangan, itu tanda
salah satunya perlu diperbarui — berhenti dan tanya, jangan pilih sendiri.

## Apa ini

**SUDEPI (Suara Deteksi Rupiah)** — asisten transaksi tunai untuk tunanetra.
Android APK (Capacitor) yang **100% luring**: deteksi nominal Rupiah multi-lembar
lewat kamera, hitung kembalian, lalu verifikasi kembalian. Tidak ada server.
Tidak ada panggilan jaringan. Sama sekali.

Lomba: IT Competition Hackathon IFEST 2026 — tim **PenungguTokenReset** (IPB University).
Sumber kebutuhan: `docs/Exsum_IFEST2026_PenungguTokenReset.docx`.

## Peta dokumen

| Saya mau…                                        | Buka                    |
| ------------------------------------------------ | ----------------------- |
| **Tahu apa yang harus SAYA kerjakan sekarang**    | `docs/EKSEKUSI.md`      |
| Tahu stack, alasannya, dan jadwal 24 jam          | `docs/PLAN.md`          |
| Tahu bentuk arsitektur & alur data                | `docs/ARSITEKTUR.md`    |
| **Menulis kode yang menyentuh modul lain**        | `docs/KONTRAK.md`       |
| Tahu apa yang berubah dari proposal & kenapa      | `docs/PERUBAHAN.md`     |
| Tahu aturan main antar-anggota / antar-agen       | `docs/KOLABORASI.md`    |
| Menyentuh UI, gestur, warna, atau teks yang dibaca| `docs/AKSESIBILITAS.md` |
| Menyiapkan demo di depan juri                     | `docs/DEMO.md`          |
| Melihat capaian & bukti verifikasi (untuk juri)   | `docs/PROGRES.md`       |

## Empat aturan yang tidak boleh dilanggar

1. **Luring mutlak.** Dilarang `fetch`, `XMLHttpRequest`, CDN, Google Fonts,
   atau URL absolut ke host mana pun di kode produksi. Seluruh aset dibundel.
   Kriteria lulus: aplikasi berjalan penuh dengan HP dalam **mode pesawat**.
2. **Lebih baik diam daripada salah sebut.** Kalau keyakinan deteksi di bawah
   `AMBANG_KEYAKINAN` (0,70 sejak ADR-0010 — jangan tulis angkanya di tempat lain) atau
   hasil tidak stabil, sistem **wajib** abstain dan minta pindai ulang.
   Menebak nominal = kerugian uang nyata bagi pengguna. Ini bukan bug biasa.
3. **Tidak ada layar yang butuh mata.** Setiap aksi harus bisa diselesaikan
   tanpa melihat layar. Kalau sebuah fitur mengharuskan pengguna mencari tombol
   kecil, fitur itu salah rancang. Lihat `docs/AKSESIBILITAS.md`.
4. **`src/contracts/` itu beku.** Lihat bagian di bawah.

## Struktur kode

```
src/
  contracts/   Tipe & antarmuka lintas-modul. BEKU — lihat aturan di bawah.
  vision/      Kamera, worker ONNX, decode, NMS, confidence gating, voting.
  core/        State machine transaksi, kalkulator kembalian, presensi koin.
  audio/       Pemutar potongan suara, penyusun angka Indonesia.
  data/        Skema Dexie (IndexedDB), penyangga pemindaian, repositori.
  ui/          Komponen React, gestur, Merchant Display.
  platform/    Pembungkus Capacitor (haptik, senter, preferensi).
model/         data.yaml, skrip ekspor, dan penjaga urutan kelas.
docs/          Dokumentasi (lihat tabel di atas).
```

Modul berkomunikasi **hanya** lewat tipe di `src/contracts/`.
`ui/` tidak boleh mengimpor dari `vision/` secara langsung, dan sebaliknya.

## Aturan `src/contracts/`

**PENTING: jangan ubah file di `src/contracts/` tanpa kesepakatan lisan
dengan anggota lain lebih dulu.** Dua orang sedang menulis kode di sisi
berlawanan dari tipe-tipe itu secara bersamaan. Mengubahnya sepihak akan
mematahkan pekerjaan orang lain tanpa dia sadari.

Kalau memang harus berubah:
1. Sepakati dulu (chat/lisan).
2. Ubah dalam **satu commit tersendiri** yang hanya menyentuh `src/contracts/`.
3. Beri tahu, supaya yang lain `git pull --rebase` sebelum lanjut.

## Perintah

```bash
pnpm dev                 # dev server di browser desktop (pakai mock engine)
pnpm test                # Vitest — logika murni (NMS, kalkulator, FSM)
pnpm typecheck           # tsc --noEmit
pnpm build               # typecheck + bundel produksi ke dist/
pnpm cap:sync            # build + salin web ke proyek Android
pnpm cap:run             # pasang & jalankan di HP terhubung
```

**Kalau build Gradle gagal dengan `The filename, directory name, or volume
label syntax is incorrect`:** itu `android/local.properties` memakai separator
campur — Git Bash menghasilkan path setengah backslash setengah garis miring,
dan Gradle tidak bisa membacanya. Tulis ulang dengan garis miring maju semua:

```bash
printf 'sdk.dir=%s\n' "$(cygpath -m "$LOCALAPPDATA/Android/Sdk")" > android/local.properties
```

`android/` tidak masuk git, jadi setiap mesin akan menabrak ini sekali.

**Kalau Gradle gagal dengan `invalid source release: 21`:** itu Gradle berjalan
di atas JDK 17, sementara Capacitor 7 menargetkan JDK 21. JDK 21 hampir pasti
sudah ada, dibundel bersama Android Studio. Arahkan `JAVA_HOME` ke sana:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android; .\gradlew.bat assembleDebug
```

**Dan kalau `pnpm cap:run` gagal dengan `'gradlew' is not recognized`:** itu
Capacitor memanggil `gradlew` dengan gaya `cmd` sementara perintahnya dijalankan
dari Git Bash. Jalankan Gradle langsung lewat PowerShell seperti di atas, lalu
pasang sendiri:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Kalau `pnpm install` keluar dengan `ERR_PNPM_IGNORED_BUILDS`:** itu esbuild
yang butuh izin menjalankan postinstall-nya. Keputusannya sudah ditulis di
`pnpm-workspace.yaml`, tapi pnpm menyimpan status lama di
`node_modules/.modules.yaml`. Kosongkan larik `ignoredBuilds` di berkas itu,
lalu `pnpm install` lagi. Muncul lagi setelah `node_modules` dihapus total.

## Kebiasaan yang diharapkan

- **TypeScript `strict`.** Tanpa `any`. Tanpa `@ts-ignore`.
  Kalau tipenya sulit, kemungkinan besar rancangannya yang keliru.
- **Logika murni dipisah dari efek samping.** NMS, kalkulator kembalian, dan
  reducer state machine harus berupa fungsi murni yang bisa diuji tanpa DOM,
  tanpa kamera, tanpa IndexedDB. **Fungsi-fungsi inilah yang wajib punya tes.**
  Komponen React dan pembungkus Capacitor tidak perlu dites.
- **Commit kecil, sering.** Sekitar tiap 20–30 menit kerja. Selalu
  `git pull --rebase` sebelum `git push`.
- **Jangan menambah dependensi tanpa bilang-bilang.** `package.json` adalah
  satu-satunya file yang dipakai bersama dan paling gampang bentrok.
- **Angka Rupiah selalu bilangan bulat.** Tidak pernah `float`. Tidak ada sen.

## Versi yang dikunci

Jangan naikkan versi mayor di tengah lomba, sekalipun ada yang lebih baru.

Versi di bawah sudah **diverifikasi ke npm**, bukan dari ingatan.

| Paket                  | Versi  | Kenapa dikunci                                       |
| ---------------------- | ------ | ---------------------------------------------------- |
| `vite`                 | 7.3.6  | Vite 8 mengganti bundler ke Rolldown. Pemuatan `.wasm` ORT dan bundling Web Worker adalah jalur kritis kita; jalur Rollup sudah teruji untuk itu. |
| `typescript`           | 5.9.3  | TS 7 adalah kompilator native yang baru. Seluruh tooling kita dibangun terhadap 5.9. Alasan yang sama dengan Vite 7. |
| `@vitejs/plugin-react` | 5.2.0  | Versi 6 hanya menerima Vite 8.                       |
| `vitest`               | 4.1.11 | Pasangan Vite 7. Vitest 5 mengarah ke Vite 8.        |
| `@capacitor/*`         | 7.6.9  | Cap 8 memaksa edge-to-edge; merusak tata letak kamera layar penuh. Lihat ADR-0004. |
| `onnxruntime-web`      | 1.30.x | Perilaku WASM berubah antar minor; kalibrasi ambang terikat ke versi ini. |
| `tailwindcss`          | 4.3.x  | Pakai `@import "tailwindcss"` + `@theme` di CSS. **Tidak ada `tailwind.config.js`.** |
| `react`                | 19.3.x | —                                                    |
| `dexie`                | 4.4.x  | —                                                    |

## Kalau kamu agen AI

- Kerjakan hanya folder yang sedang **kamu klaim** di papan klaim
  `docs/KOLABORASI.md`. Jangan "sekalian merapikan" folder orang lain.
- Kalau butuh sesuatu dari modul lain yang belum ada, **jangan buat sendiri di
  folder kamu**. Pakai tipe dari `src/contracts/` dan tulis mock lokal.
- Setiap kali kamu menyimpang dari proposal (exsum), itu **wajib** dicatat
  sebagai ADR baru di `docs/perubahan/`. Lihat `docs/PERUBAHAN.md` untuk cara
  dan alasannya — panitia menilai ini.
