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
