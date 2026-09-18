# Aturan Main Tim & Agen AI

Status: **aktif** · Berlaku untuk manusia maupun agen AI

---

## Masalah yang sedang kita hindari

Dua orang menulis kode di repo yang sama, pada saat yang sama, masing-masing
dibantu agen AI dengan alur kerja berbeda. Agen AI punya satu kebiasaan yang
sangat berbahaya dalam situasi ini: **ia gemar merapikan.** Diminta menambah
satu fitur, ia ikut menata ulang impor, mengganti nama variabel, dan
"memperbaiki" file di sebelahnya.

Pada proyek biasa itu tidak apa-apa. Pada proyek dengan dua agen menulis
bersamaan, itu menghasilkan konflik merge yang membingungkan, di jam yang tidak
ada waktu untuk menyelesaikannya.

Seluruh aturan di bawah ini turun dari satu gagasan: **buat tabrakan menjadi
mustahil secara struktural, bukan mengandalkan kehati-hatian.**

## Pembagian wilayah

Pembagian tetap ada di **[`docs/EKSEKUSI.md`](EKSEKUSI.md)**, lengkap dengan
tugas per fase. Ringkasnya:

Diperbarui 18 September 2026: Fajar berfokus penuh pada training, Farrel
mengambil alih seluruh kode aplikasi.

| Folder | Pemilik |
| --- | --- |
| `src/contracts/` | **Farrel** (beku — ubah hanya setelah sepakat) |
| Seluruh `src/` lainnya | **Farrel** |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `capacitor.config.ts` | **Farrel** |
| `model/data.yaml`, `model/petakan_dataset.py`, `model/README.md` | **Farrel** |
| `model/` selebihnya (training, dataset, hasil) | **Fajar** |
| `docs/` | Siapa saja, umumkan lisan dulu |

**Aturannya satu kalimat: jangan menyunting berkas di folder orang lain.**
Kalau kamu butuh perubahan di sana, minta orangnya — dia duduk di sebelahmu.
Perlu sepuluh detik, dan menyelamatkan setengah jam penyelesaian konflik.

Kalau ada yang menyimpang dari pembagian ini untuk sementara (misalnya satu
orang menalangi pekerjaan yang lain karena terhambat), cukup sepakati lisan,
lalu tulis di pesan commit siapa yang mengerjakan apa.

## Untuk agen AI

Lima aturan ini penting. Yang pertama paling penting.

1. **Jangan pernah menyentuh berkas di luar folder yang diklaim.** Tidak untuk
   merapikan impor. Tidak untuk memperbaiki typo. Tidak untuk "sekalian".
   Kalau kamu melihat bug di folder orang lain, laporkan, jangan perbaiki.

2. **Butuh sesuatu yang belum ada? Jangan bangun sendiri.** Pakai tipe dari
   `src/contracts/`, lalu tulis mock lokal. Membangun versimu sendiri dari
   milik orang lain berarti nanti ada dua implementasi yang harus digabung.

3. **`src/contracts/` beku.** Perubahan hanya setelah disepakati lisan, dalam
   satu commit tersendiri. Lihat `docs/KONTRAK.md`.

4. **Menyimpang dari exsum berarti wajib menulis ADR** di `docs/perubahan/`.
   Bukan formalitas; panitia menilai ini. Lihat `docs/PERUBAHAN.md`.

5. **Jangan menambah dependensi tanpa memberi tahu.** `package.json` adalah
   satu-satunya berkas yang benar-benar dipakai bersama dan paling sering
   menimbulkan konflik.

## Git

Kita bekerja langsung di `main`. Tidak ada branch, tidak ada pull request.

Ini bukan praktik yang baik untuk proyek biasa, tapi tepat di sini: pemisahan
sudah dijamin oleh batas folder, sementara branch justru menunda penggabungan
sampai ke titik yang paling mahal. Yang kita butuhkan adalah integrasi
sesering mungkin, bukan seaman mungkin.

```bash
git pull --rebase        # WAJIB sebelum push, selalu
git add src/vision       # tambahkan folder kamu saja, jangan `git add .`
git commit -m "vision: voting temporal 3 dari 5 bingkai"
git push
```

- **Commit tiap 20 sampai 30 menit.** Commit besar menyembunyikan apa yang
  rusak dan kapan.
- **Selalu `git pull --rebase` sebelum push.** Merge commit di riwayat lomba
  tidak memberi manfaat apa pun.
- **Jangan `git add .`.** Perintah itu menyapu berkas orang lain yang kebetulan
  belum di-commit.
- **Awalan pesan commit dengan nama folder:** `vision:`, `core:`, `ui:`,
  `audio:`, `data:`, `docs:`. Dengan begitu `git log --oneline` langsung
  terbaca sebagai laporan kemajuan, dan ini berguna saat menyusun dokumentasi
  progres 24 jam.

## Titik sinkronisasi

Berhenti sejenak dan bicara pada jam-jam ini. Semuanya bertepatan dengan
gerbang periksa di `PLAN.md`.

| Jam | Yang dibahas |
| --- | --- |
| 0 | Sepakati `src/contracts/` bersama. **Belum boleh coding paralel sebelum ini beres.** |
| 2 | APK kosong sudah terpasang di HP? Kalau belum, semua orang pindah ke masalah itu. |
| 8 | Ketiga jalur bertemu. Cabut mock, pasang yang asli. |
| 12 | Gerbang cakupan. Jujur soal apa yang tidak akan selesai, lalu buang. |
| 19 | Pembekuan fitur. Setelah titik ini hanya perbaikan bug. |
| 22 | Gladi bersih. Tidak ada lagi yang menyentuh kode. |

## Kalau terjadi konflik merge

Kalau muncul konflik, itu tandanya ada aturan yang terlewat. Jangan langsung
menyelesaikan sendiri — tanya dulu siapa yang menyentuh berkas itu.

Pengecualian: `package.json` dan `pnpm-lock.yaml`. Keduanya memang dipakai
bersama; selesaikan dengan mempertahankan kedua sisi, lalu jalankan
`pnpm install` sekali lagi.

## Kalau salah satu terhambat

Yang paling tidak bergantung pada apa pun adalah `src/core/` dan `src/data/`:
logika murni, banyak tes, tidak butuh HP, model, maupun kamera. Kalau ada yang
menganggur karena menunggu sesuatu, di sinilah tempat paling aman untuk
membantu.

Yang paling **tidak** boleh dikerjakan bersamaan adalah `package.json` dan
`src/contracts/`. Keduanya menyentuh semua orang sekaligus.
