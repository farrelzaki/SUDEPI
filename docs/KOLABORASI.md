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

## Papan klaim

Sebelum mulai bekerja, tulis namamu di sini. Setelah selesai, kosongkan.
Ini satu-satunya berkas yang memang dimaksudkan untuk sering diubah bersama,
dan konfliknya sepele diselesaikan.

| Folder | Diklaim oleh | Sejak jam | Sedang mengerjakan |
| --- | --- | --- | --- |
| `src/contracts/` | — | — | *(bersama, saat awal saja)* |
| `src/vision/` | — | — | |
| `src/core/` | — | — | |
| `src/audio/` | — | — | |
| `src/data/` | — | — | |
| `src/ui/` | — | — | |
| `src/platform/` | — | — | |
| `model/` | — | — | |
| `docs/` | — | — | |

**Aturannya satu kalimat: jangan menyunting berkas di folder yang diklaim
orang lain.** Kalau kamu butuh perubahan di sana, minta orangnya. Perlu sepuluh
detik, dan menyelamatkan setengah jam penyelesaian konflik.

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

Pengecualian: `package.json`, `pnpm-lock.yaml`, dan papan klaim di atas.
Ketiganya memang dipakai bersama; selesaikan saja dengan mempertahankan kedua
sisi.

## Pembagian yang disarankan

Pembagian kami cair, jadi ini saran awal, bukan penugasan. Yang penting bukan
siapa mengerjakan apa, melainkan **tidak ada dua orang di satu folder pada
waktu yang sama.**

| Jalur | Folder | Sifat pekerjaan |
| --- | --- | --- |
| A — Penglihatan | `src/vision/`, `model/` | Banyak angka, perlu HP dan uang fisik untuk kalibrasi. |
| B — Inti | `src/core/`, `src/data/`, `src/audio/` | Logika murni, banyak tes, bisa dikerjakan tanpa HP. |
| C — Antarmuka | `src/ui/`, `src/platform/` | Visual dan taktil, perlu HP dan TalkBack untuk verifikasi. |

Jalur B adalah yang paling tidak bergantung pada apa pun. Kalau satu orang
terhambat, di sinilah tempat paling aman untuk membantu.
