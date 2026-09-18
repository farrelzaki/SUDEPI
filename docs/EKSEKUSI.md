# Rencana Eksekusi — Terbagi per Orang

Status: **aktif** · Dua pelaksana: **Farrel** dan **Fajar** · Duduk bersebelahan

> Cari namamu, kerjakan blokmu saja. Tiap blok sudah lengkap dengan perintah
> git-nya, jadi bisa langsung disodorkan ke agen AI masing-masing.
>
> **Jangan mengerjakan blok orang lain**, walaupun terlihat mudah atau agenmu
> menawarkan diri. Itu sumber konflik merge nomor satu.

---

> ## ⚠ PEMBAGIAN BERUBAH — 18 September 2026
>
> **Fajar sekarang HANYA memegang `model/`** dan berfokus penuh pada dataset
> serta training. Seluruh kode aplikasi diambil alih Farrel.
>
> **Untuk agen AI Fajar:** jangan menulis apa pun di `src/`. Kalau kamu sudah
> terlanjur menulis di `src/ui/`, `src/platform/`, atau `src/audio/`, **jangan
> di-push** — bilang ke Farrel lebih dulu, karena dia sedang mengerjakan folder
> yang sama dan pekerjaannya akan bertabrakan.

## Pembagian wilayah

| | **Farrel** | **Fajar** |
| --- | --- | --- |
| Folder | seluruh `src/` | `model/` |
| Berkas akar | semua | — |
| Fokus | Membangun aplikasinya | Dataset, training, ekspor ONNX, kuantisasi |
| Keluaran yang ditunggu pihak lain | — | **`public/model/sudepi.onnx`** |

Pembagian ini menyimpang dari Lampiran 9, dan itu wajar: peran di proposal
adalah rencana, sedangkan ini kenyataan pada jam ke-sekian. Yang menentukan
bukan siapa tertulis apa, melainkan **model belum ada dan itu jalur kritis**.
Satu orang fokus penuh ke sana lebih cepat daripada dua orang setengah-setengah.

**Yang tetap hanya boleh disentuh Farrel**, walaupun pembagian berubah lagi
nanti:

| Berkas | Aturan |
| --- | --- |
| `src/contracts/` | Beku. Ubah hanya setelah sepakat lisan, dalam commit tersendiri. |
| `package.json` | Butuh dependensi baru? Minta ke Farrel, jangan tambah sendiri. |
| `docs/` | Siapa saja boleh, tapi umumkan lisan dulu. |

Karena kalian duduk bersebelahan, "umumkan lisan" benar-benar cukup. Tidak
perlu isu, tidak perlu pesan, cukup menoleh.

### Kalau training sudah selesai

Serahkan `public/model/sudepi.onnx` ke Farrel, lalu **tanya dulu** bagian mana
yang aman diambil sebelum menyentuh `src/`. Jangan menebak — saat itu sebagian
besar folder sudah terisi.

---

## Ritual git

Sama untuk kalian berdua. Hafalkan tiga pola ini.

**Mulai bekerja, atau kapan pun ragu:**

```bash
git pull --rebase
```

**Selesai satu potong kerja (tiap 20–30 menit):**

```bash
git add src/<folder-kamu>        # JANGAN `git add .`
git commit -m "<folder>: <apa yang berubah>"
git pull --rebase
git push
```

**Perlu menarik pekerjaan teman padahal punyamu belum selesai:**

```bash
git stash push -u -m "wip: <apa yang sedang dikerjakan>"
git pull --rebase
git stash pop
```

`-u` penting: tanpa itu, berkas baru yang belum di-track tidak ikut tersimpan
dan bisa mengacaukan hasil `pop`.

**Kalau `git stash pop` menabrak konflik:** jangan panik dan jangan
`git checkout` apa pun. Isi stash masih aman di `git stash list`. Panggil orang
yang menyentuh berkas itu — dia duduk di sebelahmu.

Awalan pesan commit pakai nama folder (`vision:`, `ui:`, `core:`, `audio:`,
`platform:`, `data:`, `docs:`). Dengan begitu `git log --oneline` langsung
terbaca sebagai laporan progres 24 jam, dan itu berguna untuk dokumentasi juri.

---

# FASE 0 — Bootstrap (± 45 menit)

**Ini satu-satunya fase yang TIDAK paralel.** Scaffold menyentuh akar repo, jadi
harus dikerjakan satu orang. Fajar punya pekerjaan sendiri yang tidak menyentuh
repo, jadi tidak ada waktu terbuang.

## FASE 0 — FARREL

Kerjakan berurutan. Jangan lompat.

```bash
git pull --rebase
```

1. Hapus sisa scaffold: `git rm backend/tes frontend/tes`
2. Tulis berkas konfigurasi akar:
   - `package.json` — **semua** dependensi sekaligus, termasuk milik Fajar
     (Capacitor, plugin haptik, preferences). Ini disengaja: supaya setelah
     ini tidak ada lagi yang perlu menyentuh `package.json`.
   - `tsconfig.json` (`strict: true`), `tsconfig.node.json`
   - `vite.config.ts` — sekalian konfigurasi Vitest di dalamnya
   - `index.html`
   - perbarui `.gitignore`: `node_modules`, `dist`, `android/`, `*.local`
3. `pnpm install`
4. Tulis `src/contracts/` — **ini inti Fase 0**, Fajar menunggu berkas ini:
   `uang.ts`, `vision.ts`, `transaksi.ts`, `suara.ts`, `platform.ts`, `index.ts`
   Sumbernya `docs/KONTRAK.md`, turunkan apa adanya.
5. Tulis mock supaya Fajar bisa bekerja tanpa model:
   `src/vision/mockMesin.ts`, `src/vision/mockPemindai.ts`
   Mock **wajib** bisa memutar kasus buruk: abstain, tidak ada objek, koin saja.
6. Kerangka kosong: `src/core/`, `src/data/`, `src/ui/`, `src/audio/`,
   `src/platform/`, `model/` (isi `.gitkeep`)
7. `src/main.tsx`, `src/App.tsx` (sementara: layar tanda "scaffold hidup"),
   `src/index.css` (`@import "tailwindcss"` + token `@theme`)
8. Verifikasi: `npx tsc --noEmit` → `pnpm test` → `pnpm build`

```bash
git add -A
git commit -m "chore: scaffold Vite 7 + React 19 + TS strict, kontrak, dan mock"
git pull --rebase
git push
```

**Lalu bilang ke Fajar: "udah di-push, pull sekarang."**

## FASE 0 — FAJAR

Selama Farrel scaffold, kerjakan ini. Tidak satu pun menyentuh repo, jadi aman.

1. **Siapkan HP Android** — nyalakan Opsi Pengembang, aktifkan USB debugging,
   colok ke laptop, setujui dialog RSA. Verifikasi:
   ```bash
   adb devices     # harus muncul satu perangkat, bukan daftar kosong
   ```
   *Ini blocker paling mungkin memakan waktu. Kerjakan paling awal.*
2. **Set environment variable** (permanen, lewat System Properties Windows):
   - `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
   - `ANDROID_SDK_ROOT` = nilai yang sama
   - Tambahkan `%LOCALAPPDATA%\Android\Sdk\platform-tools` ke `Path`
3. **Render klip audio** untuk sprite (ADR-0003). Sekitar 40 klip, suara
   Indonesia, simpan sebagai berkas terpisah dulu:
   ```
   nol, satu … sembilan, sepuluh, sebelas, belas, puluh,
   seratus, ratus, seribu, ribu, juta, rupiah
   + frasa sistem sesuai IdFrasa di docs/KONTRAK.md bagian 4
   ```
4. **Nyalakan TalkBack** di HP dan pakai sebentar. Kalau belum pernah,
   biasakan sekarang — nanti kamu mengembangkan UI dengan ini menyala terus.

Setelah Farrel bilang sudah push:

```bash
git pull --rebase
pnpm install
pnpm dev        # pastikan layar tanda muncul di browser
```

---

# FASE 1 — Paralel pertama (jam 2–8)

Mulai dari sini kalian benar-benar jalan bersamaan.

## FASE 1 — FARREL

Target: **AI mendeteksi uang sungguhan, dan kalkulator kembalian lulus tes.**

`src/vision/`
- Pemindai kamera: `getUserMedia`, laju adaptif 5–10 fps, hitung `luma`
- Web Worker + sesi ONNX Runtime Web (WASM)
- Decode keluaran `[1, 12, 2100]`, balikkan letterbox ke koordinat asli
- `nms.ts` — NMS class-agnostic IoU 0,40 + gating 0,85, **fungsi murni**
- Voting temporal 3 dari 5 bingkai
- Tampilkan latensi & fps di layar sementara, supaya terukur

`src/core/`
- `mesin.ts` — reducer murni + `Efek[]`, sesuai diagram `docs/ARSITEKTUR.md`
- `kembalian.ts` — kalkulator, tolak bayar < belanja
- `koin.ts` — turunkan nominal koin dari selisih, abstain kalau selisih ≥ 1.000

Tes wajib: `nms.ts`, `kembalian.ts`, `koin.ts`, `mesin.ts` (termasuk transisi
**tidak sah** yang harus ditolak).

```bash
git add src/vision src/core
git commit -m "vision: pipeline deteksi + NMS; core: FSM dan kalkulator"
git pull --rebase && git push
```

## FASE 1 — FAJAR

Target: **APK terpasang di HP, dan UI bisa dijalankan pakai mock Farrel.**

**Nyalakan training LEBIH DULU, sebelum apa pun.** Ia berjalan 30–45 menit di
GPU Colab tanpa perlu ditunggui, jadi setiap menit penundaan adalah menit yang
hilang percuma. Baru setelah itu kerjakan Capacitor selagi GPU bekerja.

Nomor 1 dan 2 sama-sama butuh internet, sementara demo nanti berjalan dalam
mode pesawat. Selesaikan keduanya selagi jaringan masih ada.

0. **Training model — JALUR KRITIS PROYEK**
   Baca `model/README.md`, ikuti langkahnya. Ringkasnya: unduh dataset Rupiah
   publik dari Roboflow, petakan ke 8 kelas sesuai `src/contracts/uang.ts`,
   latih YOLOv8n `imgsz=320` di Colab T4, ekspor `nms=False`, kuantisasi INT8
   dengan gerbang mutu mAP.
   **Periksa ulang urutan kelas di `data.yaml` sebelum menekan train.** Kalau
   bergeser satu saja, sistem menyebut nominal yang salah dengan penuh
   keyakinan, dan tidak ada tes yang bisa menangkapnya.

1. **Capacitor + APK pertama**
   ```bash
   npx cap init SUDEPI id.ac.ipb.sudepi --web-dir=dist
   pnpm build
   npx cap add android
   npx cap run android        # harus terpasang dan terbuka di HP
   ```
   Berhasil? **Bilang ke Farrel dan Farrel.** Ini gerbang jam 2 di `PLAN.md`.

2. `src/platform/` — pembungkus Capacitor di balik antarmuka `Platform`:
   haptik, senter, preferensi. Plus `platform/mock.ts` untuk `pnpm dev`
   di desktop tanpa HP.
   Senter **tanpa plugin**:
   ```ts
   track.applyConstraints({ advanced: [{ torch: true }] })
   ```

3. `src/ui/` — kerangka layar, pakai `mockPemindai` dari Farrel:
   - Pola dua tombol dari `docs/AKSESIBILITAS.md`: tindakan utama 75% tinggi,
     "Batalkan" 25% di bawah, posisi tetap di semua fase
   - Semua `<button>` semantik. **Jangan pernah penangan sentuh di `<div>`**
   - `aria-label` menjawab dua hal: keadaan sekarang, dan akibat ketuk ganda
   - Panduan Sonar Aiming

4. `src/audio/` — `angka.ts` (penyusun bilangan Indonesia), pemutar sprite
   Web Audio + `GainNode` untuk ducking, `mockPengucap.ts`

Tes wajib: `angka.ts`. Kasus jebakan: 1.000 → "seribu" bukan "satu ribu";
100.000 → "seratus ribu"; 11.000 → "sebelas ribu"; 115.000; dan 0.

```bash
git add src/ui src/platform src/audio capacitor.config.ts
git commit -m "ui: kerangka dua tombol; platform: Capacitor; audio: sprite"
git pull --rebase && git push
```

---

# FASE 2 — Integrasi (jam 8–14)

**Sinkron lisan dulu sebelum mulai.** Ini fase paling rawan tabrakan karena
kalian menyambungkan dua sisi.

| Farrel | Fajar |
| --- | --- |
| Sambungkan pemindai asli, cabut `mockPemindai` | Sambungkan `Pengucap` asli, cabut `mockPengucap` |
| Jalankan `Efek[]` dari reducer ke dunia nyata | Haptik dan senter otomatis hidup dari `luma` |
| Persistensi Dexie — buffer di memori, tulis saat fase berakhir | Audio ducking saat sistem bicara |

Target akhir fase: **Fase 1 → Fase 2 tersambung utuh dengan uang sungguhan.**

Commit lebih sering di fase ini — tiap 15 menit. Kalian menyentuh berkas yang
saling memanggil, jadi integrasi kecil-kecil jauh lebih murah.

---

# FASE 3 — Fitur pembeda (jam 14–19)

| Farrel | Fajar |
| --- | --- |
| Fase 4: pindai kembalian + presensi koin | Merchant Display 72 pt, kontras 7:1, orientasi dikunci |
| Kalibrasi ambang pakai uang lecek sungguhan | Escape-Hatch: tombol permanen + gestur tahan (ADR-0006) |
| Selesaikan skema 8 store Dexie | Uji TalkBack menyeluruh |

**Kalibrasi ambang butuh kalian berdua**: Farrel menyetel angkanya, Fajar
menyodorkan uang dalam berbagai kondisi. Sisihkan waktu bersama untuk ini.

---

# FASE 4 — Pengerasan (jam 19–22)

**Pembekuan fitur. Setelah titik ini hanya perbaikan bug.**

| Farrel | Fajar |
| --- | --- |
| Perbaikan bug logika | APK rilis, pasang di **dua** HP |
| Pastikan tidak ada `fetch` atau URL luar di `dist/` | **Uji mode pesawat** — seluruh skenario `docs/DEMO.md` |
| Perbarui `PROJECT_STATE.md` dan `TASK.md` | Uji di HP RAM rendah |

Uji mode pesawat dilakukan di sini, bukan jam 23. Kalau baru ketahuan gagal
saat gladi bersih, tidak ada waktu memperbaikinya.

---

# FASE 5 — Gladi bersih (jam 22–24)

Kalian berdua. Jalankan naskah `docs/DEMO.md` **tiga kali berturut-turut tanpa
satu pun kegagalan**, di HP utama, dalam mode pesawat. Satu gagal berarti
perbaiki lalu ulangi ketiganya dari awal.

Tidak ada lagi yang menyentuh kode setelah jam 22.

---

## Gerbang periksa

Berhenti dan bicara di titik-titik ini. Sengaja dibuat tidak nyaman, karena
keputusan memotong cakupan jauh lebih murah diambil lebih awal.

| Jam | Pertanyaan | Kalau jawabannya "belum" |
| --- | --- | --- |
| 2 | APK sudah terpasang di HP? | **Semua** berhenti, keroyok masalah ini. Tidak ada yang berarti tanpa APK. |
| 12 | Deteksi asli sudah tersambung ke UI? | Buang Fase 3 (Merchant Display) dan Dexie. Selamatkan alur 1 → 2 → 4. |
| 19 | Masih ada fitur belum jadi? | Hapus dari demo. Jangan ditambal. Fitur setengah jadi yang gagal di depan juri lebih merugikan daripada fitur yang memang tidak ada. |

## Aturan dokumen

Berlaku untuk kalian berdua, sepanjang 24 jam:

- Menemukan kenyataan berbeda dari yang tertulis di `docs/`? **Perbaiki saat
  itu juga**, jangan dikumpulkan jadi "task rapikan dokumen" nanti.
- Menyimpang dari executive summary? **Wajib** tulis ADR baru di
  `docs/perubahan/`. Panitia menilai ini, dan ADR ditulis paling jujur saat
  keputusannya masih hangat.
