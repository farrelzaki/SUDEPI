# ADR-0004: Kunci Capacitor di versi 7, jangan pakai 8

- **Status:** Diterima, dengan amandemen 2026-09-18
- **Tanggal:** 2026-09-18
- **Rujukan exsum:** Bab III bagian 3.3 (Wadah Native) — tidak menyebut versi

## Amandemen 2026-09-18

Saat verifikasi lingkungan, ditemukan bahwa **alasan kedua di bawah ("syarat
perkakas") tidak berlaku pada mesin pengembangan kami.** Android Studio yang
terpasang adalah build `AI-252.28238.7.2523.14688667`, yaitu seri 2025.2
(Otter), sehingga syarat Capacitor 8 sebenarnya sudah terpenuhi.

Keputusannya **tidak berubah**, karena alasan pertama (edge-to-edge otomatis)
tetap berlaku sepenuhnya dan merupakan pertimbangan utama. Ditambah satu alasan
baru yang ditemukan belakangan: **Capacitor 7.6.9 adalah versi yang kompatibel
dengan `@capacitor-community/speech-recognition` 7.0.1** yang kami butuhkan
untuk ADR-0005.

Catatan ini ditulis terpisah dan tidak menyunting teks asli, sesuai aturan di
`docs/PERUBAHAN.md`: ADR yang sudah diterima tidak pernah diubah diam-diam.
Perbedaan antara apa yang kami yakini saat memutuskan dan apa yang kemudian
terbukti adalah bagian dari catatan itu sendiri.

## Konteks

Capacitor 8 adalah versi terbaru saat lomba berlangsung. Dua hal membuatnya
tidak cocok untuk dipakai di sini.

**Pertama, edge-to-edge otomatis.** Capacitor 8 memperkenalkan plugin internal
SystemBars yang mengatur tampilan dan *inset* status bar serta navigation bar
secara otomatis. Untuk aplikasi biasa ini kemudahan. Untuk SUDEPI ini masalah:
seluruh antarmuka kami adalah **pratinjau kamera layar penuh dengan satu target
sentuh sebesar layar** di atasnya. Perubahan perilaku inset menyentuh tepat
bagian yang paling sensitif terhadap tata letak, dan kesalahannya muncul
sebagai area sentuh yang bergeser — persis jenis bug yang paling sulit
disadari oleh tim yang mengujinya dengan mata.

**Kedua, syarat perkakas.** Capacitor 8 mensyaratkan Android Studio Otter
(2025.2.1) atau lebih baru. Bila salah satu laptop tim memakai versi lebih
lama, build akan gagal di jam pertama, dan memperbarui Android Studio di lokasi
lomba berarti mengunduh beberapa gigabyte lewat jaringan bersama.

> **Dikoreksi:** alasan ini terbukti tidak berlaku. Lihat Amandemen di atas.

Capacitor 7.6.x sudah matang, dan sebagai keuntungan tambahan, jauh lebih
banyak terwakili di dalam contoh kode dan dokumentasi yang menjadi acuan agen
AI. Karena dua anggota tim bekerja dibantu agen AI, selisih ini nyata: versi
yang lebih lazim menghasilkan kode yang lebih jarang salah.

## Keputusan

Kami mengunci `@capacitor/core`, `@capacitor/android`, dan seluruh plugin
resmi di **7.6.x**, dengan versi pasti di `package.json`, tanpa awalan `^`.

Kami juga menahan jumlah plugin seminimal mungkin. Setiap plugin native adalah
satu kemungkinan kegagalan Gradle tambahan di tengah lomba. Yang dipakai hanya:

| Plugin | Alasan |
| --- | --- |
| `@capacitor/haptics` | Tidak ada padanan web yang andal di WebView. |
| `@capacitor/preferences` | Penyimpanan preferensi yang bertahan antar pembaruan. |

Kamera dan senter **tidak** memakai plugin. Keduanya diambil langsung dari
`getUserMedia` dan `MediaStreamTrack.applyConstraints({ advanced: [{ torch: true }] })`,
yang sudah didukung WebView Chromium.

## Konsekuensi

**Menjadi lebih baik**

- Tata letak kamera layar penuh berperilaku seperti yang kami harapkan, tanpa
  penanganan inset khusus.
- Rantai build bekerja dengan Android Studio versi mana pun yang sudah ada di
  laptop tim.
- Kode yang dihasilkan agen AI lebih jarang keliru, karena API 7.x jauh lebih
  banyak terwakili.
- Permukaan native yang harus dipahami menjadi kecil: dua plugin saja.

**Menjadi lebih buruk**

- Melewatkan perbaikan dan penyempurnaan Capacitor 8. Tidak ada satu pun yang
  kami butuhkan.
- Nantinya akan perlu migrasi bila proyek dilanjutkan setelah lomba. Migrasi
  itu pekerjaan yang jelas dan bisa dijadwalkan, bukan risiko yang harus
  ditanggung sekarang.

## Alternatif yang ditolak

- **Capacitor 8 dengan penanganan inset manual.** Bisa dikerjakan, tapi berarti
  menghabiskan waktu lomba untuk menetralkan fitur yang tidak kami minta.
- **Cordova.** Lebih tua, dukungan lebih sedikit, tanpa keuntungan apa pun di
  sini.
- **Android native murni tanpa WebView.** Menggugurkan seluruh keunggulan
  arsitektur yang disebut exsum, dan mustahil dalam 24 jam.
