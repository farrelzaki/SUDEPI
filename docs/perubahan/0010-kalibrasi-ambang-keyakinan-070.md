# ADR-0010: Kalibrasi ambang keyakinan menjadi 0,70 untuk multi-uang dan koin

- **Status:** Diterima
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab II (Measurable / Indikator Keberhasilan), Bab III bagian 3.3, Lampiran 7 nomor 2

## Konteks

Executive Summary menetapkan ambang Confidence Gating sebesar **0,85** sebagai
saringan awal deteksi sebelum masuk ke NMS dan voting temporal.

Saat model asli diuji di Samsung Galaxy M32 dengan uang fisik sungguhan
(18 September 2026), ditemukan perilaku di lapangan:

1. **Uang tunggal (satu lembar):** Kamera berada pada jarak dekat (20–25 cm).
   Uang memenuhi ~70% bidang pandang, tekstur tajam, dan skor keyakinan mentah
   berada di rentang **0,88–0,95** — lolos ambang 0,85 dengan mudah.
2. **Multi-uang (>2 lembar) dan koin:**
   - Kamera harus ditarik mundur ke jarak 35–45 cm agar seluruh lembaran muat
     dalam bingkai.
   - Pada ruang masukan model $320 \times 320$, setiap lembar uang mengecil
     menjadi hanya ~20% luas kanvas, dan koin fisik ($15 \times 15$ mm) hanya
     menempati area $\approx 12 \times 12$ piksel.
   - Skor keyakinan alami untuk objek pada resolusi tersebut berada di kisaran
     **0,72–0,82** (koin $\sim 0,74$).
3. **Kegagalan berantai:**
   - Ambang 0,85 membuang uang lembar ke-2, ke-3, dan koin ke `ditolakGating`.
   - Sistem hanya mendeteksi 1 lembar uang yang paling tengah/jelas.
   - Deteksi objek pendamping yang berkedip di sekitar 0,85 membuat *temporal voting*
     gagal mengumpulkan 3 suara identik dari 5 bingkai (`VOTING_BUTUH = 3`).
   - Karena satu siklus inferensi di M32 memakan waktu ~820 ms, sistem terdiam
     selama 4–6 detik tanpa suara, tampak mengalami delay parah atau tidak membaca
     uang yang tersisa.

## Keputusan

Kami mengalibrasi `AMBANG_KEYAKINAN` di `src/contracts/vision.ts` dari **0,85 menjadi 0,70**.

```typescript
export const AMBANG_KEYAKINAN = 0.70;
```

Kalibrasi ini sudah direncanakan sejak awal di catatan `src/contracts/vision.ts`:
*"saat kalibrasi dengan uang lecek nanti, kita harus bisa mengubahnya di satu tempat."*

## Konsekuensi

**Menjadi lebih baik**

- **Multi-uang terbaca serempak:** Uang lembar ke-1, ke-2, dan ke-3 yang berada
  di skor 0,74–0,86 kini lolos gating bersamaan di setiap bingkai.
- **Presensi koin aktif:** Koin fisik di atas meja atau di samping uang kertas
  tidak lagi dibuang oleh gating, sehingga sistem berhasil mengumumkan "ditambah koin".
- **Kestabilan cepat tercapai:** Karena semua objek konsisten lolos di setiap bingkai,
  sidik jari temporal voting sepakat dalam 3 bingkai berturut-turut (~2,4 detik),
  menghilangkan jeda/delay panjang.
- **Keamanan false-positive tetap terjaga:** Ambang 0,70 (70% keyakinan) tetap
  merupakan angka yang tinggi, dan saringan temporal voting (3 dari 5 bingkai)
  tetap menyaring kilatan cahaya atau bayangan acak yang tidak konsisten.

**Kompromi yang diterima**

- Angka literal berbeda dari teks awal proposal (0,85). Namun ini merupakan
  penyesuaian empiris berbasis data uji fisik nyata, persis seperti yang
  diharapkan panitia melalui mekanisme ADR ini.

## Alternatif yang ditolak

1. **Menurunkan ke 0,50.** Terlalu longgar; meningkatkan risiko bayangan meja
   atau pola taplak meja dianggap sebagai uang pecahan kecil.
2. **Mempertahankan 0,85.** Membuat fitur deteksi banyak uang dan deteksi koin
   tidak berfungsi di perangkat nyata.
3. **Mengurangi syarat voting temporal (misal menjadi 1 bingkai).** Menghilangkan
   garansi zero false-positive yang dijanjikan sistem saat kamera berguncang.


## Amandemen — pengukuran di perangkat, 18 September 2026

Ditulis oleh Farrel setelah menjalankan build kalibrasi yang mencetak **skor
setiap kandidat**, termasuk yang ditolak gerbang. 223 bingkai terekam di
Samsung Galaxy M32 dengan model asli.

**Penurunan ke 0,70 tetap dipertahankan** — ia terbukti tidak memunculkan salah
sebut (kamera diarahkan ke telapak tangan, meja, dan kertas selama ~10 detik:
sistem diam atau berkata belum yakin), dan lembar tunggal yang sah memang
sering berada di 0,70–0,85 sehingga ambang 0,85 lama membuangnya.

**Tetapi tujuan utama ADR ini tidak tercapai, dan sebabnya bukan ambang.**

Dugaan semula: skor lembar kedua berada di 0,72–0,82 dan terbuang oleh ambang
0,85. Yang terukur berkata lain. Dari 223 bingkai, hanya 37 yang berisi lebih
dari satu kelas, dan polanya seragam:

| Isi bingkai | Skor tertinggi | Lolos gerbang |
| --- | --- | --- |
| rp10000 + rp50000 | 0,78 dan 0,37 | 1 |
| rp10000 + rp50000 | 0,82 dan 0,33 | 1 |
| rp10000 + rp5000 | 0,79 dan 0,31 | 1 |
| rp10000 + rp5000 | 0,62 dan 0,43 | 0 |
| rp5000 + rp1000 | 0,65 dan 0,42 | 0 |

Objek kedua **tidak pernah** mendekati ambang. Ia bertengger di **0,25–0,55**,
sementara objek dominan berada di 0,70–0,85. Jaraknya bukan beberapa perseratus
melainkan sekitar 0,30 — terlalu jauh untuk dijembatani kalibrasi ambang mana
pun yang masih layak disebut aman.

Yang lebih menentukan: kelas objek kedua sering **tidak cocok dengan uang yang
benar-benar ada di depan kamera**. Saat menguji Rp10.000 bersama Rp5.000, kelas
kedua yang muncul justru rp50000, rp1000, dan rp2000. Itu bukan lembar kedua
yang kurang yakin, melainkan tebakan yang meleset.

Menurunkan ambang sampai lembar kedua lolos berarti ambangnya harus turun ke
sekitar 0,40. Pada tingkat itu tebakan-tebakan meleset di atas ikut lolos, dan
sistem mulai menyebut uang yang tidak ada. Itu persis kegagalan yang paling
dilarang di SUDEPI.

### Kesimpulan

Multi-lembar adalah **masalah data latih, bukan masalah ambang**. Perilaku
"hanya objek dominan yang diyakini" adalah ciri khas model yang dilatih pada
citra berisi satu objek lalu dihadapkan pada citra berisi beberapa objek.

Tidak ada nilai `AMBANG_KEYAKINAN` yang bisa memperbaikinya. Yang dibutuhkan
adalah citra latih yang memang berisi beberapa lembar sekaligus.
